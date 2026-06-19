import { AuthService } from "../services/auth.service.js";
const authService = new AuthService();
export async function register(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, error: "Email and password are required" });
            return;
        }
        const data = await authService.signUp(email, password);
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
export async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, error: "Email and password are required" });
            return;
        }
        const data = await authService.signIn(email, password);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
export async function logout(req, res, next) {
    try {
        await authService.signOut();
        res.status(200).json({ success: true, message: "Logged out successfully" });
    }
    catch (error) {
        next(error);
    }
}
export async function forgotPassword(req, res, next) {
    try {
        const { email, redirectTo } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: "Email is required" });
            return;
        }
        const redirectUrl = redirectTo || "http://localhost:3000/reset-password";
        const data = await authService.forgotPassword(email, redirectUrl);
        res.status(200).json({ success: true, message: "Password reset link sent successfully", data });
    }
    catch (error) {
        next(error);
    }
}
export async function resetPassword(req, res, next) {
    try {
        const { newPassword } = req.body;
        if (!newPassword) {
            res.status(400).json({ success: false, error: "New password is required" });
            return;
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const token = authHeader.split(" ")[1];
        const data = await authService.resetPassword(token, newPassword);
        res.status(200).json({ success: true, message: "Password reset successfully", data });
    }
    catch (error) {
        next(error);
    }
}
export async function getMe(req, res, next) {
    try {
        res.status(200).json({ success: true, user: req.user });
    }
    catch (error) {
        next(error);
    }
}
