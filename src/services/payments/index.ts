import { bogProvider } from "./bog.provider.js";
import { stripeProvider } from "./stripe.provider.js";
import { PaymentProvider } from "./types.js";

// PAYMENT_PROVIDER selects the single active provider — flip this env var to
// switch payment backends without touching code (e.g. Stripe now, back to
// BOG once its merchant account is branded/activated). Defaults to "bog" so
// any deployment that hasn't set the var keeps its current behavior.
export function getActivePaymentProvider(): PaymentProvider {
    return process.env.PAYMENT_PROVIDER === "stripe" ? stripeProvider : bogProvider;
}

export * from "./types.js";
