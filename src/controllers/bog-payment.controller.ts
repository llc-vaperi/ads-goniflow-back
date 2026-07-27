import { NextFunction, Request, Response } from "express";
import {
    createBogCheckout,
    processBogCallback,
    verifyBogCallbackSignature,
} from "../services/bog-payment.service.js";

export async function startBogCheckout(
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

        const checkout = await createBogCheckout(
            userId,
            req.body.productId,
            req.body.quantity,
            req.get("Idempotency-Key"),
        );

        res.status(200).json({ success: true, data: checkout });
    } catch (error) {
        next(error);
    }
}

export async function receiveBogCallback(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const signature = req.get("Callback-Signature");
        if (
            !signature
            || !req.rawBody
            || !verifyBogCallbackSignature(req.rawBody, signature)
        ) {
            res.status(401).json({
                success: false,
                error: "Invalid callback signature",
            });
            return;
        }

        const orderId = req.body?.body?.order_id;
        if (
            req.body?.event !== "order_payment"
            || typeof orderId !== "string"
            || !orderId.trim()
        ) {
            res.status(400).json({
                success: false,
                error: "Invalid payment callback",
            });
            return;
        }

        await processBogCallback(orderId.trim());
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
}
