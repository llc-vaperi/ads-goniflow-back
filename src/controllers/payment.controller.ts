import { NextFunction, Request, Response } from "express";
import { getActivePaymentProvider } from "../services/payments/index.js";
import { bogProvider } from "../services/payments/bog.provider.js";
import { stripeProvider } from "../services/payments/stripe.provider.js";

export async function startCheckout(
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

        const checkout = await getActivePaymentProvider().createCheckout(
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
        if (!req.rawBody) {
            res.status(400).json({ success: false, error: "Invalid payment callback" });
            return;
        }
        await bogProvider.handleWebhook(req.rawBody, req.headers);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
}

export async function receiveStripeWebhook(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        if (!req.rawBody) {
            res.status(400).json({ success: false, error: "Invalid payment callback" });
            return;
        }
        await stripeProvider.handleWebhook(req.rawBody, req.headers);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
}
