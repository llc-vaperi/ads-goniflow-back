import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { CustomError } from "../middlewares/error.middleware.js";
import { throwSafeDbError } from "../utils/dbError.js";

export type AdminRole = "owner" | "admin" | "viewer";

export interface AdminMembership {
    userId: string;
    role: AdminRole;
    isActive: boolean;
}

export interface AdminMember extends AdminMembership {
    email: string;
    addedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminAuditEntry {
    id: string;
    actorUserId: string | null;
    actorEmail: string | null;
    action: string;
    targetUserId: string | null;
    targetEmail: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}

function adminOperationError(
    context: string,
    error: { message?: string } | null,
    fallbackMessage: string,
): never {
    console.error(`[admin] ${context}:`, error);
    const message = error?.message ?? "";
    const safeError = new Error(fallbackMessage) as CustomError;

    if (message.includes("OWNER_PERMISSION_REQUIRED")) {
        safeError.statusCode = 403;
        safeError.code = "OWNER_PERMISSION_REQUIRED";
        safeError.message = "Owner permission is required";
    } else if (
        message.includes("ADMIN_USER_NOT_FOUND")
        || message.includes("ADMIN_MEMBER_NOT_FOUND")
    ) {
        safeError.statusCode = 404;
        safeError.code = "ADMIN_USER_NOT_FOUND";
        safeError.message = "User was not found";
    } else if (message.includes("LAST_OWNER_PROTECTED")) {
        safeError.statusCode = 409;
        safeError.code = "LAST_OWNER_PROTECTED";
        safeError.message = "The last active owner cannot be removed or demoted";
    } else if (message.includes("INVALID_ADMIN_ROLE")) {
        safeError.statusCode = 400;
        safeError.code = "INVALID_ADMIN_ROLE";
        safeError.message = "Invalid admin role";
    } else {
        safeError.statusCode = 500;
        safeError.code = "ADMIN_OPERATION_FAILED";
    }

    throw safeError;
}

export async function getAdminMembership(
    userId: string,
): Promise<AdminMembership | null> {
    const { data, error } = await getSupabaseAdmin()
        .from("admin_members")
        .select("user_id, role, is_active")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throwSafeDbError(
            "getAdminMembership",
            error,
            "Failed to verify admin access",
        );
    }

    if (!data) return null;
    return {
        userId: data.user_id,
        role: data.role as AdminRole,
        isActive: data.is_active,
    };
}

export async function listAdminMembers(): Promise<AdminMember[]> {
    const { data, error } = await getSupabaseAdmin().rpc("list_admin_members");
    if (error) {
        adminOperationError(
            "listAdminMembers",
            error,
            "Failed to load admin members",
        );
    }

    return ((data ?? []) as Array<{
        user_id: string;
        email: string;
        role: AdminRole;
        is_active: boolean;
        added_by: string | null;
        created_at: string;
        updated_at: string;
    }>).map((member) => ({
        userId: member.user_id,
        email: member.email,
        role: member.role,
        isActive: member.is_active,
        addedBy: member.added_by,
        createdAt: member.created_at,
        updatedAt: member.updated_at,
    }));
}

export async function addAdminMember(
    actorUserId: string,
    email: string,
    role: AdminRole,
): Promise<AdminMembership & { email: string }> {
    const { data, error } = await getSupabaseAdmin().rpc("add_admin_member", {
        p_actor_user_id: actorUserId,
        p_email: email,
        p_role: role,
    });
    if (error || !data) {
        adminOperationError(
            "addAdminMember",
            error,
            "Failed to add admin member",
        );
    }

    return data as AdminMembership & { email: string };
}

export async function updateAdminMember(
    actorUserId: string,
    targetUserId: string,
    role: AdminRole,
    isActive: boolean,
): Promise<AdminMembership & { email: string }> {
    const { data, error } = await getSupabaseAdmin().rpc(
        "update_admin_member",
        {
            p_actor_user_id: actorUserId,
            p_target_user_id: targetUserId,
            p_role: role,
            p_is_active: isActive,
        },
    );
    if (error || !data) {
        adminOperationError(
            "updateAdminMember",
            error,
            "Failed to update admin member",
        );
    }

    return data as AdminMembership & { email: string };
}

export async function listAdminAuditLog(
    limit: number,
): Promise<AdminAuditEntry[]> {
    const { data, error } = await getSupabaseAdmin().rpc(
        "list_admin_audit_log",
        { p_limit: limit },
    );
    if (error) {
        adminOperationError(
            "listAdminAuditLog",
            error,
            "Failed to load admin audit log",
        );
    }

    return ((data ?? []) as Array<{
        id: string;
        actor_user_id: string | null;
        actor_email: string | null;
        action: string;
        target_user_id: string | null;
        target_email: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
    }>).map((entry) => ({
        id: entry.id,
        actorUserId: entry.actor_user_id,
        actorEmail: entry.actor_email,
        action: entry.action,
        targetUserId: entry.target_user_id,
        targetEmail: entry.target_email,
        metadata: entry.metadata ?? {},
        createdAt: entry.created_at,
    }));
}
