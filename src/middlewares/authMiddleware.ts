import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { MANAGER_AUTH_COOKIE } from '../utils/authCookies';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                tenantId: string;
                role: string;
            };
        }
    }
}

const JWT_SECRET = (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return secret;
})();

/**
 * Middleware to authenticate Manager requests using JWT Bearer Token.
 * CRITICAL: Injects userId AND tenantId into req.user for multi-tenant isolation.
 */
export const authenticateManager = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    const token = headerToken && !['cookie', 'null', 'undefined'].includes(headerToken)
        ? headerToken
        : req.cookies?.[MANAGER_AUTH_COOKIE];

    if (!token) {
        res.status(401).json({ error: 'Token manquant ou format invalide' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            userId: string;
            tenantId: string;
            role: string;
        };

        // Only allow MANAGER role to access dashboard endpoints
        if (decoded.role !== 'MANAGER') {
            res.status(403).json({ error: 'Accès réservé aux managers' });
            return;
        }

        // CRITICAL: Inject both userId and tenantId into request
        req.user = {
            userId: decoded.userId,
            tenantId: decoded.tenantId,
            role: decoded.role
        };

        next();
    } catch (error) {
        console.error('JWT Verification Error:', error);
        res.status(401).json({ error: 'Token invalide ou expiré' });
        return;
    }
};
