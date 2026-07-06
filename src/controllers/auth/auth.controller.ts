import { Request, Response, NextFunction } from "express";
import { signUp, signIn, signOut, forgotPassword as reqForgotPassword, resetPassword as reqResetPassword } from "./auth.service.js";

// In production the frontend and backend typically live on different origins,
// which requires SameSite=None (and therefore Secure) for the browser to send the cookie cross-site.
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
};

// Helper function to set auth cookies
export function setAuthCookies(res: Response, session: any): void {
    if (session) {
        res.cookie("sb-access-token", session.access_token, {
            ...cookieOptions,
            maxAge: session.expires_in * 1000,
        });
        res.cookie("sb-refresh-token", session.refresh_token, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
    }
}

// Helper function to clear auth cookies
export function clearAuthCookies(res: Response): void {
    res.clearCookie("sb-access-token", cookieOptions);
    res.clearCookie("sb-refresh-token", cookieOptions);
}

// Helper function to sanitize user object to only expose safe/necessary fields
export function sanitizeUser(user: any) {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
    };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { email, password, redirectTo } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, error: "Email and password are required" });
            return;
        }

        // Strong password regex: min 8 chars, only Latin characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`-])[a-zA-Z0-9!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`-]{8,}$/;
        if (!strongPasswordRegex.test(password)) {
            res.status(400).json({
                success: false,
                error: "Password must be at least 8 characters long, contain only Latin characters, and include at least one uppercase letter, one lowercase letter, one number, and one special character"
            });
            return;
        }

        const data = await signUp(email, password, redirectTo);
        setAuthCookies(res, data.session);
        res.status(201).json({ success: true, data: { user: sanitizeUser(data.user) } });
    } catch (error) {
        next(error);
    }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, error: "Email and password are required" });
            return;
        }
        const data = await signIn(email, password);
        setAuthCookies(res, data.session);
        res.status(200).json({ success: true, data: { user: sanitizeUser(data.user) } });
    } catch (error) {
        next(error);
    }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await signOut();
        clearAuthCookies(res);
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        next(error);
    }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { email, redirectTo } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: "Email is required" });
            return;
        }
        const redirectUrl = redirectTo || "http://localhost:3000/reset-password";
        await reqForgotPassword(email, redirectUrl);
        res.status(200).json({ success: true, message: "Password reset link sent successfully" });
    } catch (error) {
        next(error);
    }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { newPassword } = req.body;
        if (!newPassword) {
            res.status(400).json({ success: false, error: "New password is required" });
            return;
        }

        // Strong password regex: min 8 chars, only Latin characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`-])[a-zA-Z0-9!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`-]{8,}$/;
        if (!strongPasswordRegex.test(newPassword)) {
            res.status(400).json({
                success: false,
                error: "Password must be at least 8 characters long, contain only Latin characters, and include at least one uppercase letter, one lowercase letter, one number, and one special character"
            });
            return;
        }

        const token = req.cookies["sb-access-token"];
        const refreshToken = req.cookies["sb-refresh-token"];
        if (!token || !refreshToken) {
            res.status(401).json({ success: false, error: "Unauthorized: Missing reset token" });
            return;
        }

        const data = await reqResetPassword(token, refreshToken, newPassword);
        // Clear cookies after password reset to force user to log in again with the new password
        clearAuthCookies(res);
        res.status(200).json({ success: true, message: "Password reset successfully", data: { user: sanitizeUser(data.user) } });
    } catch (error) {
        next(error);
    }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        res.status(200).json({ success: true, user: sanitizeUser(req.user) });
    } catch (error) {
        next(error);
    }
}
