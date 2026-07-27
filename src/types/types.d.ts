import { User } from "@supabase/supabase-js";

declare global {
    namespace Express {
        interface Request {
            user?: User;
            rawBody?: Buffer;
            adminRole?: "owner" | "admin" | "viewer";
        }
    }
}
