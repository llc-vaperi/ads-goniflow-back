export interface AdCopyParams {
    platform: string;
    tone: string;
    projectName: string;
    projectDescription: string;
    projectLink: string;
    textPrompt?: string;
    imagePrompt?: string;
}

export interface AdCopy {
    headline: string;
    text: string;
    cta: string;
    hashtags: string[];
}

export type GeneratedImage = { buffer: Buffer; mimeType: string; extension: string } | { url: string };

export interface AiProvider {
    generateText(params: AdCopyParams): Promise<AdCopy>;
    generateImage(params: AdCopyParams): Promise<GeneratedImage | null>;
}
