import { AdCopy, AdCopyParams, AiProvider, GeneratedImage } from "./types.js";
import { buildAdCopyPrompt, buildImagePrompt, IMAGE_ASPECT_RATIOS, IMAGE_DIMENSIONS } from "./prompts.js";

const TEXT_MODEL = process.env.MINIMAX_TEXT_MODEL || "abab6.5s-chat";
const IMAGE_MODEL = process.env.MINIMAX_IMAGE_MODEL || "image-01";
const BASE_URL = "https://api.minimax.io/v1";
const IMAGE_MAX_ATTEMPTS = Math.max(1, Number(process.env.MINIMAX_IMAGE_MAX_ATTEMPTS || 2));
const IMAGE_RETRY_DELAY_MS = Math.max(0, Number(process.env.MINIMAX_IMAGE_RETRY_DELAY_MS || 1500));

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

function firstString(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = firstString(item);
            if (found) return found;
        }
    }

    return null;
}

function firstBase64Image(data: any): string | null {
    const imageData = data?.data ?? {};
    const candidates = [
        imageData.image_base64,
        imageData.image_base64s,
        imageData.base64,
        imageData.images,
        data?.image_base64,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            for (const item of candidate) {
                const found = typeof item === "object" && item !== null
                    ? firstString((item as { image_base64?: unknown; base64?: unknown; b64_json?: unknown }).image_base64)
                        ?? firstString((item as { image_base64?: unknown; base64?: unknown; b64_json?: unknown }).base64)
                        ?? firstString((item as { image_base64?: unknown; base64?: unknown; b64_json?: unknown }).b64_json)
                    : firstString(item);
                if (found && !/^https?:\/\//i.test(found)) return stripDataUrlPrefix(found);
            }
        } else {
            const found = firstString(candidate);
            if (found && !/^https?:\/\//i.test(found)) return stripDataUrlPrefix(found);
        }
    }

    return null;
}

function firstImageUrl(data: any): string | null {
    const imageData = data?.data ?? {};
    return firstString(imageData.image_urls)
        ?? firstString(imageData.image_url)
        ?? firstString(imageData.images)
        ?? firstString(data?.image_urls)
        ?? firstString(data?.image_url);
}

function isRetryableImageError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /timeout|timed out|temporar|unavailable|connection reset|\b5\d\d\b/i.test(message);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function stripDataUrlPrefix(base64Image: string): string {
    const commaIndex = base64Image.indexOf(",");
    return base64Image.startsWith("data:image/") && commaIndex >= 0
        ? base64Image.slice(commaIndex + 1)
        : base64Image;
}

function extensionFromContentType(contentType: string): string {
    if (contentType.includes("png")) return "png";
    if (contentType.includes("webp")) return "webp";
    return "jpg";
}

async function downloadImage(url: string): Promise<GeneratedImage> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Minimax image download failed: ${response.status} ${await response.text()}`);
    }

    const mimeType = response.headers.get("content-type") || "image/jpeg";
    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType,
        extension: extensionFromContentType(mimeType),
    };
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
        prompt_optimizer: false,
        ...(supportsCustomDimensions && dimensions
            ? dimensions
            : { aspect_ratio: IMAGE_ASPECT_RATIOS[params.platform] || "1:1" }),
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt += 1) {
        try {
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
            const statusCode = data?.base_resp?.status_code;
            if (statusCode !== undefined && Number(statusCode) !== 0) {
                throw new Error(`Minimax image generation failed: ${data?.base_resp?.status_msg || statusCode}`);
            }

            const base64Image = firstBase64Image(data);
            if (base64Image) {
                return {
                    buffer: Buffer.from(base64Image, "base64"),
                    mimeType: "image/jpeg",
                    extension: "jpg",
                };
            }

            const imageUrl = firstImageUrl(data);
            if (imageUrl) {
                return downloadImage(imageUrl);
            }

            console.warn("[minimax.provider] generateImage returned no image payload — response:", data);
            return null;
        } catch (error) {
            lastError = error;
            if (attempt === IMAGE_MAX_ATTEMPTS || !isRetryableImageError(error)) {
                throw error;
            }

            console.warn(`[minimax.provider] image attempt ${attempt}/${IMAGE_MAX_ATTEMPTS} failed; retrying`, error);
            await delay(IMAGE_RETRY_DELAY_MS * attempt);
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Minimax image generation failed");
}

export const minimaxProvider: AiProvider = { generateText, generateImage };
