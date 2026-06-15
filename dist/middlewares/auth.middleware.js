import { supabase } from "../config/supabase.js";
export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ success: false, error: "Access token is missing or invalid" });
            return;
        }
        const token = authHeader.split(" ")[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        next(error);
    }
};
