import { CustomError } from "../middlewares/error.middleware.js";

// Logs the raw DB error server-side but throws a generic, safe message so
// internal Postgres/Supabase details (schema, constraints, etc.) never reach the client.
export function throwSafeDbError(context: string, dbError: unknown, message: string, statusCode = 500): never {
    console.error(`[db] ${context}:`, dbError);
    const error = new Error(message) as CustomError;
    error.statusCode = statusCode;
    throw error;
}
