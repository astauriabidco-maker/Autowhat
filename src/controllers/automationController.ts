import { Request, Response } from 'express';
import prisma from '../lib/prisma';


/**
 * GET /superadmin/automations
 * Liste toutes les règles d'automatisation
 */
export const getAutomationRules = async (req: Request, res: Response): Promise<void> => {
    try {
        const rules = await prisma.automationRule.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { executions: true }
                }
            }
        });

        res.status(200).json(rules);
    } catch (error: any) {
        console.error('Error fetching automation rules:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des règles' });
    }
};

/**
 * POST /superadmin/automations
 * Créer une nouvelle règle
 */
export const createAutomationRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, trigger, triggerValue, channel, templateSubject, templateBody, executionTime } = req.body;

        if (!name || !trigger || triggerValue === undefined || !templateBody) {
            res.status(400).json({ error: 'Champs requis: name, trigger, triggerValue, templateBody' });
            return;
        }

        const rule = await prisma.automationRule.create({
            data: {
                name,
                description,
                trigger,
                triggerValue: parseInt(triggerValue),
                channel: channel || 'EMAIL',
                templateSubject,
                templateBody,
                executionTime: executionTime || '10:00',
                isActive: true
            }
        });

        res.status(201).json({
            message: 'Règle créée avec succès',
            rule
        });
    } catch (error: any) {
        console.error('Error creating automation rule:', error);
        res.status(500).json({ error: 'Erreur lors de la création' });
    }
};

/**
 * PUT /superadmin/automations/:id
 * Modifier une règle
 */
export const updateAutomationRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { name, description, trigger, triggerValue, channel, templateSubject, templateBody, executionTime, isActive } = req.body;

        const rule = await prisma.automationRule.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(trigger && { trigger }),
                ...(triggerValue !== undefined && { triggerValue: parseInt(triggerValue) }),
                ...(channel && { channel }),
                ...(templateSubject !== undefined && { templateSubject }),
                ...(templateBody && { templateBody }),
                ...(executionTime && { executionTime }),
                ...(isActive !== undefined && { isActive })
            }
        });

        res.status(200).json({
            message: 'Règle mise à jour',
            rule
        });
    } catch (error: any) {
        console.error('Error updating automation rule:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
};

/**
 * PATCH /superadmin/automations/:id/toggle
 * Activer/Désactiver une règle
 */
export const toggleAutomationRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const rule = await prisma.automationRule.findUnique({ where: { id } });
        if (!rule) {
            res.status(404).json({ error: 'Règle non trouvée' });
            return;
        }

        const updated = await prisma.automationRule.update({
            where: { id },
            data: { isActive: !rule.isActive }
        });

        res.status(200).json({
            message: `Règle ${updated.isActive ? 'activée' : 'désactivée'}`,
            rule: updated
        });
    } catch (error: any) {
        console.error('Error toggling automation rule:', error);
        res.status(500).json({ error: 'Erreur lors du toggle' });
    }
};

/**
 * DELETE /superadmin/automations/:id
 * Supprimer une règle
 */
export const deleteAutomationRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        await prisma.automationRule.delete({ where: { id } });

        res.status(200).json({ message: 'Règle supprimée' });
    } catch (error: any) {
        console.error('Error deleting automation rule:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
};

/**
 * GET /superadmin/automations/:id/logs
 * Historique des exécutions d'une règle
 */
export const getAutomationLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const ruleId = req.params.id as string;
        const limit = parseInt(req.query.limit as string) || 50;

        const logs = await prisma.automationExecution.findMany({
            where: { ruleId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        res.status(200).json(logs);
    } catch (error: any) {
        console.error('Error fetching automation logs:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
    }
};

/**
 * GET /superadmin/automations/stats
 * Statistiques globales des automatisations
 */
export const getAutomationStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalRules, activeRules, todayExecutions, failedToday] = await Promise.all([
            prisma.automationRule.count(),
            prisma.automationRule.count({ where: { isActive: true } }),
            prisma.automationExecution.count({
                where: { createdAt: { gte: today } }
            }),
            prisma.automationExecution.count({
                where: {
                    createdAt: { gte: today },
                    status: 'FAILED'
                }
            })
        ]);

        res.status(200).json({
            totalRules,
            activeRules,
            todayExecutions,
            failedToday,
            successRate: todayExecutions > 0
                ? Math.round(((todayExecutions - failedToday) / todayExecutions) * 100)
                : 100
        });
    } catch (error: any) {
        console.error('Error fetching automation stats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
    }
};

// Helper: Variables disponibles pour les templates
export const TEMPLATE_VARIABLES = [
    { key: '{{nom}}', description: 'Nom du contact' },
    { key: '{{entreprise}}', description: 'Nom de l\'entreprise' },
    { key: '{{email}}', description: 'Email du contact' },
    { key: '{{daysLeft}}', description: 'Jours restants (trial)' },
    { key: '{{trialEndDate}}', description: 'Date fin trial' },
    { key: '{{loginUrl}}', description: 'URL de connexion' }
];

// Helper: Types de déclencheurs disponibles
export const TRIGGER_TYPES = [
    { value: 'DAYS_SINCE_SIGNUP', label: 'Jours depuis inscription', description: 'X jours après la création du compte' },
    { value: 'TRIAL_EXPIRES_IN', label: 'Trial expire dans', description: 'X jours avant la fin du trial' },
    { value: 'TRIAL_EXPIRED_DAYS', label: 'Trial expiré depuis', description: 'X jours après l\'expiration du trial' },
    { value: 'NO_ACTIVITY_DAYS', label: 'Inactif depuis', description: 'X jours sans connexion' },
    { value: 'NO_SUBSCRIPTION', label: 'Sans abonnement depuis', description: 'Inscrit depuis X jours sans souscrire' }
];
