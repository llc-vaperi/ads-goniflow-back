import { Router } from "express";
import authRoutes from "./auth.routes.js";
import projectRoutes from "./projects.routes.js";
import uploadRoutes from "./uploads.routes.js";
import calendarRoutes from "./calendar.routes.js";

import creditRoutes from './credits.routes.js';
import paymentRoutes from './payments.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/uploads", uploadRoutes);
router.use("/calendar", calendarRoutes);

router.use('/credits', creditRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);

export default router;

