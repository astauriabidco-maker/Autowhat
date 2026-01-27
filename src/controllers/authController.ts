import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * POST /auth/login
 * Authenticates a Manager and returns a JWT token.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber, password } = req.body;

        if (!phoneNumber || !password) {
            res.status(400).json({ error: 'Numéro de téléphone et mot de passe requis' });
            return;
        }

        // Find the user by phone number
        const employee = await prisma.employee.findFirst({
            where: {
                phoneNumber: phoneNumber.replace(/[\s-]/g, ''),
            },
            include: {
                tenant: true,
            },
        });

        if (!employee) {
            res.status(401).json({ error: 'Identifiants invalides' });
            return;
        }

        // Only MANAGER can login to dashboard
        if (employee.role !== 'MANAGER') {
            res.status(403).json({ error: 'Accès réservé aux managers' });
            return;
        }

        // Check if password exists and matches
        if (!employee.password) {
            res.status(401).json({ error: 'Mot de passe non configuré pour ce compte' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, employee.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Identifiants invalides' });
            return;
        }

        // Generate JWT with userId, tenantId, and role
        const token = jwt.sign(
            {
                userId: employee.id,
                tenantId: employee.tenantId,
                role: employee.role,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(200).json({
            message: 'Connexion réussie',
            token,
            user: {
                id: employee.id,
                name: employee.name,
                role: employee.role,
                tenant: employee.tenant.name,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};
