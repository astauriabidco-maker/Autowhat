import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SUPERADMIN_AUTH_COOKIE } from '../utils/authCookies';

// Extend Express Request type for SuperAdmin
declare global {
    namespace Express {
        interface Request {
            superAdmin?: {
                id: string;
                email: string;
                name: string;
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
 * Middleware to authenticate Super Admin requests using JWT Bearer Token.
 * Super Admin has access to ALL tenants data.
 */
export const authenticateSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    const token = headerToken && !['cookie', 'null', 'undefined'].includes(headerToken)
        ? headerToken
        : req.cookies?.[SUPERADMIN_AUTH_COOKIE];

    if (!token) {
        res.status(401).json({ error: 'Token manquant ou format invalide' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: string;
            email: string;
            name: string;
            role: string;
        };

        // Only allow SUPER_ADMIN role
        if (decoded.role !== 'SUPER_ADMIN') {
            res.status(403).json({ error: 'Accès réservé aux Super Admins' });
            return;
        }

        // Inject super admin info into request
        req.superAdmin = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name
        };

        next();
    } catch (error) {
        console.error('JWT Verification Error:', error);
        res.status(401).json({ error: 'Token invalide ou expiré' });
        return;
    }
};
