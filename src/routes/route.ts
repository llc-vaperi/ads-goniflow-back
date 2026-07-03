import { Router } from "express";
import authRoutes from "./auth.routes.js";
import projectRoutes from "./projects.routes.js";
import uploadRoutes from "./uploads.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/uploads", uploadRoutes);

export default router;

