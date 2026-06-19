import { Router } from "express";
import { testFunc } from "../controllers/testFunc.controller.js";
import authRoutes from "./auth.routes.js";

const router = Router();

router.get("/test", testFunc);
router.use("/auth", authRoutes);

export default router;
