import { NextFunction, Request, Response } from "express";
import {
    addAdminMember,
    listAdminAuditLog,
    listAdminMembers,
    updateAdminMember,
} from "../services/admin-members.service.js";

export function getAdminMe(req: Request, res: Response): void {
    res.status(200).json({
        success: true,
        data: {
            userId: req.user?.id,
            email: req.user?.email,
            role: req.adminRole,
        },
    });
}

export async function getAdminMembers(
    _req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const members = await listAdminMembers();
        res.status(200).json({ success: true, data: members });
    } catch (error) {
        next(error);
    }
}

export async function createAdminMember(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const member = await addAdminMember(
            req.user!.id,
            req.body.email,
            req.body.role,
        );
        res.status(201).json({ success: true, data: member });
    } catch (error) {
        next(error);
    }
}

export async function patchAdminMember(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const targetUserId = Array.isArray(req.params.userId)
            ? req.params.userId[0]
            : req.params.userId;
        if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
            res.status(400).json({
                success: false,
                error: "Invalid user ID",
            });
            return;
        }

        const member = await updateAdminMember(
            req.user!.id,
            targetUserId,
            req.body.role,
            req.body.isActive,
        );
        res.status(200).json({ success: true, data: member });
    } catch (error) {
        next(error);
    }
}

export async function getAdminAuditLog(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const requestedLimit = Number(req.query.limit ?? 50);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 200)
            : 50;
        const audit = await listAdminAuditLog(limit);
        res.status(200).json({ success: true, data: audit });
    } catch (error) {
        next(error);
    }
}
