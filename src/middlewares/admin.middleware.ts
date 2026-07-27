import { NextFunction, Request, Response } from "express";
import {
    AdminRole,
    getAdminMembership,
} from "../services/admin-members.service.js";

export function requireAdmin(allowedRoles: readonly AdminRole[]) {
    return async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: "Unauthorized" });
                return;
            }

            const membership = await getAdminMembership(userId);
            if (
                !membership
                || !membership.isActive
                || !allowedRoles.includes(membership.role)
            ) {
                res.status(403).json({
                    success: false,
                    error: "Admin access denied",
                });
                return;
            }

            req.adminRole = membership.role;
            next();
        } catch (error) {
            next(error);
        }
    };
}
