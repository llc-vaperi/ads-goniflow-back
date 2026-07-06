import { Request, Response, NextFunction } from "express";
import { Type, Modality } from "@google/genai";
import { supabase } from "../config/supabase.js";
import { getGemini } from "../config/gemini.js";
import { uploadBufferToStorage } from "../services/storage.service.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

const MIME_TO_EXT: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
};

const adSchema = {
    type: Type.OBJECT,
    properties: {
        headline: { type: Type.STRING },
        text: { type: Type.STRING },
        cta: { type: Type.STRING },
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["headline", "text", "cta", "hashtags"],
};

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

        const prompt = `შენ ხარ სარეკლამო კოპირაითერი. დაწერე რეკლამის ტექსტი ქართულ ენაზე ${platform} პლატფორმისთვის, ${tone} ტონით.

პროექტის ინფორმაცია:
- სახელი: ${project.name}
- აღწერა: ${project.description || "არ არის მითითებული"}
- ბმული: ${project.link || "არ არის მითითებული"}

${textPrompt ? `დამატებითი ინსტრუქცია: ${textPrompt}` : ""}
${imagePrompt ? `სურათის კონტექსტი: ${imagePrompt}` : ""}

დააბრუნე headline (მოკლე სათაური), text (რეკლამის ძირითადი ტექსტი), cta (მოქმედებისკენ მოწოდება) და hashtags (რელევანტური ჰეშტეგების მასივი).`;

        const ai = getGemini();

        const textCall = ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: adSchema,
            },
        });

        const imagePromptText = imagePrompt
            || `რეკლამის სურათი ${platform} პლატფორმისთვის. პროექტი: ${project.name}. აღწერა: ${project.description || "არ არის მითითებული"}.`;

        const imageCall = ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: imagePromptText,
            config: {
                responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
        });

        const [textResult, imageResult] = await Promise.allSettled([textCall, imageCall]);

        if (textResult.status === "rejected") {
            throw textResult.reason;
        }

        const parsed = JSON.parse(textResult.value.text ?? "{}");

        let imageUrl: string | null = null;
        if (imageResult.status === "fulfilled") {
            try {
                const parts = imageResult.value.candidates?.[0]?.content?.parts ?? [];
                const imagePart = parts.find((p) => p.inlineData?.data);
                if (imagePart?.inlineData?.data) {
                    const mimeType = imagePart.inlineData.mimeType || "image/png";
                    const extension = MIME_TO_EXT[mimeType] || "png";
                    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
                    imageUrl = await uploadBufferToStorage(userId, buffer, mimeType, extension);
                }
            } catch (imageError) {
                console.error("Image generation/upload failed:", imageError);
            }
        } else {
            console.error("Gemini image generation failed:", imageResult.reason);
        }

        res.status(200).json({ success: true, data: { ...parsed, imageUrl } });
    } catch (error) {
        next(error);
    }
}
