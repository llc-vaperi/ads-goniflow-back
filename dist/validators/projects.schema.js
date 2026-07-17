import { z } from "zod";
export const createProjectSchema = z.object({
    name: z.string().trim().min(1, "Project name is required").max(200),
    link: z.string().trim().url().optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    logo_url: z.string().trim().url().optional().or(z.literal("")),
});
export const updateProjectSchema = createProjectSchema;
export const saveAdSchema = z.object({
    platform: z.string().trim().min(1).optional(),
    tone: z.string().trim().min(1).optional(),
    headline: z.string().trim().max(300).optional().or(z.literal("")),
    text: z.string().trim().min(1, "Ad text is required"),
    cta: z.string().trim().max(100).optional().or(z.literal("")),
    image_url: z.string().trim().url().optional().or(z.literal("")),
});
