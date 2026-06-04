import crypto from 'crypto';
import prisma from '../lib/prisma';

const MAGIC_LOGIN_TTL_MS = 15 * 60 * 1000;
const DEFAULT_REDIRECT_TO = '/dashboard';

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function frontendBaseUrl(): string {
    return (process.env.FRONTEND_URL || 'https://app.whatspoint.com').replace(/\/$/, '');
}

export function normalizeManagerRedirect(redirectTo?: string): string {
    if (!redirectTo) return DEFAULT_REDIRECT_TO;

    const trimmed = redirectTo.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) {
        return DEFAULT_REDIRECT_TO;
    }

    if (trimmed.startsWith('/superadmin') || trimmed.startsWith('/auth')) {
        return DEFAULT_REDIRECT_TO;
    }

    return trimmed;
}

export async function createManagerMagicLoginLink(
    employeeId: string,
    options: { redirectTo?: string; source?: string } = {}
): Promise<{ url: string; expiresAt: Date }> {
    const manager = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
            id: true,
            role: true,
            tenantId: true,
            tenant: {
                select: {
                    status: true
                }
            }
        }
    });

    if (!manager || manager.role !== 'MANAGER') {
        throw new Error('Manager introuvable pour le lien magique');
    }

    if (manager.tenant.status === 'SUSPENDED') {
        throw new Error('Tenant suspendu');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + MAGIC_LOGIN_TTL_MS);
    const redirectTo = normalizeManagerRedirect(options.redirectTo);

    const loginToken = await prisma.managerMagicLoginToken.create({
        data: {
            tokenHash: hashToken(token),
            employeeId: manager.id,
            tenantId: manager.tenantId,
            redirectTo,
            expiresAt
        }
    });

    await prisma.onboardingEvent.create({
        data: {
            tenantId: manager.tenantId,
            employeeId: manager.id,
            type: 'MANAGER_MAGIC_LINK_SENT',
            metadata: {
                source: options.source || 'SYSTEM',
                tokenId: loginToken.id,
                expiresAt
            }
        }
    });

    const url = new URL('/magic-login', frontendBaseUrl());
    url.searchParams.set('token', token);

    return { url: url.toString(), expiresAt };
}

export async function consumeManagerMagicLoginToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    return prisma.$transaction(async (tx) => {
        const loginToken = await tx.managerMagicLoginToken.findUnique({
            where: { tokenHash },
            include: {
                employee: {
                    include: {
                        tenant: true
                    }
                }
            }
        });

        if (!loginToken || loginToken.usedAt || loginToken.expiresAt <= new Date()) {
            return null;
        }

        if (loginToken.employee.role !== 'MANAGER' || loginToken.employee.tenant.status === 'SUSPENDED') {
            return null;
        }

        const consumed = await tx.managerMagicLoginToken.updateMany({
            where: {
                id: loginToken.id,
                usedAt: null,
                expiresAt: {
                    gt: new Date()
                }
            },
            data: {
                usedAt: new Date()
            }
        });

        if (consumed.count !== 1) {
            return null;
        }

        await tx.tenant.update({
            where: { id: loginToken.employee.tenantId },
            data: { lastLoginAt: new Date() }
        });

        await tx.onboardingEvent.create({
            data: {
                tenantId: loginToken.employee.tenantId,
                employeeId: loginToken.employee.id,
                type: 'MANAGER_DASHBOARD_REACHED',
                metadata: {
                    source: 'MAGIC_LINK',
                    tokenId: loginToken.id
                }
            }
        });

        return {
            employee: loginToken.employee,
            redirectTo: normalizeManagerRedirect(loginToken.redirectTo || undefined)
        };
    });
}
