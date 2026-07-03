import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "../config/supabaseAdmin.js";

const BUCKET = "ad-assets";

export async function uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, error: "Image file is required" });
            return;
        }

        const extension = req.file.originalname.split(".").pop() || "bin";
        const path = `${req.user?.id}/${randomUUID()}.${extension}`;
        const supabaseAdmin = getSupabaseAdmin();

        const { error } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(path, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (error) throw error;

        const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

        res.status(201).json({ success: true, data: { url: data.publicUrl } });
    } catch (error) {
        next(error);
    }
}
