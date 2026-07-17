import { Router } from "express";
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
} from "../controllers/auth/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { authLimiter } from "../middlewares/rateLimit.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/auth.schema.js";

const router = Router();

router.post("/signup", authLimiter, validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/logout", logout);
router.post("/forgot-password", authLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, requireAuth, validateBody(resetPasswordSchema), resetPassword);
router.get("/me", requireAuth, getMe);

export default router;
