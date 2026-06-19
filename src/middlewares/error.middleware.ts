import { Request, Response, NextFunction } from "express";

export interface CustomError extends Error {
    statusCode?: number;
}

export const globalErrorHandler = (
    err: CustomError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[Error] ${statusCode} - ${message}`);
    if (err.stack) {
        console.error(err.stack);
    }

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        },
    });
};
