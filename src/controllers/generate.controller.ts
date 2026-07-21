import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";
import { uploadBufferToStorage } from "../services/storage.service.js";
import { getTextProvider, getImageProvider, getTextProviderName, getImageProviderName } from "../services/ai/index.js";

async function loadProjectParams(
    userId: string,
    projectId: string,
    body: { platform: string; tone: string; textPrompt?: string; imagePrompt?: string }
) {
    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("name, description, link")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();

    if (projectError || !project) {
        return null;
    }

    return {
        platform: body.platform,
        tone: body.tone,
        textPrompt: body.textPrompt,
        imagePrompt: body.imagePrompt,
        projectName: project.name,
        projectDescription: project.description,
        projectLink: project.link,
    };
}

export async function generateAdText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const params = await loadProjectParams(userId, String(projectId), req.body);
        if (!params) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        const logContext = `[generate-text] provider=${getTextProviderName()} projectId=${projectId} platform=${params.platform} tone=${params.tone}`;

        try {
            const textResult = await getTextProvider().generateText(params);
            res.status(200).json({ success: true, data: textResult });
        } catch (textError) {
            console.error(`${logContext} — TEXT generation failed:`, textError);
            throw textError;
        }
    } catch (error) {
        next(error);
    }
}

export async function generateAdImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const params = await loadProjectParams(userId, String(projectId), req.body);
        if (!params) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        const logContext = `[generate-image] provider=${getImageProviderName()} projectId=${projectId} platform=${params.platform} tone=${params.tone}`;

        let imageUrl: string | null = null;
        try {
            const image = await getImageProvider().generateImage(params);
            if (image) {
                imageUrl = "url" in image
                    ? image.url
                    : await uploadBufferToStorage(userId, image.buffer, image.mimeType, image.extension);
            } else {
                throw new Error("Image generation returned an empty result");
            }
        } catch (imageError) {
            console.error(`${logContext} — IMAGE generation failed:`, imageError);
            throw imageError;
        }

        res.status(200).json({ success: true, data: { imageUrl } });
    } catch (error) {
        next(error);
    }
}
