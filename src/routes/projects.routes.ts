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
import { generateAdText, generateAdImage } from "../controllers/generate.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { generateLimiter } from "../middlewares/rateLimit.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createProjectSchema, updateProjectSchema, saveAdSchema } from "../validators/projects.schema.js";
import { generateTextSchema, generateImageSchema } from "../validators/generate.schema.js";

const router = Router();

// Protect all routes
router.use(requireAuth);

// Project endpoints
router.get("/", getProjects);
router.post("/", validateBody(createProjectSchema), createProject);
router.put("/:id", validateBody(updateProjectSchema), updateProject);
router.delete("/:id", deleteProject);

// Ad endpoints related to specific projects
router.get("/:projectId/ads", getSavedAds);
router.post("/:projectId/ads", validateBody(saveAdSchema), saveAd);
router.delete("/:projectId/ads/:adId", deleteSavedAd);

// AI-generated ad copy / image
router.post("/:projectId/generate-text", generateLimiter, validateBody(generateTextSchema), generateAdText);
router.post("/:projectId/generate-image", generateLimiter, validateBody(generateImageSchema), generateAdImage);

export default router;

