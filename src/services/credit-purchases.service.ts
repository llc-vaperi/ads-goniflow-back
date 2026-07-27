import { randomUUID } from "node:crypto";
import { CREDIT_PRODUCTS } from "../config/credits.js";
import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { CustomError } from "../middlewares/error.middleware.js";
import { throwSafeDbError } from "../utils/dbError.js";

export interface CreditPurchase {
    id: string;
    productId: string;
    quantity: number;
    amountGel: number;
    credits: number;
    provider: string | null;
    providerOrderId: string | null;
    checkoutUrl: string | null;
    status: "created" | "pending" | "paid" | "failed" | "cancelled" | "refunded";
    createdAt: string;
    paidAt: string | null;
}

interface CreditPurchaseRow {
    id: string;
    product_id: string;
    quantity: number;
    amount_gel: number | string;
    credits: number;
    provider: string | null;
    provider_order_id: string | null;
    checkout_url: string | null;
    status: CreditPurchase["status"];
    created_at: string;
    paid_at: string | null;
}

function mapPurchase(row: CreditPurchaseRow): CreditPurchase {
    return {
        id: row.id,
        productId: row.product_id,
        quantity: row.quantity,
        amountGel: Number(row.amount_gel),
        credits: row.credits,
        provider: row.provider,
        providerOrderId: row.provider_order_id,
        checkoutUrl: row.checkout_url,
        status: row.status,
        createdAt: row.created_at,
        paidAt: row.paid_at,
    };
}

function getProduct(productId: string) {
    return CREDIT_PRODUCTS.find((product) => product.id === productId);
}

export async function createCreditPurchase(
    userId: string,
    productId: string,
    quantity: number,
    idempotencyKey?: string,
): Promise<CreditPurchase> {
    const product = getProduct(productId);
    if (!product) {
        const error = new Error("Unknown credit product") as CustomError;
        error.statusCode = 400;
        error.code = "UNKNOWN_CREDIT_PRODUCT";
        throw error;
    }

    const normalizedKey = idempotencyKey?.trim() || randomUUID();
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(normalizedKey)) {
        const error = new Error("Invalid idempotency key") as CustomError;
        error.statusCode = 400;
        error.code = "INVALID_IDEMPOTENCY_KEY";
        throw error;
    }

    const amountGel = product.priceGel * quantity;
    const credits = product.credits * quantity;
    const admin = getSupabaseAdmin();

    const { data: existing, error: existingError } = await admin
        .from("credit_purchases")
        .select("id, product_id, quantity, amount_gel, credits, provider, provider_order_id, checkout_url, status, created_at, paid_at")
        .eq("user_id", userId)
        .eq("idempotency_key", normalizedKey)
        .maybeSingle();

    if (existingError) {
        throwSafeDbError(
            "lookupCreditPurchase",
            existingError,
            "Failed to look up credit purchase",
        );
    }

    if (existing) {
        return mapPurchase(existing as CreditPurchaseRow);
    }

    const { data, error } = await admin
        .from("credit_purchases")
        .insert({
            user_id: userId,
            product_id: product.id,
            quantity,
            amount_gel: amountGel,
            credits,
            idempotency_key: normalizedKey,
        })
        .select("id, product_id, quantity, amount_gel, credits, provider, provider_order_id, checkout_url, status, created_at, paid_at")
        .single();

    if (error?.code === "23505") {
        const { data: racedPurchase, error: racedError } = await admin
            .from("credit_purchases")
            .select("id, product_id, quantity, amount_gel, credits, provider, provider_order_id, checkout_url, status, created_at, paid_at")
            .eq("user_id", userId)
            .eq("idempotency_key", normalizedKey)
            .single();

        if (!racedError && racedPurchase) {
            return mapPurchase(racedPurchase as CreditPurchaseRow);
        }
    }

    if (error || !data) {
        throwSafeDbError(
            "createCreditPurchase",
            error,
            "Failed to create credit purchase",
        );
    }

    return mapPurchase(data as CreditPurchaseRow);
}

export async function listCreditPurchases(
    userId: string,
    limit: number,
): Promise<CreditPurchase[]> {
    const { data, error } = await getSupabaseAdmin()
        .from("credit_purchases")
        .select("id, product_id, quantity, amount_gel, credits, provider, provider_order_id, checkout_url, status, created_at, paid_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        throwSafeDbError(
            "listCreditPurchases",
            error,
            "Failed to load credit purchases",
        );
    }

    return ((data ?? []) as CreditPurchaseRow[]).map(mapPurchase);
}
