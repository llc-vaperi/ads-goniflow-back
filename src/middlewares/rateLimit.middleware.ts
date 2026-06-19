import rateLimit from "express-rate-limit";

// General rate limiter to prevent API abuse (DDoS protection)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        error: "Too many requests from this IP, please try again after 15 minutes",
    },
});

// Strict rate limiter for sensitive authentication endpoints (brute-force protection)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: "Too many login/registration attempts. Please try again after 15 minutes",
    },
});
