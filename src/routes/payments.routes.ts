import { Router } from "express";
import {
    receiveBogCallback,
    receiveStripeWebhook,
    startCheckout,
} from "../controllers/payment.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createCreditPurchaseSchema } from "../validators/credit-purchases.schema.js";

const router = Router();

// Checkout is created via whichever provider PAYMENT_PROVIDER selects
// (see src/services/payments/index.ts) — the client never names a provider.
router.post(
    "/checkout",
    requireAuth,
    validateBody(createCreditPurchaseSchema),
    startCheckout,
);

// Provider webhooks are signature-checked (and, for BOG, re-verified against
// the provider API) before any credits are issued. Both stay public/unauthenticated
// since the provider itself calls these directly with no user session.
router.post("/bog/callback", receiveBogCallback);
router.post("/stripe/webhook", receiveStripeWebhook);

export default router;
