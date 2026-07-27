import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { CustomError } from "../../middlewares/error.middleware.js";
import { throwSafeDbError } from "../../utils/dbError.js";
import { CreditPurchase } from "../credit-purchases.service.js";
import { PaymentCheckoutResult } from "./types.js";

export function paymentError(message: string, code: string, statusCode = 502): CustomError {
    const error = new Error(message) as CustomError;
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

const PURCHASE_COLUMNS =
    "id, product_id, quantity, amount_gel, credits, provider, provider_order_id, checkout_url, status, created_at, paid_at";

function mapRow(row: Record<string, unknown>): CreditPurchase {
    return {
        id: row.id as string,
        productId: row.product_id as string,
        quantity: row.quantity as number,
        amountGel: Number(row.amount_gel),
        credits: row.credits as number,
        provider: row.provider as string | null,
        providerOrderId: row.provider_order_id as string | null,
        checkoutUrl: row.checkout_url as string | null,
        status: row.status as CreditPurchase["status"],
        createdAt: row.created_at as string,
        paidAt: row.paid_at as string | null,
    };
}

// If a checkout for this purchase was already started with the same provider,
// return the existing checkout instead of creating a duplicate order upstream.
export function reuseExistingCheckout(
    purchase: CreditPurchase,
    providerName: string,
): PaymentCheckoutResult | null {
    if (
        purchase.status === "pending"
        && purchase.provider === providerName
        && purchase.providerOrderId
        && purchase.checkoutUrl
    ) {
        return {
            purchase,
            checkoutUrl: purchase.checkoutUrl,
            orderId: purchase.providerOrderId,
        };
    }
    return null;
}

export async function markPurchasePending(
    purchaseId: string,
    providerName: string,
    orderId: string,
    checkoutUrl: string,
): Promise<CreditPurchase> {
    const { data, error } = await getSupabaseAdmin()
        .from("credit_purchases")
        .update({
            provider: providerName,
            provider_order_id: orderId,
            checkout_url: checkoutUrl,
            status: "pending",
            updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseId)
        .eq("status", "created")
        .select(PURCHASE_COLUMNS)
        .single();

    if (error || !data) {
        throwSafeDbError(
            "markPurchasePending",
            error,
            "Failed to initialize payment",
        );
    }

    return mapRow(data as Record<string, unknown>);
}
