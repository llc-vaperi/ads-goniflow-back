import { z } from "zod";

export const adjustUserCreditsSchema = z.object({
    bucket: z.enum(["promo", "paid"]),
    amount: z.number().int().min(-100000).max(100000).refine(
        (amount) => amount !== 0,
        "Amount cannot be zero",
    ),
    reason: z.string().trim().min(3).max(300),
});
