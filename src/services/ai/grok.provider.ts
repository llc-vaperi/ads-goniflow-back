import OpenAI from "openai";
import { AdCopy, AdCopyParams, AiProvider, GeneratedImage } from "./types.js";

const TEXT_MODEL = process.env.GROK_TEXT_MODEL || "grok-4.5";
const IMAGE_MODEL = process.env.GROK_IMAGE_MODEL || "grok-2-image";

let client: OpenAI | undefined;

function getClient(): OpenAI {
    if (client) return client;

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing XAI_API_KEY environment variable");
    }

    client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
    return client;
}

function buildTextPrompt(params: AdCopyParams): string {
    const { platform, tone, projectName, projectDescription, projectLink, textPrompt, imagePrompt } = params;
    return `შენ ხარ სარეკლამო კოპირაითერი. დაწერე რეკლამის ტექსტი ქართულ ენაზე ${platform} პლატფორმისთვის, ${tone} ტონით.

პროექტის ინფორმაცია:
- სახელი: ${projectName}
- აღწერა: ${projectDescription || "არ არის მითითებული"}
- ბმული: ${projectLink || "არ არის მითითებული"}

${textPrompt ? `დამატებითი ინსტრუქცია: ${textPrompt}` : ""}
${imagePrompt ? `სურათის კონტექსტი: ${imagePrompt}` : ""}

დააბრუნე headline (მოკლე სათაური), text (რეკლამის ძირითადი ტექსტი), cta (მოქმედებისკენ მოწოდება) და hashtags (რელევანტური ჰეშტეგების მასივი).`;
}

function buildImagePrompt(params: AdCopyParams): string {
    const { platform, projectName, projectDescription, imagePrompt } = params;
    return imagePrompt
        || `რეკლამის სურათი ${platform} პლატფორმისთვის. პროექტი: ${projectName}. აღწერა: ${projectDescription || "არ არის მითითებული"}.`;
}

async function generateText(params: AdCopyParams): Promise<AdCopy> {
    const openai = getClient();
    const response = await openai.chat.completions.create({
        model: TEXT_MODEL,
        messages: [{ role: "user", content: buildTextPrompt(params) }],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "ad_copy",
                schema: {
                    type: "object",
                    properties: {
                        headline: { type: "string" },
                        text: { type: "string" },
                        cta: { type: "string" },
                        hashtags: { type: "array", items: { type: "string" } },
                    },
                    required: ["headline", "text", "cta", "hashtags"],
                },
            },
        },
    });

    return JSON.parse(response.choices[0]?.message?.content ?? "{}");
}

async function generateImage(params: AdCopyParams): Promise<GeneratedImage | null> {
    const openai = getClient();
    const response = await openai.images.generate({
        model: IMAGE_MODEL,
        prompt: buildImagePrompt(params),
        n: 1,
    });

    const url = response.data?.[0]?.url;
    return url ? { url } : null;
}

export const grokProvider: AiProvider = { generateText, generateImage };
