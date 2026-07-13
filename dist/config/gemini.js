import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
let client;
// Lazily initialized so the server can still boot before GEMINI_API_KEY
// is configured; it only throws when the generate endpoint is used.
export function getGemini() {
    if (client)
        return client;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    client = new GoogleGenAI({ apiKey });
    return client;
}
