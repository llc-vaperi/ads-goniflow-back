import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();
const authController = new AuthController();

router.post("/signup", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", requireAuth, authController.resetPassword);
router.get("/me", requireAuth, authController.getMe);

export default router;
