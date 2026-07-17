import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";
import { uploadBufferToStorage } from "../services/storage.service.js";
import { getTextProvider, getImageProvider, getTextProviderName, getImageProviderName } from "../services/ai/index.js";

export async function generateAd(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const { platform, tone, textPrompt, imagePrompt } = req.body;

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

        const logContext = `[generate] text=${getTextProviderName()} image=${getImageProviderName()} projectId=${projectId} platform=${platform} tone=${tone}`;

        const [textResult, imageResult] = await Promise.allSettled([
            getTextProvider().generateText(params),
            getImageProvider().generateImage(params),
        ]);

        if (textResult.status === "rejected") {
            console.error(`${logContext} — TEXT generation failed:`, textResult.reason);
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
                console.error(`${logContext} — image upload failed:`, imageError);
            }
        } else if (imageResult.status === "rejected") {
            console.error(`${logContext} — IMAGE generation failed:`, imageResult.reason);
        } else {
            console.warn(`${logContext} — image generation returned no image (provider gave an empty result)`);
        }

        res.status(200).json({ success: true, data: { ...textResult.value, imageUrl } });
    } catch (error) {
        next(error);
    }
}
