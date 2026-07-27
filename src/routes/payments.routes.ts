import { Router } from "express";
import {
    receiveStripeWebhook,
    startCheckout,
} from "../controllers/payment.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createCreditPurchaseSchema } from "../validators/credit-purchases.schema.js";

const router = Router();

router.post(
    "/checkout",
    requireAuth,
    validateBody(createCreditPurchaseSchema),
    startCheckout,
);

// Public/unauthenticated — Stripe calls this directly. The webhook signature
// check inside the handler is the trust boundary.
router.post("/stripe/webhook", receiveStripeWebhook);

export default router;
