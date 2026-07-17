// Logs the raw DB error server-side but throws a generic, safe message so
// internal Postgres/Supabase details (schema, constraints, etc.) never reach the client.
export function throwSafeDbError(context, dbError, message, statusCode = 500) {
    console.error(`[db] ${context}:`, dbError);
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}
