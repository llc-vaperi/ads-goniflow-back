import { Router } from "express";
import {
    getBalance,
    getCatalog,
    getHistory,
    getUsageSummary,
} from "../controllers/credits.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
    createPurchase,
    getPurchases,
} from "../controllers/credit-purchases.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createCreditPurchaseSchema } from "../validators/credit-purchases.schema.js";

const router = Router();

router.use(requireAuth);

router.get("/balance", getBalance);
router.get("/history", getHistory);
router.get("/summary", getUsageSummary);
router.get("/catalog", getCatalog);
router.get("/purchases", getPurchases);
router.post("/purchases", validateBody(createCreditPurchaseSchema), createPurchase);

export default router;
