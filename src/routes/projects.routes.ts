import { Router } from "express";
import {
    getProjects,
    createProject,
    deleteProject,
    updateProject,
    getSavedAds,
    saveAd,
    deleteSavedAd
} from "../controllers/projects.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Protect all routes
router.use(requireAuth);

// Project endpoints
router.get("/", getProjects);
router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

// Ad endpoints related to specific projects
router.get("/:projectId/ads", getSavedAds);
router.post("/:projectId/ads", saveAd);
router.delete("/:projectId/ads/:adId", deleteSavedAd);

export default router;

