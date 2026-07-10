import OpenAI from "openai";
import { AdCopy, AdCopyParams, AiProvider, GeneratedImage } from "./types.js";

// grok-4.5 is region-restricted (blocked in the EU as of mid-2026) — grok-4.3 has no such
// restriction, so it's the safer default; override with GROK_TEXT_MODEL where 4.5 is available.
const TEXT_MODEL = process.env.GROK_TEXT_MODEL || "grok-4.3";
const IMAGE_MODEL = process.env.GROK_IMAGE_MODEL || "grok-imagine-image-quality";

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

const NO_TEXT_INSTRUCTION = "სურათზე არ უნდა იყოს არანაირი ტექსტი, წარწერა, ასოები, ციფრები ან watermark — მხოლოდ სუფთა ვიზუალი.";

function buildImagePrompt(params: AdCopyParams): string {
    const { platform, projectName, projectDescription, imagePrompt } = params;
    const basePrompt = imagePrompt
        || `რეკლამის სურათი ${platform} პლატფორმისთვის. პროექტი: ${projectName}. აღწერა: ${projectDescription || "არ არის მითითებული"}.`;
    return `${basePrompt} ${NO_TEXT_INSTRUCTION}`;
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
    if (!url) {
        console.warn("[grok.provider] generateImage returned no image URL — response.data:", response.data);
        return null;
    }
    return { url };
}

export const grokProvider: AiProvider = { generateText, generateImage };
