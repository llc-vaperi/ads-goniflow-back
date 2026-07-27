import { z } from "zod";

export const createCreditPurchaseSchema = z.object({
    productId: z.enum(["flex-20", "value-240"]),
    quantity: z.number().int().min(1).max(100),
});

