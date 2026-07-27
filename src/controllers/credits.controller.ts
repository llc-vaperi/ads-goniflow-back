import { NextFunction, Request, Response } from "express";
import {
    CREDIT_PRODUCTS,
    GENERATION_CREDIT_COSTS,
    MONTHLY_PROMO_CREDITS,
} from "../config/credits.js";
import {
    getCreditBalance,
    getCreditHistory,
    getCreditUsageSummary,
} from "../services/credits.service.js";

function requireUserId(req: Request, res: Response): string | null {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return null;
    }
    return userId;
}

export async function getBalance(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req, res);
        if (!userId) return;

        const balance = await getCreditBalance(userId);
        res.status(200).json({ success: true, data: balance });
    } catch (error) {
        next(error);
    }
}

export async function getHistory(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req, res);
        if (!userId) return;

        const requestedLimit = Number(req.query.limit ?? 25);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 25;
        const history = await getCreditHistory(userId, limit);

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
}

export async function getUsageSummary(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req, res);
        if (!userId) return;

        const requestedDays = Number(req.query.days ?? 30);
        const days = Number.isInteger(requestedDays)
            ? Math.min(Math.max(requestedDays, 1), 365)
            : 30;
        const summary = await getCreditUsageSummary(userId, days);

        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
}

export function getCatalog(
    req: Request,
    res: Response,
): void {
    res.status(200).json({
        success: true,
        data: {
            monthlyPromoCredits: MONTHLY_PROMO_CREDITS,
            generationCosts: GENERATION_CREDIT_COSTS,
            products: CREDIT_PRODUCTS,
            payment: {
                provider: 'bog',
                enabled: Boolean(
                    process.env.BOG_CLIENT_ID
                    && process.env.BOG_CLIENT_SECRET
                    && process.env.BOG_RETURN_URL
                    && process.env.BOG_CALLBACK_URL
                ),
            },
        },
    });
}
