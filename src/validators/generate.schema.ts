import { z } from "zod";

export const generateTextSchema = z.object({
    platform: z.string().trim().min(1, "platform is required"),
    tone: z.string().trim().min(1, "tone is required"),
    textPrompt: z.string().trim().max(2000).optional(),
});

export const generateImageSchema = z.object({
    platform: z.string().trim().min(1, "platform is required"),
    tone: z.string().trim().min(1, "tone is required"),
    imagePrompt: z.string().trim().max(2000).optional(),
});
