import { createVerify } from "node:crypto";
import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { createCreditPurchase } from "../credit-purchases.service.js";
import { throwSafeDbError } from "../../utils/dbError.js";
import { markPurchasePending, paymentError, reuseExistingCheckout } from "./shared.js";
import { PaymentCheckoutResult, PaymentProvider } from "./types.js";

interface BogConfig {
    apiBaseUrl: string;
    oauthUrl: string;
    clientId: string;
    clientSecret: string;
    returnUrl: string;
    callbackUrl: string;
    callbackPublicKey: string;
}

interface BogTokenResponse {
    access_token: string;
    expires_in: number;
}

interface BogCreateOrderResponse {
    id: string;
    _links?: {
        redirect?: { href?: string };
    };
}

interface BogPaymentDetails {
    order_id: string;
    external_order_id?: string;
    order_status?: {
        key?: string;
    };
    purchase_units?: {
        request_amount?: string | number;
        transfer_amount?: string | number;
        currency_code?: string;
    };
}

const DEFAULT_BOG_CALLBACK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`;

let tokenCache:
    | {
        token: string;
        expiresAt: number;
    }
    | undefined;

function isConfigured(): boolean {
    return Boolean(
        process.env.BOG_CLIENT_ID
        && process.env.BOG_CLIENT_SECRET
        && (process.env.PAYMENT_RETURN_URL || process.env.BOG_RETURN_URL)
        && process.env.BOG_CALLBACK_URL,
    );
}

function getConfig(): BogConfig {
    const clientId = process.env.BOG_CLIENT_ID;
    const clientSecret = process.env.BOG_CLIENT_SECRET;
    const returnUrl = process.env.PAYMENT_RETURN_URL || process.env.BOG_RETURN_URL;
    const callbackUrl = process.env.BOG_CALLBACK_URL;

    if (!clientId || !clientSecret || !returnUrl || !callbackUrl) {
        throw paymentError(
            "Bank of Georgia payments are not configured",
            "PAYMENT_PROVIDER_NOT_CONFIGURED",
            503,
        );
    }

    return {
        apiBaseUrl: process.env.BOG_API_BASE_URL || "https://api.bog.ge/payments/v1",
        oauthUrl:
            process.env.BOG_OAUTH_URL
            || "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token",
        clientId,
        clientSecret,
        returnUrl,
        callbackUrl,
        callbackPublicKey: (
            process.env.BOG_CALLBACK_PUBLIC_KEY || DEFAULT_BOG_CALLBACK_PUBLIC_KEY
        ).replace(/\\n/g, "\n"),
    };
}

async function parseProviderResponse(response: Response): Promise<unknown> {
    return response.json().catch(() => ({}));
}

async function getAccessToken(config: BogConfig): Promise<string> {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
        return tokenCache.token;
    }

    const credentials = Buffer.from(
        `${config.clientId}:${config.clientSecret}`,
    ).toString("base64");
    const response = await fetch(config.oauthUrl, {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    const payload = await parseProviderResponse(response);
    if (!response.ok) {
        console.error("[bog] access token request failed:", response.status, payload);
        throw paymentError(
            "Payment provider authentication failed",
            "PAYMENT_PROVIDER_AUTH_FAILED",
        );
    }

    const tokenPayload = payload as Partial<BogTokenResponse>;
    if (!tokenPayload.access_token) {
        throw paymentError(
            "Payment provider returned an invalid token response",
            "PAYMENT_PROVIDER_INVALID_RESPONSE",
        );
    }

    const expiresIn = Number(tokenPayload.expires_in || 300);
    tokenCache = {
        token: tokenPayload.access_token,
        expiresAt: Date.now() + expiresIn * 1000,
    };
    return tokenCache.token;
}

async function authenticatedBogFetch(
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const config = getConfig();
    const token = await getAccessToken(config);

    return fetch(`${config.apiBaseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...init.headers,
        },
    });
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

    const reused = reuseExistingCheckout(purchase, "bog");
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

    const config = getConfig();
    const response = await authenticatedBogFetch("/ecommerce/orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept-Language": "ka",
            "Idempotency-Key": idempotencyKey || purchase.id,
        },
        body: JSON.stringify({
            callback_url: config.callbackUrl,
            external_order_id: purchase.id,
            capture: "automatic",
            purchase_units: {
                currency: "GEL",
                total_amount: purchase.amountGel,
                basket: [
                    {
                        product_id: purchase.productId,
                        description: `GoniFlow ${purchase.credits} credits`,
                        quantity: purchase.quantity,
                        unit_price: purchase.amountGel / purchase.quantity,
                        total_price: purchase.amountGel,
                    },
                ],
            },
            redirect_urls: {
                success: createReturnUrl(config.returnUrl, purchase.id, "success"),
                fail: createReturnUrl(config.returnUrl, purchase.id, "fail"),
            },
            ttl: 12,
        }),
    });
    const payload = await parseProviderResponse(response);

    if (!response.ok) {
        console.error("[bog] create order failed:", response.status, payload);
        throw paymentError(
            "Payment provider failed to create checkout",
            "PAYMENT_CREATION_FAILED",
        );
    }

    const order = payload as Partial<BogCreateOrderResponse>;
    const checkoutUrl = order._links?.redirect?.href;
    if (!order.id || !checkoutUrl) {
        throw paymentError(
            "Payment provider returned an invalid checkout response",
            "PAYMENT_PROVIDER_INVALID_RESPONSE",
        );
    }

    const pendingPurchase = await markPurchasePending(
        purchase.id,
        "bog",
        order.id,
        checkoutUrl,
    );

    return {
        purchase: pendingPurchase,
        checkoutUrl,
        orderId: order.id,
    };
}

function verifyCallbackSignature(rawBody: Buffer, signature: string): boolean {
    try {
        const verifier = createVerify("RSA-SHA256");
        verifier.update(rawBody);
        verifier.end();
        return verifier.verify(
            getConfig().callbackPublicKey,
            Buffer.from(signature, "base64"),
        );
    } catch {
        return false;
    }
}

async function getBogPaymentDetails(orderId: string): Promise<BogPaymentDetails> {
    const response = await authenticatedBogFetch(
        `/receipt/${encodeURIComponent(orderId)}`,
    );
    const payload = await parseProviderResponse(response);

    if (!response.ok) {
        console.error("[bog] payment verification failed:", response.status, payload);
        throw paymentError(
            "Payment provider verification failed",
            "PAYMENT_VERIFICATION_FAILED",
        );
    }

    return payload as BogPaymentDetails;
}

async function processCallback(orderId: string): Promise<void> {
    const payment = await getBogPaymentDetails(orderId);
    const admin = getSupabaseAdmin();
    const { data: purchase, error } = await admin
        .from("credit_purchases")
        .select("id, amount_gel, status")
        .eq("provider", "bog")
        .eq("provider_order_id", orderId)
        .single();

    if (error || !purchase) {
        throwSafeDbError(
            "lookupBogPurchase",
            error,
            "Payment purchase was not found",
            404,
        );
    }

    const status = payment.order_status?.key;
    if (status === "completed") {
        const expectedAmount = Number(purchase.amount_gel);
        const receivedAmount = Number(
            payment.purchase_units?.transfer_amount
            ?? payment.purchase_units?.request_amount,
        );
        const currency = payment.purchase_units?.currency_code;
        if (
            payment.order_id !== orderId
            || (payment.external_order_id && payment.external_order_id !== purchase.id)
            || currency !== "GEL"
            || !Number.isFinite(receivedAmount)
            || Math.abs(expectedAmount - receivedAmount) > 0.001
        ) {
            console.error("[bog] payment verification mismatch", {
                purchaseId: purchase.id,
                expectedAmount,
                receivedAmount,
                currency,
            });
            throw paymentError(
                "Payment amount verification failed",
                "PAYMENT_AMOUNT_MISMATCH",
            );
        }

        const { error: fulfillError } = await admin.rpc(
            "fulfill_credit_purchase",
            {
                p_purchase_id: purchase.id,
                p_provider: "bog",
                p_provider_order_id: orderId,
                p_metadata: {
                    verifiedStatus: status,
                    verifiedAt: new Date().toISOString(),
                },
            },
        );

        if (fulfillError) {
            throwSafeDbError(
                "fulfillBogPurchase",
                fulfillError,
                "Failed to credit paid purchase",
            );
        }
        return;
    }

    if (status === "rejected" && purchase.status !== "paid") {
        const { error: updateError } = await admin
            .from("credit_purchases")
            .update({
                status: "failed",
                updated_at: new Date().toISOString(),
                metadata: {
                    verifiedStatus: status,
                    verifiedAt: new Date().toISOString(),
                },
            })
            .eq("id", purchase.id)
            .in("status", ["created", "pending"]);

        if (updateError) {
            throwSafeDbError(
                "markBogPurchaseFailed",
                updateError,
                "Failed to update payment status",
            );
        }
    }
}

async function handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
): Promise<void> {
    const signatureHeader = headers["callback-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (!signature || !verifyCallbackSignature(rawBody, signature)) {
        throw paymentError(
            "Invalid callback signature",
            "INVALID_CALLBACK_SIGNATURE",
            401,
        );
    }

    let body: { event?: string; body?: { order_id?: string } };
    try {
        body = JSON.parse(rawBody.toString("utf8"));
    } catch {
        throw paymentError("Invalid payment callback", "INVALID_CALLBACK_PAYLOAD", 400);
    }

    const orderId = body?.body?.order_id;
    if (body?.event !== "order_payment" || typeof orderId !== "string" || !orderId.trim()) {
        throw paymentError("Invalid payment callback", "INVALID_CALLBACK_PAYLOAD", 400);
    }

    await processCallback(orderId.trim());
}

export const bogProvider: PaymentProvider = {
    name: "bog",
    isConfigured,
    createCheckout,
    handleWebhook,
};
