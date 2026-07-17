export const allowedOrigins = process.env.CORS_URL
    ? process.env.CORS_URL.split(",").map((origin) => origin.trim())
    : ["http://localhost:3000", "http://localhost:3001"];
