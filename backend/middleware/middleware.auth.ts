import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
    userId?: string;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authenticationHeader = req.headers["authorization"];
    const token = authenticationHeader && authenticationHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access token is missing" });
    }

    try {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, userId) => {
            if (err) {
                return res.status(403).json({ message: "Invalid access token" });
            }
            req.userId = userId as string;
            next();
        });
    } catch (error) {
        console.error("Error verifying token:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}