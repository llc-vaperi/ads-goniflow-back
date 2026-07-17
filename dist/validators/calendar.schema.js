import { z } from "zod";
const ALLOWED_PLATFORMS = ["facebook", "instagram", "linkedin", "x"];
const ALLOWED_TONES = ["professional", "friendly", "funny", "bold"];
export const createCalendarEventSchema = z.object({
    project_id: z.string().uuid().optional().or(z.literal("")).or(z.null()),
    platform: z.enum(ALLOWED_PLATFORMS).optional(),
    tone: z.enum(ALLOWED_TONES).optional(),
    headline: z.string().trim().max(300).optional().or(z.literal("")),
    text: z.string().trim().max(2000).optional().or(z.literal("")),
    cta: z.string().trim().max(100).optional().or(z.literal("")),
    start_time: z.string().min(1, "start_time is required"),
    all_day: z.boolean().optional(),
});
export const updateCalendarEventSchema = createCalendarEventSchema.partial();
