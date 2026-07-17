import { z } from "zod";

// Kept in sync with the strong-password regex enforced in auth.controller.ts
const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`-])[a-zA-Z0-9!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`-]{8,}$/,
        "Password must contain only Latin characters and include at least one uppercase letter, one lowercase letter, one number, and one special character"
    );

export const registerSchema = z.object({
    email: z.string().trim().email(),
    password: passwordSchema,
    redirectTo: z.string().url().optional(),
});

export const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
    email: z.string().trim().email(),
    redirectTo: z.string().url().optional(),
});

export const resetPasswordSchema = z.object({
    newPassword: passwordSchema,
});
