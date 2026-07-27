import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { CustomError } from "../middlewares/error.middleware.js";

export interface AdminCreditUser {
    userId: string;
    email: string;
    promoBalance: number;
    paidBalance: number;
    totalBalance: number;
    registeredAt: string;
    totalCount: number;
}

export interface CreditAdjustmentResult {
    userId: string;
    email?: string;
    bucket: "promo" | "paid";
    amount: number;
    balanceBefore?: number;
    balanceAfter: number;
    promoBalance?: number;
    paidBalance?: number;
    totalBalance?: number;
    alreadyApplied: boolean;
}

function adminCreditError(
    context: string,
    error: { message?: string } | null,
    fallbackMessage: string,
): never {
    console.error(`[admin-credits] ${context}:`, error);
    const message = error?.message ?? "";
    const safeError = new Error(fallbackMessage) as CustomError;

    if (
        message.includes("ADMIN_PERMISSION_REQUIRED")
        || message.includes("ADMIN_WRITE_PERMISSION_REQUIRED")
    ) {
        safeError.statusCode = 403;
        safeError.code = "ADMIN_PERMISSION_REQUIRED";
        safeError.message = "Admin permission is required";
    } else if (message.includes("ADMIN_USER_NOT_FOUND")) {
        safeError.statusCode = 404;
        safeError.code = "ADMIN_USER_NOT_FOUND";
        safeError.message = "User was not found";
    } else if (message.includes("CREDIT_BALANCE_CANNOT_BE_NEGATIVE")) {
        safeError.statusCode = 409;
        safeError.code = "CREDIT_BALANCE_CANNOT_BE_NEGATIVE";
        safeError.message = "Credit balance cannot be negative";
    } else if (message.includes("IDEMPOTENCY_KEY_CONFLICT")) {
        safeError.statusCode = 409;
        safeError.code = "IDEMPOTENCY_KEY_CONFLICT";
        safeError.message = "Idempotency key was already used for another adjustment";
    } else if (
        message.includes("INVALID_CREDIT")
        || message.includes("INVALID_ADJUSTMENT_REASON")
        || message.includes("INVALID_IDEMPOTENCY_KEY")
    ) {
        safeError.statusCode = 400;
        safeError.code = "INVALID_CREDIT_ADJUSTMENT";
        safeError.message = "Invalid credit adjustment";
    } else {
        safeError.statusCode = 500;
        safeError.code = "ADMIN_CREDIT_OPERATION_FAILED";
    }

    throw safeError;
}

export async function listAdminCreditUsers(
    actorUserId: string,
    search: string,
    limit: number,
    offset: number,
): Promise<AdminCreditUser[]> {
    const { data, error } = await getSupabaseAdmin().rpc(
        "list_admin_credit_users",
        {
            p_actor_user_id: actorUserId,
            p_search: search,
            p_limit: limit,
            p_offset: offset,
        },
    );
    if (error) {
        adminCreditError(
            "listAdminCreditUsers",
            error,
            "Failed to load users",
        );
    }

    return ((data ?? []) as Array<{
        user_id: string;
        email: string;
        promo_balance: number;
        paid_balance: number;
        total_balance: number;
        registered_at: string;
        total_count: number | string;
    }>).map((user) => ({
        userId: user.user_id,
        email: user.email,
        promoBalance: user.promo_balance,
        paidBalance: user.paid_balance,
        totalBalance: user.total_balance,
        registeredAt: user.registered_at,
        totalCount: Number(user.total_count),
    }));
}

export async function adjustUserCredits(
    actorUserId: string,
    targetUserId: string,
    bucket: "promo" | "paid",
    amount: number,
    reason: string,
    requestedIdempotencyKey?: string,
): Promise<CreditAdjustmentResult> {
    const idempotencyKey = requestedIdempotencyKey?.trim() || randomUUID();
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) {
        const error = new Error("Invalid idempotency key") as CustomError;
        error.statusCode = 400;
        error.code = "INVALID_IDEMPOTENCY_KEY";
        throw error;
    }

    const { data, error } = await getSupabaseAdmin().rpc(
        "adjust_user_credits",
        {
            p_actor_user_id: actorUserId,
            p_target_user_id: targetUserId,
            p_bucket: bucket,
            p_amount: amount,
            p_reason: reason,
            p_idempotency_key: idempotencyKey,
        },
    );
    if (error || !data) {
        adminCreditError(
            "adjustUserCredits",
            error,
            "Failed to adjust user credits",
        );
    }

    return data as CreditAdjustmentResult;
}
