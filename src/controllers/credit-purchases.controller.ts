import { NextFunction, Request, Response } from "express";
import {
    createCreditPurchase,
    listCreditPurchases,
} from "../services/credit-purchases.service.js";

export async function createPurchase(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const purchase = await createCreditPurchase(
            userId,
            req.body.productId,
            req.body.quantity,
            req.get("Idempotency-Key"),
        );

        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
}

export async function getPurchases(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const requestedLimit = Number(req.query.limit ?? 25);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 25;
        const purchases = await listCreditPurchases(userId, limit);

        res.status(200).json({ success: true, data: purchases });
    } catch (error) {
        next(error);
    }
}

