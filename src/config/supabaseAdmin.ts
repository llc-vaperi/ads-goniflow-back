import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let client: SupabaseClient | undefined;

// Service-role client — bypasses RLS, used only for server-side storage uploads.
// Never expose this client or its key to the frontend.
// Lazily initialized so the server can still boot (and serve auth/projects routes)
// before SUPABASE_SERVICE_ROLE_KEY is configured; it only throws when uploads are used.
export function getSupabaseAdmin(): SupabaseClient {
    if (client) return client;

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable");
    }

    client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
    });
    return client;
}
