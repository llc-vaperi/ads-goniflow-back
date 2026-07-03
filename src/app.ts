import express from "express";
import cors from "cors";
import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import { globalErrorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = process.env.CORS_URL
    ? process.env.CORS_URL.split(",").map((origin) => origin.trim())
    : ["http://localhost:3000", "http://localhost:3001"];

// Middlewares
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());


// Default route
app.get("/", (req, res) => {
    res.json("API is working. Access endpoints via /api/users");
});

app.use("/api/v1", apiLimiter, router);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
