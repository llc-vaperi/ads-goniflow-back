import { Type, Modality } from "@google/genai";
import { getGemini } from "../../config/gemini.js";
import { AdCopy, AdCopyParams, AiProvider, GeneratedImage } from "./types.js";

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

function buildTextPrompt(params: AdCopyParams): string {
    const { platform, tone, projectName, projectDescription, projectLink, textPrompt, imagePrompt } = params;
    return `შენ ხარ სარეკლამო კოპირაითერი. დაწერე რეკლამის ტექსტი ქართულ ენაზე ${platform} პლატფორმისთვის, ${tone} ტონით.

პროექტის ინფორმაცია:
- სახელი: ${projectName}
- აღწერა: ${projectDescription || "არ არის მითითებული"}
- ბმული: ${projectLink || "არ არის მითითებული"}

${textPrompt ? `დამატებითი ინსტრუქცია: ${textPrompt}` : ""}
${imagePrompt ? `სურათის კონტექსტი: ${imagePrompt}` : ""}

მნიშვნელოვანი: პროექტის სახელი ("${projectName}") და ბმული ("${projectLink || ""}") ზუსტად ისე გამოიყენე, როგორც მოცემულია — არ თარგმნო და არ გადმოწერო ქართული ასოებით (ტრანსლიტერაცია), დატოვე ორიგინალი ლათინური/ორიგინალური დამწერლობით.

დასაშვებია მინიმალურად, ზომიერად გამოიყენო რელევანტური emoji/აიკონები (headline-ში და text-ში) რომ ტექსტი უფრო ცოცხალი იყოს — მაგრამ არ გადატვირთო, მაქსიმუმ 1-2 emoji მთელ პოსტში საკმარისია, თუ საერთოდ საჭიროა.

დააბრუნე headline (მოკლე სათაური), text (რეკლამის ძირითადი ტექსტი), cta (მოქმედებისკენ მოწოდება) და hashtags (რელევანტური ჰეშტეგების მასივი).`;
}

const NO_TEXT_INSTRUCTION = "სურათზე არ უნდა იყოს არანაირი ტექსტი, წარწერა, ასოები, ციფრები ან watermark — მხოლოდ სუფთა ვიზუალი.";

function buildImagePrompt(params: AdCopyParams): string {
    const { platform, projectName, projectDescription, imagePrompt } = params;
    const basePrompt = imagePrompt
        || `რეკლამის სურათი ${platform} პლატფორმისთვის. პროექტი: ${projectName}. აღწერა: ${projectDescription || "არ არის მითითებული"}.`;
    return `${basePrompt} ${NO_TEXT_INSTRUCTION}`;
}

async function generateText(params: AdCopyParams): Promise<AdCopy> {
    const ai = getGemini();
    const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildTextPrompt(params),
        config: {
            responseMimeType: "application/json",
            responseSchema: adSchema,
        },
    });

    return JSON.parse(response.text ?? "{}");
}

async function generateImage(params: AdCopyParams): Promise<GeneratedImage | null> {
    const ai = getGemini();
    const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: buildImagePrompt(params),
        config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
        console.warn(
            "[gemini.provider] generateImage returned no inline image data — finishReason:",
            response.candidates?.[0]?.finishReason,
            "promptFeedback:",
            response.promptFeedback
        );
        return null;
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const extension = MIME_TO_EXT[mimeType] || "png";
    const buffer = Buffer.from(imagePart.inlineData.data, "base64");

    return { buffer, mimeType, extension };
}

export const geminiProvider: AiProvider = { generateText, generateImage };
