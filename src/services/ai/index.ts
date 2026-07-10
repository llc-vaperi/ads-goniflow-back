import { AiProvider } from "./types.js";
import { geminiProvider } from "./gemini.provider.js";
import { grokProvider } from "./grok.provider.js";

function resolveProvider(envValue: string | undefined): AiProvider {
    return envValue === "grok" ? grokProvider : geminiProvider;
}

// AI_PROVIDER is the shared default; TEXT_AI_PROVIDER / IMAGE_AI_PROVIDER override it
// independently, so text and image generation can use different providers (e.g. Gemini
// for text + Grok for images) without touching code — just env vars.
export function getTextProvider(): AiProvider {
    return resolveProvider(process.env.TEXT_AI_PROVIDER || process.env.AI_PROVIDER);
}

export function getImageProvider(): AiProvider {
    return resolveProvider(process.env.IMAGE_AI_PROVIDER || process.env.AI_PROVIDER);
}

export * from "./types.js";
