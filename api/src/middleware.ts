
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret_password";

export interface AuthRequest extends Request {
    userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const sentAccessToken = req.cookies.accessToken;

    if (!sentAccessToken) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    try {
        const decoded = jwt.verify(sentAccessToken, JWT_SECRET) as { userId: string };
        req.userId = JSON.stringify(decoded.userId);
        next();
    } catch (e) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }
}
