import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
export const BUCKET = "ad-assets";
export async function uploadBufferToStorage(userId, buffer, contentType, extension) {
    const path = `${userId}/${randomUUID()}.${extension}`;
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, {
        contentType,
        upsert: false,
    });
    if (error)
        throw error;
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}
