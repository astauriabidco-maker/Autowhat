import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getTemplate } from '../config/industryTemplates';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Timezones par pays
const TIMEZONES: Record<string, string> = {
    FR: 'Europe/Paris',
    CM: 'Africa/Douala',
    US: 'America/New_York',
    CA: 'America/Toronto',
    BE: 'Europe/Brussels',
    CH: 'Europe/Zurich',
};

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

        // Clean phone/email input
        const cleanInput = phoneNumber.replace(/[\s-]/g, '');

        // First, check if it's a SuperAdmin login (by email)
        const superAdmin = await prisma.superAdmin.findUnique({
            where: { email: cleanInput }
        });

        if (superAdmin) {
            // SuperAdmin login
            const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
            if (!isPasswordValid) {
                res.status(401).json({ error: 'Identifiants invalides' });
                return;
            }

            const token = jwt.sign(
                {
                    userId: superAdmin.id,
                    role: 'SUPERADMIN',
                    isSuperAdmin: true,
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.status(200).json({
                message: 'Connexion réussie',
                token,
                user: {
                    id: superAdmin.id,
                    name: superAdmin.name,
                    role: 'SUPERADMIN',
                },
            });
            return;
        }

        // ============================================
        // MAINTENANCE MODE CHECK (Kill Switch)
        // SuperAdmins can always login, but regular users are blocked
        // ============================================
        const platformConfig = await prisma.platformConfig.findUnique({ where: { id: 1 } });
        if (platformConfig?.maintenanceMode) {
            res.status(503).json({
                error: 'La plateforme est en maintenance. Réessayez dans quelques minutes.',
                maintenanceMode: true
            });
            return;
        }

        // Find the Employee/Manager by phone number
        const employee = await prisma.employee.findFirst({
            where: {
                phoneNumber: cleanInput,
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

/**
 * POST /auth/register
 * Creates a new Tenant, Site, and Admin User in a single transaction.
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, fullName, phone, companyName, sector, country } = req.body;

        // Validation
        if (!email || !password || !fullName || !phone || !companyName) {
            res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
            return;
        }

        // ============================================
        // MAINTENANCE MODE CHECK (Kill Switch)
        // Block all registrations during maintenance
        // ============================================
        const platformConfig = await prisma.platformConfig.findUnique({ where: { id: 1 } });
        if (platformConfig?.maintenanceMode) {
            res.status(503).json({
                error: 'La plateforme est en maintenance. Les inscriptions sont temporairement désactivées.',
                maintenanceMode: true
            });
            return;
        }

        // Also check allowRegistrations flag
        if (platformConfig && !platformConfig.allowRegistrations) {
            res.status(403).json({
                error: 'Les inscriptions sont actuellement fermées.',
                registrationsClosed: true
            });
            return;
        }

        // Clean phone number to E.164 format
        let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleanPhone.startsWith('+')) {
            cleanPhone = '+' + cleanPhone;
        }

        // Check if phone already exists
        const existingUser = await prisma.employee.findFirst({
            where: { phoneNumber: cleanPhone.replace('+', '') }
        });

        if (existingUser) {
            res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé' });
            return;
        }

        // Get industry template
        const industryKey = sector || 'GENERIC';
        const template = getTemplate(industryKey);
        const timezone = TIMEZONES[country] || 'UTC';

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction: Create Tenant + Site + User
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Tenant with Trial Plan
            const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // +14 days
            const tenant = await tx.tenant.create({
                data: {
                    name: companyName,
                    country: country || 'FR',
                    industry: industryKey,
                    config: JSON.parse(JSON.stringify(template.config)),
                    vocabulary: JSON.parse(JSON.stringify(template.vocabulary)),
                    // SaaS Trial defaults
                    plan: 'TRIAL',
                    trialEndsAt,
                    maxEmployees: 5,
                }
            });

            // 2. Create Main Site
            const site = await tx.site.create({
                data: {
                    name: 'Siège Social',
                    tenantId: tenant.id,
                }
            });

            // 3. Create Admin User (Manager)
            const user = await tx.employee.create({
                data: {
                    name: fullName,
                    phoneNumber: cleanPhone.replace('+', ''),
                    password: hashedPassword,
                    role: 'MANAGER',
                    tenantId: tenant.id,
                    // siteId omitted = null by default (access to all sites)
                }
            });

            return { tenant, site, user };
        });

        // Generate JWT for immediate login
        const token = jwt.sign(
            {
                userId: result.user.id,
                tenantId: result.tenant.id,
                role: 'MANAGER',
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        console.log(`✅ New tenant registered: ${companyName} (${industryKey})`);

        res.status(201).json({
            success: true,
            message: 'Inscription réussie ! Bienvenue sur AutoWhats.',
            token,
            user: {
                id: result.user.id,
                name: result.user.name,
                role: result.user.role,
                tenant: result.tenant.name,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription. Veuillez réessayer.' });
    }
};

