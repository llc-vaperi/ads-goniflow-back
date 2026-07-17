import express from "express";
import cors from "cors";
import helmet from "helmet";
import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import { globalErrorHandler } from "./middlewares/error.middleware.js";
import { allowedOrigins } from "./config/corsOrigins.js";

const app = express();

app.set("trust proxy", 1);

// Middlewares
app.use(helmet());
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());


// Default route
app.get("/", (req, res) => {
    res.json("API is working");
});

app.use("/api/v1", apiLimiter, router);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
