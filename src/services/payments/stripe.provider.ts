import Stripe from "stripe";
import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { createCreditPurchase } from "../credit-purchases.service.js";
import { throwSafeDbError } from "../../utils/dbError.js";
import { markPurchasePending, paymentError, reuseExistingCheckout } from "./shared.js";
import { PaymentCheckoutResult, PaymentProvider } from "./types.js";

let stripeClient: Stripe | undefined;

function isConfigured(): boolean {
    return Boolean(
        process.env.STRIPE_SECRET_KEY
        && process.env.STRIPE_WEBHOOK_SECRET
        && (process.env.PAYMENT_RETURN_URL || process.env.BOG_RETURN_URL),
    );
}

function getStripeClient(): Stripe {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw paymentError(
            "Stripe payments are not configured",
            "PAYMENT_PROVIDER_NOT_CONFIGURED",
            503,
        );
    }
    if (!stripeClient) {
        stripeClient = new Stripe(secretKey);
    }
    return stripeClient;
}

function getReturnUrl(): string {
    const returnUrl = process.env.PAYMENT_RETURN_URL || process.env.BOG_RETURN_URL;
    if (!returnUrl) {
        throw paymentError(
            "Stripe payments are not configured",
            "PAYMENT_PROVIDER_NOT_CONFIGURED",
            503,
        );
    }
    return returnUrl;
}

function createReturnUrl(
    baseUrl: string,
    purchaseId: string,
    result: "success" | "fail",
): string {
    const url = new URL(baseUrl);
    url.searchParams.set("purchase", purchaseId);
    url.searchParams.set("payment", result);
    return url.toString();
}

async function createCheckout(
    userId: string,
    productId: string,
    quantity: number,
    idempotencyKey?: string,
): Promise<PaymentCheckoutResult> {
    const purchase = await createCreditPurchase(
        userId,
        productId,
        quantity,
        idempotencyKey,
    );

    const reused = reuseExistingCheckout(purchase, "stripe");
    if (reused) {
        return reused;
    }

    if (purchase.status !== "created") {
        throw paymentError(
            "Purchase cannot be initialized for payment",
            "PURCHASE_NOT_PAYABLE",
            409,
        );
    }

    const stripe = getStripeClient();
    const returnUrl = getReturnUrl();

    let session: Stripe.Checkout.Session;
    try {
        session = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                line_items: [
                    {
                        price_data: {
                            currency: "gel",
                            product_data: {
                                name: `GoniFlow ${purchase.credits} credits`,
                            },
                            unit_amount: Math.round(purchase.amountGel * 100),
                        },
                        quantity: 1,
                    },
                ],
                success_url: createReturnUrl(returnUrl, purchase.id, "success"),
                cancel_url: createReturnUrl(returnUrl, purchase.id, "fail"),
                metadata: { purchaseId: purchase.id },
                client_reference_id: purchase.id,
            },
            { idempotencyKey: idempotencyKey || purchase.id },
        );
    } catch (err) {
        console.error("[stripe] create checkout session failed:", err);
        throw paymentError(
            "Payment provider failed to create checkout",
            "PAYMENT_CREATION_FAILED",
        );
    }

    if (!session.url) {
        throw paymentError(
            "Payment provider returned an invalid checkout response",
            "PAYMENT_PROVIDER_INVALID_RESPONSE",
        );
    }

    const pendingPurchase = await markPurchasePending(
        purchase.id,
        "stripe",
        session.id,
        session.url,
    );

    return {
        purchase: pendingPurchase,
        checkoutUrl: session.url,
        orderId: session.id,
    };
}

async function handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw paymentError(
            "Stripe payments are not configured",
            "PAYMENT_PROVIDER_NOT_CONFIGURED",
            503,
        );
    }

    const signatureHeader = headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
        throw paymentError(
            "Invalid webhook signature",
            "INVALID_CALLBACK_SIGNATURE",
            401,
        );
    }

    const stripe = getStripeClient();
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
        console.error("[stripe] webhook signature verification failed:", err);
        throw paymentError(
            "Invalid webhook signature",
            "INVALID_CALLBACK_SIGNATURE",
            401,
        );
    }

    if (event.type !== "checkout.session.completed") {
        return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const purchaseId = session.client_reference_id || session.metadata?.purchaseId;
    if (!purchaseId) {
        throw paymentError("Invalid payment callback", "INVALID_CALLBACK_PAYLOAD", 400);
    }

    const admin = getSupabaseAdmin();
    const { data: purchase, error } = await admin
        .from("credit_purchases")
        .select("id, amount_gel, status")
        .eq("id", purchaseId)
        .eq("provider", "stripe")
        .eq("provider_order_id", session.id)
        .single();

    if (error || !purchase) {
        throwSafeDbError(
            "lookupStripePurchase",
            error,
            "Payment purchase was not found",
            404,
        );
    }

    const expectedAmount = Number(purchase.amount_gel);
    const receivedAmount = (session.amount_total ?? 0) / 100;
    if (
        session.currency !== "gel"
        || session.payment_status !== "paid"
        || Math.abs(expectedAmount - receivedAmount) > 0.001
    ) {
        console.error("[stripe] payment verification mismatch", {
            purchaseId: purchase.id,
            expectedAmount,
            receivedAmount,
            currency: session.currency,
        });
        throw paymentError(
            "Payment amount verification failed",
            "PAYMENT_AMOUNT_MISMATCH",
        );
    }

    const { error: fulfillError } = await admin.rpc("fulfill_credit_purchase", {
        p_purchase_id: purchase.id,
        p_provider: "stripe",
        p_provider_order_id: session.id,
        p_metadata: {
            verifiedStatus: session.payment_status,
            verifiedAt: new Date().toISOString(),
        },
    });

    if (fulfillError) {
        throwSafeDbError(
            "fulfillStripePurchase",
            fulfillError,
            "Failed to credit paid purchase",
        );
    }
}

export const stripeProvider: PaymentProvider = {
    name: "stripe",
    isConfigured,
    createCheckout,
    handleWebhook,
};
