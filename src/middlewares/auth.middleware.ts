import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token = req.cookies["sb-access-token"];

    // Optional fallback to Authorization Bearer header
    if (
      !token &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        return next();
      }
    }

    // Access token is missing or expired, try to refresh using refresh_token
    const refreshToken = req.cookies["sb-refresh-token"];
    if (refreshToken) {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!error && data.session) {
        // Set the new access and refresh tokens in cookies
        const isProduction = process.env.NODE_ENV === "production";
        const domain = process.env.COOKIE_DOMAIN;
        res.cookie("sb-access-token", data.session.access_token, {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax",
          maxAge: data.session.expires_in * 1000,
          ...(domain ? { domain } : {}),
        });
        res.cookie("sb-refresh-token", data.session.refresh_token, {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          ...(domain ? { domain } : {}),
        });

        req.user = data.session.user;
        return next();
      }
    }

    // If both token verification and refresh fail, clear cookies and deny access
    const clearDomain = process.env.COOKIE_DOMAIN;
    res.clearCookie("sb-access-token", clearDomain ? { domain: clearDomain } : {});
    res.clearCookie("sb-refresh-token", clearDomain ? { domain: clearDomain } : {});
    res.status(401).json({
      success: false,
      error: "Unauthorized: Session expired or invalid",
    });
  } catch (error) {
    next(error);
  }
};
