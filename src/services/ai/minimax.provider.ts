import { AdCopy, AdCopyParams, AiProvider, GeneratedImage } from "./types.js";
import { buildAdCopyPrompt, buildImagePrompt, IMAGE_ASPECT_RATIOS, IMAGE_DIMENSIONS } from "./prompts.js";

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
            messages: [{ role: "user", content: buildAdCopyPrompt(params) }],
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
    const dimensions = IMAGE_DIMENSIONS[params.platform];
    const prompt = buildImagePrompt(params).slice(0, 1500);
    const supportsCustomDimensions = IMAGE_MODEL === "image-01";
    const imagePayload = {
        model: IMAGE_MODEL,
        prompt,
        response_format: "base64",
        n: 1,
        prompt_optimizer: true,
        ...(supportsCustomDimensions && dimensions
            ? dimensions
            : { aspect_ratio: IMAGE_ASPECT_RATIOS[params.platform] || "1:1" }),
    };

    const response = await fetch(`${BASE_URL}/image_generation`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(imagePayload),
    });

    if (!response.ok) {
        throw new Error(`Minimax image generation failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const base64Image = data?.data?.image_base64?.[0];
    if (!base64Image) {
        console.warn("[minimax.provider] generateImage returned no base64 image — response:", data);
        return null;
    }

    return {
        buffer: Buffer.from(base64Image, "base64"),
        mimeType: "image/jpeg",
        extension: "jpg",
    };
}

export const minimaxProvider: AiProvider = { generateText, generateImage };
