import { Router } from "express";
import {
    receiveBogCallback,
    startBogCheckout,
} from "../controllers/bog-payment.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createCreditPurchaseSchema } from "../validators/credit-purchases.schema.js";

const router = Router();

// Bank of Georgia callbacks are signature-checked and then verified against
// the provider API before any credits are issued.
router.post("/bog/callback", receiveBogCallback);
router.post(
    "/bog/checkout",
    requireAuth,
    validateBody(createCreditPurchaseSchema),
    startBogCheckout,
);

export default router;
