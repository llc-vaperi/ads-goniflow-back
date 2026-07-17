import { AiProvider } from "./types.js";
import { geminiProvider } from "./gemini.provider.js";
import { grokProvider } from "./grok.provider.js";
import { minimaxProvider } from "./minimax.provider.js";

function resolveProvider(envValue: string | undefined): AiProvider {
    switch (envValue) {
        case "grok":
            return grokProvider;
        case "minimax":
            return minimaxProvider;
        default:
            return geminiProvider;
    }
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

function resolveProviderName(envValue: string | undefined): string {
    return envValue === "grok" || envValue === "minimax" ? envValue : "gemini";
}

export function getTextProviderName(): string {
    return resolveProviderName(process.env.TEXT_AI_PROVIDER || process.env.AI_PROVIDER);
}

export function getImageProviderName(): string {
    return resolveProviderName(process.env.IMAGE_AI_PROVIDER || process.env.AI_PROVIDER);
}

export * from "./types.js";
