import { Request, Response, NextFunction } from "express";
import { uploadBufferToStorage } from "../services/storage.service.js";

export async function uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, error: "Image file is required" });
            return;
        }

        const extension = req.file.originalname.split(".").pop() || "bin";
        const url = await uploadBufferToStorage(req.user!.id, req.file.buffer, req.file.mimetype, extension);

        res.status(201).json({ success: true, data: { url } });
    } catch (error) {
        next(error);
    }
}
