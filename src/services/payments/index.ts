import { stripeProvider } from "./stripe.provider.js";
import { PaymentProvider } from "./types.js";

// Only Stripe is wired up right now. Kept as a function (rather than
// exporting stripeProvider directly) so call sites don't need to change if a
// second provider is reintroduced later.
export function getActivePaymentProvider(): PaymentProvider {
    return stripeProvider;
}

export * from "./types.js";
