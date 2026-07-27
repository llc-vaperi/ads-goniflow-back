import { CreditPurchase } from "../credit-purchases.service.js";

export interface PaymentCheckoutResult {
    purchase: CreditPurchase;
    checkoutUrl: string;
    orderId: string;
}

export interface PaymentProvider {
    name: "stripe";
    isConfigured(): boolean;
    createCheckout(
        userId: string,
        productId: string,
        quantity: number,
        idempotencyKey?: string,
    ): Promise<PaymentCheckoutResult>;
    handleWebhook(
        rawBody: Buffer,
        headers: Record<string, string | string[] | undefined>,
    ): Promise<void>;
}
