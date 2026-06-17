import { supabase } from "../config/supabase.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

export class AuthService {
    async signUp(email: string, password: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data;
    }

    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    }

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    async forgotPassword(email: string, redirectTo: string) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
        });
        if (error) throw error;
        return data;
    }

    async resetPassword(accessToken: string, newPassword: string) {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });

        // Set the session context for this client instance
        const { error: sessionError } = await userClient.auth.setSession({
            access_token: accessToken,
            refresh_token: accessToken, // Use access token as a fallback to satisfy GoTrue validation
        });
        if (sessionError) throw sessionError;

        const { data, error } = await userClient.auth.updateUser({
            password: newPassword,
        });
        if (error) throw error;
        return data;
    }
}
