import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
    assignExistingNumberToTenant,
    getSystemNumberPoolHealth,
    importSystemPhoneNumber,
    listSystemPhoneNumbers,
    unassignNumberFromTenant,
    updateSystemPhoneNumber
} from '../services/numberAllocationService';
import { runWhatsAppPoolHealthAlert } from '../services/whatsappPoolHealthAlertService';

function maskToken(token: string): string {
    if (!token) return '';
    return `${'*'.repeat(20)}${token.slice(-4)}`;
}

function routeParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] : value || '';
}

export const getSystemNumbers = async (_req: Request, res: Response): Promise<void> => {
    try {
        const [numbers, tenants] = await Promise.all([
            listSystemPhoneNumbers(),
            prisma.tenant.findMany({
                select: {
                    id: true,
                    name: true,
                    country: true,
                    plan: true,
                    status: true,
                    assignedSystemNumberId: true
                },
                orderBy: { name: 'asc' }
            })
        ]);
        const health = await getSystemNumberPoolHealth();

        res.json({
            numbers: numbers.map(number => ({
                id: number.id,
                phoneNumberId: number.phoneNumberId,
                displayNumber: number.displayNumber,
                countryCode: number.countryCode,
                wabaId: number.wabaId,
                isActive: number.isActive,
                channelType: number.channelType,
                setupStatus: number.setupStatus,
                planScope: number.planScope,
                maxTenants: number.maxTenants,
                tenantCount: number.tenants.length,
                availableSlots: Math.max(number.maxTenants - number.tenants.length, 0),
                disabledWebhookCount: number.disabledWebhookCount,
                lastDisabledWebhookAt: number.lastDisabledWebhookAt,
                tokenPreview: maskToken(number.accessToken),
                tenants: number.tenants
            })),
            tenants,
            health
        });
    } catch (error) {
        console.error('Error fetching WhatsApp system numbers:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des numéros WhatsApp' });
    }
};

export const createSystemNumber = async (req: Request, res: Response): Promise<void> => {
    try {
        const number = await importSystemPhoneNumber({
            phoneNumberId: req.body.phoneNumberId,
            displayNumber: req.body.displayNumber,
            countryCode: req.body.countryCode,
            accessToken: req.body.accessToken,
            wabaId: req.body.wabaId,
            isActive: req.body.isActive,
            channelType: req.body.channelType,
            setupStatus: req.body.setupStatus,
            planScope: req.body.planScope,
            maxTenants: req.body.maxTenants
        });

        res.status(201).json({
            id: number.id,
            phoneNumberId: number.phoneNumberId,
            displayNumber: number.displayNumber,
            countryCode: number.countryCode,
            wabaId: number.wabaId,
            isActive: number.isActive,
            channelType: number.channelType,
            setupStatus: number.setupStatus,
            planScope: number.planScope,
            maxTenants: number.maxTenants,
            tenantCount: number.tenantCount
        });
    } catch (error) {
        console.error('Error importing WhatsApp system number:', error);
        res.status(400).json({ error: 'Numéro WhatsApp invalide ou incomplet' });
    }
};

export const patchSystemNumber = async (req: Request, res: Response): Promise<void> => {
    try {
        const number = await updateSystemPhoneNumber(routeParam(req.params.id), {
            displayNumber: req.body.displayNumber,
            countryCode: req.body.countryCode,
            accessToken: req.body.accessToken,
            wabaId: req.body.wabaId,
            isActive: req.body.isActive,
            channelType: req.body.channelType,
            setupStatus: req.body.setupStatus,
            planScope: req.body.planScope,
            maxTenants: req.body.maxTenants
        });

        if (!number) {
            res.status(404).json({ error: 'Numéro WhatsApp introuvable' });
            return;
        }

        res.json({
            id: number.id,
            phoneNumberId: number.phoneNumberId,
            displayNumber: number.displayNumber,
            countryCode: number.countryCode,
            wabaId: number.wabaId,
            isActive: number.isActive,
            channelType: number.channelType,
            setupStatus: number.setupStatus,
            planScope: number.planScope,
            maxTenants: number.maxTenants,
            tenantCount: number.tenantCount
        });
    } catch (error) {
        console.error('Error updating WhatsApp system number:', error);
        res.status(400).json({ error: 'Impossible de mettre à jour ce numéro WhatsApp' });
    }
};

export const assignSystemNumber = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.body.tenantId;
        if (!tenantId) {
            res.status(400).json({ error: 'tenantId requis' });
            return;
        }

        const number = await assignExistingNumberToTenant(tenantId, routeParam(req.params.id), {
            exclusive: req.body.exclusive ?? true
        });

        if (!number) {
            res.status(409).json({ error: 'Impossible d’assigner ce numéro au tenant' });
            return;
        }

        res.json({
            success: true,
            number: {
                id: number.id,
                phoneNumberId: number.phoneNumberId,
                displayNumber: number.displayNumber,
                countryCode: number.countryCode,
                channelType: number.channelType,
                setupStatus: number.setupStatus,
                planScope: number.planScope,
                maxTenants: number.maxTenants,
                tenantCount: number.tenantCount
            }
        });
    } catch (error) {
        console.error('Error assigning WhatsApp system number:', error);
        res.status(500).json({ error: 'Erreur lors de l’assignation du numéro' });
    }
};

export const unassignTenantSystemNumber = async (req: Request, res: Response): Promise<void> => {
    try {
        await unassignNumberFromTenant(routeParam(req.params.tenantId));
        res.json({ success: true });
    } catch (error) {
        console.error('Error unassigning WhatsApp system number:', error);
        res.status(500).json({ error: 'Erreur lors du retrait du numéro' });
    }
};

export const triggerPoolHealthAlert = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await runWhatsAppPoolHealthAlert({ force: req.body?.force === true });
        res.json(result);
    } catch (error) {
        console.error('Error triggering WhatsApp pool health alert:', error);
        res.status(500).json({ error: 'Erreur lors du controle de sante du pool WhatsApp' });
    }
};
