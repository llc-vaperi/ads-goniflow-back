import express from "express";
import cors from "cors";
import router from "./routes/route.js";
const app = express();
// Middlewares
app.use(cors());
app.use(express.json());
// Default route
app.get("/", (req, res) => {
    res.json("API is working. Access endpoints via /api/users");
});
app.use("/api/v1", router);
export default app;
