import { Request, Response, NextFunction } from "express";
import { Type } from "@google/genai";
import { supabase } from "../config/supabase.js";
import { getGemini } from "../config/gemini.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

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
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: adSchema,
            },
        });

        const parsed = JSON.parse(response.text ?? "{}");

        res.status(200).json({ success: true, data: parsed });
    } catch (error) {
        next(error);
    }
}
