import { z } from "zod";

export const generateAdSchema = z.object({
    platform: z.string().trim().min(1, "platform is required"),
    tone: z.string().trim().min(1, "tone is required"),
    textPrompt: z.string().trim().max(2000).optional(),
    imagePrompt: z.string().trim().max(2000).optional(),
});
