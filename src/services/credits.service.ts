import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { throwSafeDbError } from "../utils/dbError.js";

import { CustomError } from '../middlewares/error.middleware.js';

export interface CreditBalance {
    promo: number;
    paid: number;
    total: number;
    promoCycleStart: string;
    updatedAt: string;
}

export interface CreditLedgerEntry {
    id: string;
    amount: number;
    bucket: "promo" | "paid";
    entryType: string;
    balanceAfter: number;
    referenceId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}

export interface CreditReservation {
    reservationId: string;
    status: 'reserved' | 'consumed' | 'refunded';
    cost: number;
    promoDebited: number;
    paidDebited: number;
    promoBalance: number;
    paidBalance: number;
    totalBalance: number;
}

export interface CreditUsageSummary {
    periodDays: number;
    periodStart: string;
    creditsSpent: number;
    promoCreditsSpent: number;
    paidCreditsSpent: number;
    operations: number;
    textOperations: number;
    imageOperations: number;
    standardOperations: number;
    premiumOperations: number;
    refundedOperations: number;
    platforms: Array<{
        platform: string;
        operations: number;
    }>;
    allTimeCreditsSpent: number;
    allTimeOperations: number;
}

interface CreditWalletRow {
    user_id: string;
    promo_balance: number;
    paid_balance: number;
    promo_cycle_start: string;
    updated_at: string;
}

interface CreditLedgerRow {
    id: string;
    amount: number;
    bucket: "promo" | "paid";
    entry_type: string;
    balance_after: number;
    reference_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

async function ensureWallet(userId: string): Promise<CreditWalletRow> {
    const { data, error } = await getSupabaseAdmin()
        .rpc("ensure_credit_wallet", { p_user_id: userId })
        .single();

    if (error || !data) {
        throwSafeDbError(
            "ensureCreditWallet",
            error,
            "Failed to initialize credit wallet",
        );
    }

    return data as CreditWalletRow;
}

function mapBalance(wallet: CreditWalletRow): CreditBalance {
    return {
        promo: wallet.promo_balance,
        paid: wallet.paid_balance,
        total: wallet.promo_balance + wallet.paid_balance,
        promoCycleStart: wallet.promo_cycle_start,
        updatedAt: wallet.updated_at,
    };
}

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
    return mapBalance(await ensureWallet(userId));
}

export async function getCreditHistory(
    userId: string,
    limit: number,
): Promise<CreditLedgerEntry[]> {
    await ensureWallet(userId);

    const { data, error } = await getSupabaseAdmin()
        .from("credit_ledger")
        .select("id, amount, bucket, entry_type, balance_after, reference_id, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        throwSafeDbError(
            "getCreditHistory",
            error,
            "Failed to load credit history",
        );
    }

    return ((data ?? []) as CreditLedgerRow[]).map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        bucket: entry.bucket,
        entryType: entry.entry_type,
        balanceAfter: entry.balance_after,
        referenceId: entry.reference_id,
        metadata: entry.metadata ?? {},
        createdAt: entry.created_at,
    }));
}

export async function getCreditUsageSummary(
    userId: string,
    days: number,
): Promise<CreditUsageSummary> {
    await ensureWallet(userId);

    const { data, error } = await getSupabaseAdmin().rpc(
        "get_credit_usage_summary",
        {
            p_user_id: userId,
            p_days: days,
        },
    );

    if (error || !data) {
        throwSafeDbError(
            "getCreditUsageSummary",
            error,
            "Failed to load credit usage summary",
        );
    }

    return data as CreditUsageSummary;
}

function creditOperationError(
    context: string,
    error: { message?: string } | null,
    fallbackMessage: string,
): never {
    console.error(`[credits] ${context}:`, error);

    const isInsufficient = error?.message?.includes('INSUFFICIENT_CREDITS');
    const safeError = new Error(
        isInsufficient ? 'Not enough credits' : fallbackMessage,
    ) as CustomError;
    safeError.statusCode = isInsufficient ? 402 : 500;
    safeError.code = isInsufficient ? 'INSUFFICIENT_CREDITS' : 'CREDIT_OPERATION_FAILED';
    throw safeError;
}

export async function reserveCredits(
    userId: string,
    amount: number,
    operation: string,
    idempotencyKey: string,
    metadata: Record<string, unknown> = {},
): Promise<CreditReservation> {
    const { data, error } = await getSupabaseAdmin().rpc('reserve_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_operation: operation,
        p_idempotency_key: idempotencyKey,
        p_metadata: metadata,
    });

    if (error || !data) {
        creditOperationError(
            'reserveCredits',
            error,
            'Failed to reserve credits',
        );
    }

    return data as CreditReservation;
}

export async function consumeCreditReservation(
    userId: string,
    reservationId: string,
): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc('consume_credit_reservation', {
        p_user_id: userId,
        p_reservation_id: reservationId,
    });

    if (error) {
        creditOperationError(
            'consumeCreditReservation',
            error,
            'Failed to finalize credit charge',
        );
    }
}

export async function refundCreditReservation(
    userId: string,
    reservationId: string,
    reason: string,
): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc('refund_credit_reservation', {
        p_user_id: userId,
        p_reservation_id: reservationId,
        p_reason: reason,
    });

    if (error) {
        creditOperationError(
            'refundCreditReservation',
            error,
            'Failed to refund reserved credits',
        );
    }
}
