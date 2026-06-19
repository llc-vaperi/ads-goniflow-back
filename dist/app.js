import express from "express";
import cors from "cors";
import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import { globalErrorHandler } from "./middlewares/error.middleware.js";
const app = express();
// Middlewares
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
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
