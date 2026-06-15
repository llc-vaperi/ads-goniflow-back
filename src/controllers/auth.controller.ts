import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";

export class AuthController {
    private authService = new AuthService();

    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                res.status(400).json({ success: false, error: "Email and password are required" });
                return;
            }
            const data = await this.authService.signUp(email, password);
            res.status(201).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    };

    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                res.status(400).json({ success: false, error: "Email and password are required" });
                return;
            }
            const data = await this.authService.signIn(email, password);
            res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.authService.signOut();
            res.status(200).json({ success: true, message: "Logged out successfully" });
        } catch (error) {
            next(error);
        }
    };

    forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, redirectTo } = req.body;
            if (!email) {
                res.status(400).json({ success: false, error: "Email is required" });
                return;
            }
            const redirectUrl = redirectTo || "http://localhost:3000/reset-password";
            const data = await this.authService.forgotPassword(email, redirectUrl);
            res.status(200).json({ success: true, message: "Password reset link sent successfully", data });
        } catch (error) {
            next(error);
        }
    };

    resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

            const data = await this.authService.resetPassword(token, newPassword);
            res.status(200).json({ success: true, message: "Password reset successfully", data });
        } catch (error) {
            next(error);
        }
    };

    getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            res.status(200).json({ success: true, user: req.user });
        } catch (error) {
            next(error);
        }
    };
}
