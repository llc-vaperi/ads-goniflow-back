import { AdCopy, AdCopyParams, AiProvider, GeneratedImage } from "./types.js";

const TEXT_MODEL = process.env.MINIMAX_TEXT_MODEL || "abab6.5s-chat";
const IMAGE_MODEL = process.env.MINIMAX_IMAGE_MODEL || "image-01";
const BASE_URL = "https://api.minimax.io/v1";

function getApiKey(): string {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
        throw new Error("Missing MINIMAX_API_KEY environment variable");
    }
    return apiKey;
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
    const apiKey = getApiKey();
    const response = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: TEXT_MODEL,
            messages: [{ role: "user", content: buildTextPrompt(params) }],
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        throw new Error(`Minimax text generation failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return JSON.parse(content ?? "{}");
}

async function generateImage(params: AdCopyParams): Promise<GeneratedImage | null> {
    const apiKey = getApiKey();
    const response = await fetch(`${BASE_URL}/image_generation`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: IMAGE_MODEL,
            prompt: buildImagePrompt(params),
            aspect_ratio: "1:1",
            response_format: "url",
            n: 1,
        }),
    });

    if (!response.ok) {
        console.warn(`[minimax.provider] generateImage request failed: ${response.status} ${await response.text()}`);
        return null;
    }

    const data = await response.json();
    const url = data?.data?.image_urls?.[0];
    if (!url) {
        console.warn("[minimax.provider] generateImage returned no image URL — response:", data);
        return null;
    }
    return { url };
}

export const minimaxProvider: AiProvider = { generateText, generateImage };
