import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getTemplate } from '../config/industryTemplates';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';
import { assignNumberToTenant } from '../services/numberAllocationService';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

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

        // 📞 Assign system phone number from pool (async, don't block response)
        const tenantCountry = country || 'FR';
        assignNumberToTenant(result.tenant.id, tenantCountry)
            .then(assignedNumber => {
                if (assignedNumber) {
                    console.log(`📞 Assigned ${assignedNumber.displayNumber} to ${companyName}`);
                } else {
                    console.warn(`⚠️ No system number available for ${companyName} (${tenantCountry})`);
                }
            })
            .catch(err => console.error('Number allocation failed:', err));

        // 📧 Send welcome email (async, don't block response)
        sendWelcomeEmail({
            email,
            name: fullName,
            tenantName: companyName,
        }).catch(err => console.error('Welcome email failed:', err));

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

/**
 * POST /auth/forgot-password
 * Sends a password reset email with a secure token.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Email requis' });
            return;
        }

        // We need to find the manager by phone - but email is passed
        // In this system, managers login with phone, so we check if email matches phone pattern
        // Or search by cleaned input
        const cleanInput = email.replace(/[\s-]/g, '');

        const employee = await prisma.employee.findFirst({
            where: {
                phoneNumber: cleanInput,
                role: 'MANAGER',
            },
        });

        // Also check by name that might be an email
        const employeeByName = !employee ? await prisma.employee.findFirst({
            where: {
                name: { contains: email, mode: 'insensitive' },
                role: 'MANAGER',
            },
        }) : null;

        const manager = employee || employeeByName;

        // Always return success to prevent email enumeration
        if (!manager) {
            console.log(`Password reset requested for unknown: ${email}`);
            res.status(200).json({
                message: 'Si ce compte existe, un email de réinitialisation a été envoyé.'
            });
            return;
        }

        // Generate secure token
        const resetToken = crypto.randomUUID();
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save token to database
        await prisma.employee.update({
            where: { id: manager.id },
            data: {
                resetToken,
                resetTokenExpiry,
            },
        });

        // Send email (using phone as email for now, or name if it's an email)
        const targetEmail = email.includes('@') ? email : `${manager.phoneNumber}@example.com`;
        const resetUrl = `${FRONTEND_URL}/reset-password`;

        await sendPasswordResetEmail(targetEmail, resetToken, resetUrl);

        console.log(`🔑 Password reset token generated for ${manager.name}`);

        res.status(200).json({
            message: 'Si ce compte existe, un email de réinitialisation a été envoyé.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation' });
    }
};

/**
 * POST /auth/reset-password
 * Validates a reset token and updates the password.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
            return;
        }

        // Find employee with valid token
        const employee = await prisma.employee.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date(), // Token must not be expired
                },
            },
        });

        if (!employee) {
            res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré' });
            return;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password and clear reset token
        await prisma.employee.update({
            where: { id: employee.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });

        console.log(`✅ Password reset successful for ${employee.name}`);

        res.status(200).json({
            message: 'Mot de passe mis à jour avec succès. Vous pouvez maintenant vous connecter.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
    }
};
