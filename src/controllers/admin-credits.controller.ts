import { NextFunction, Request, Response } from "express";
import {
    adjustUserCredits,
    listAdminCreditUsers,
} from "../services/admin-credits.service.js";

function getSingleParam(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getAdminCreditUsers(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const search = String(req.query.search ?? "").trim().slice(0, 320);
        const requestedLimit = Number(req.query.limit ?? 50);
        const requestedOffset = Number(req.query.offset ?? 0);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 50;
        const offset = Number.isInteger(requestedOffset)
            ? Math.max(requestedOffset, 0)
            : 0;
        const users = await listAdminCreditUsers(
            req.user!.id,
            search,
            limit,
            offset,
        );

        res.status(200).json({
            success: true,
            data: {
                users,
                total: users[0]?.totalCount ?? 0,
                limit,
                offset,
            },
        });
    } catch (error) {
        next(error);
    }
}

export async function createCreditAdjustment(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const targetUserId = getSingleParam(req.params.userId);
        if (!targetUserId || !isUuid(targetUserId)) {
            res.status(400).json({
                success: false,
                error: "Invalid user ID",
            });
            return;
        }

        const adjustment = await adjustUserCredits(
            req.user!.id,
            targetUserId,
            req.body.bucket,
            req.body.amount,
            req.body.reason,
            req.get("Idempotency-Key"),
        );

        res.status(200).json({ success: true, data: adjustment });
    } catch (error) {
        next(error);
    }
}
