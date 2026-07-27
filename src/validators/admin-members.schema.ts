import { z } from "zod";

export const addAdminMemberSchema = z.object({
    email: z.string().trim().email().max(320),
    role: z.enum(["owner", "admin", "viewer"]),
});

export const updateAdminMemberSchema = z.object({
    role: z.enum(["owner", "admin", "viewer"]),
    isActive: z.boolean(),
});
