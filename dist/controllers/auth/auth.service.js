import { supabase } from "../../config/supabase.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
export async function signUp(email, password, redirectTo) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: redirectTo || "http://localhost:3000/login",
        },
    });
    if (error)
        throw error;
    return data;
}
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error)
        throw error;
    return data;
}
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error)
        throw error;
}
export async function forgotPassword(email, redirectTo) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });
    if (error)
        throw error;
    return data;
}
export async function resetPassword(accessToken, newPassword) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    const { error: sessionError } = await userClient.auth.setSession({
        access_token: accessToken,
        refresh_token: accessToken,
    });
    if (sessionError)
        throw sessionError;
    const { data, error } = await userClient.auth.updateUser({
        password: newPassword,
    });
    if (error)
        throw error;
    return data;
}
