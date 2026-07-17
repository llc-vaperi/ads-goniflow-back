import { uploadBufferToStorage } from "../services/storage.service.js";
// Extension is derived from the validated mimetype, not the client-supplied
// filename, so a mismatched/spoofed extension can't be used for the stored file.
const MIME_TO_EXTENSION = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
};
export async function uploadImage(req, res, next) {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, error: "Image file is required" });
            return;
        }
        const extension = MIME_TO_EXTENSION[req.file.mimetype];
        if (!extension) {
            res.status(400).json({ success: false, error: "Unsupported image type" });
            return;
        }
        const url = await uploadBufferToStorage(req.user.id, req.file.buffer, req.file.mimetype, extension);
        res.status(201).json({ success: true, data: { url } });
    }
    catch (error) {
        next(error);
    }
}
