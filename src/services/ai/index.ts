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

export type GenerationMode = 'standard' | 'premium';

function resolveModeProviderValue(
    mode: GenerationMode,
    kind: 'text' | 'image',
): string {
    const legacyOverride = kind === 'text'
        ? process.env.TEXT_AI_PROVIDER || process.env.AI_PROVIDER
        : process.env.IMAGE_AI_PROVIDER || process.env.AI_PROVIDER;

    if (mode === 'premium') {
        const premiumOverride = kind === 'text'
            ? process.env.PREMIUM_TEXT_AI_PROVIDER
            : process.env.PREMIUM_IMAGE_AI_PROVIDER;
        return premiumOverride || legacyOverride || (kind === 'text' ? 'gemini' : 'grok');
    }

    const standardOverride = kind === 'text'
        ? process.env.STANDARD_TEXT_AI_PROVIDER
        : process.env.STANDARD_IMAGE_AI_PROVIDER;
    return standardOverride || legacyOverride || 'minimax';
}

export function getModeTextProvider(mode: GenerationMode): AiProvider {
    return resolveProvider(resolveModeProviderValue(mode, 'text'));
}

export function getModeImageProvider(mode: GenerationMode): AiProvider {
    return resolveProvider(resolveModeProviderValue(mode, 'image'));
}

export function getModeTextProviderName(mode: GenerationMode): string {
    return resolveProviderName(resolveModeProviderValue(mode, 'text'));
}

export function getModeImageProviderName(mode: GenerationMode): string {
    return resolveProviderName(resolveModeProviderValue(mode, 'image'));
}

export function getImageProviderName(): string {
    return resolveProviderName(process.env.IMAGE_AI_PROVIDER || process.env.AI_PROVIDER);
}

export * from "./types.js";
