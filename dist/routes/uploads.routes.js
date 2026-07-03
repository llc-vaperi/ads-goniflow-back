import { Router } from "express";
import multer from "multer";
import { uploadImage } from "../controllers/uploads.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Only image uploads are allowed"));
            return;
        }
        cb(null, true);
    },
});
const router = Router();
router.use(requireAuth);
router.post("/", upload.single("image"), uploadImage);
export default router;
