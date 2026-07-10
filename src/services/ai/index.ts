import { AiProvider } from "./types.js";
import { geminiProvider } from "./gemini.provider.js";
import { grokProvider } from "./grok.provider.js";

export function getProvider(): AiProvider {
    return process.env.AI_PROVIDER === "grok" ? grokProvider : geminiProvider;
}

export * from "./types.js";
