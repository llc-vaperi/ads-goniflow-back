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
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
            auth: {
                persistSession: false,
            },
        });

        const { data, error } = await userClient.auth.updateUser({
            password: newPassword,
        });
        if (error) throw error;
        return data;
    }
}
