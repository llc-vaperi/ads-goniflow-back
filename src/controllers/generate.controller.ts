import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";
import { uploadBufferToStorage } from "../services/storage.service.js";
import { getProvider } from "../services/ai/index.js";

export async function generateAd(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const { platform, tone, textPrompt, imagePrompt } = req.body;
        if (!platform || !tone) {
            res.status(400).json({ success: false, error: "platform and tone are required" });
            return;
        }

        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("name, description, link")
            .eq("id", projectId)
            .eq("user_id", userId)
            .single();

        if (projectError || !project) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        const params = {
            platform,
            tone,
            textPrompt,
            imagePrompt,
            projectName: project.name,
            projectDescription: project.description,
            projectLink: project.link,
        };

        const provider = getProvider();

        const [textResult, imageResult] = await Promise.allSettled([
            provider.generateText(params),
            provider.generateImage(params),
        ]);

        if (textResult.status === "rejected") {
            throw textResult.reason;
        }

        let imageUrl: string | null = null;
        if (imageResult.status === "fulfilled" && imageResult.value) {
            try {
                const image = imageResult.value;
                imageUrl = "url" in image
                    ? image.url
                    : await uploadBufferToStorage(userId, image.buffer, image.mimeType, image.extension);
            } catch (imageError) {
                console.error("Image generation/upload failed:", imageError);
            }
        } else if (imageResult.status === "rejected") {
            console.error("AI image generation failed:", imageResult.reason);
        }

        res.status(200).json({ success: true, data: { ...textResult.value, imageUrl } });
    } catch (error) {
        next(error);
    }
}
