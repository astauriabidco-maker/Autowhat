import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/emailService';

const prisma = new PrismaClient();

/**
 * GET /superadmin/leads
 * Récupère les tenants sans abonnement actif (leads à relancer)
 */
export const getLeads = async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Récupérer les tenants sans abonnement actif
        const leads = await prisma.tenant.findMany({
            where: {
                AND: [
                    { createdAt: { lt: oneDayAgo } }, // Créé depuis > 24h
                    {
                        OR: [
                            { subscriptionStatus: null },
                            { subscriptionStatus: { not: 'active' } },
                            {
                                AND: [
                                    { plan: 'TRIAL' },
                                    { trialEndsAt: { lt: now } } // Trial expiré
                                ]
                            }
                        ]
                    }
                ]
            },
            select: {
                id: true,
                name: true,
                createdAt: true,
                plan: true,
                status: true,
                trialEndsAt: true,
                subscriptionStatus: true,
                lastLoginAt: true,
                employees: {
                    where: { role: 'MANAGER' },
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true
                    },
                    take: 1
                },
                leadNotes: {
                    select: {
                        id: true,
                        content: true,
                        createdAt: true
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 3
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculer le statut de chaque lead
        const leadsWithStatus = leads.map(lead => {
            let leadStatus: 'HOT' | 'WARM' | 'COLD';

            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const isTrialExpiredYesterday = lead.trialEndsAt &&
                lead.trialEndsAt >= yesterday &&
                lead.trialEndsAt < now;

            if (isTrialExpiredYesterday) {
                leadStatus = 'HOT';
            } else if (lead.createdAt >= threeDaysAgo) {
                leadStatus = 'WARM';
            } else {
                leadStatus = 'COLD';
            }

            return {
                ...lead,
                leadStatus,
                admin: lead.employees[0] || null,
                notes: lead.leadNotes
            };
        });

        // Grouper par statut
        const grouped = {
            hot: leadsWithStatus.filter(l => l.leadStatus === 'HOT'),
            warm: leadsWithStatus.filter(l => l.leadStatus === 'WARM'),
            cold: leadsWithStatus.filter(l => l.leadStatus === 'COLD')
        };

        res.status(200).json({
            total: leadsWithStatus.length,
            grouped,
            leads: leadsWithStatus
        });
    } catch (error: any) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des leads' });
    }
};

/**
 * POST /superadmin/leads/:id/notes
 * Ajouter une note commerciale sur un lead
 */
export const addLeadNote = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.params.id as string;
        const { content } = req.body;
        const superAdmin = req.superAdmin;

        if (!content || content.trim() === '') {
            res.status(400).json({ error: 'Contenu de la note requis' });
            return;
        }

        const note = await prisma.leadNote.create({
            data: {
                tenantId,
                content: content.trim(),
                createdBy: superAdmin?.id || 'unknown'
            }
        });

        res.status(201).json({
            message: 'Note ajoutée',
            note
        });
    } catch (error: any) {
        console.error('Error adding lead note:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout de la note' });
    }
};

/**
 * POST /superadmin/leads/:id/relance
 * Envoyer un email de relance personnalisé
 */
export const sendRelanceEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.params.id as string;
        const { templateType = 'help' } = req.body; // 'help', 'expiring', 'extension'

        // Récupérer le tenant et l'admin
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                employees: {
                    where: { role: 'MANAGER' },
                    select: { name: true, phoneNumber: true },
                    take: 1
                }
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const admin = tenant.employees[0];
        if (!admin || !admin.phoneNumber.includes('@')) {
            res.status(400).json({ error: 'Pas d\'email admin trouvé' });
            return;
        }

        // Templates d'emails
        const templates: Record<string, { subject: string; body: string }> = {
            help: {
                subject: `${tenant.name} - Besoin d'aide pour configurer Antigravity ?`,
                body: `Bonjour ${admin.name},\n\nJe suis le fondateur d'Antigravity et je vois que vous venez de créer un compte.\n\nAvez-vous besoin d'aide pour configurer votre espace ? Je suis disponible pour un appel de 15 minutes si vous le souhaitez.\n\nÀ très vite,\nL'équipe Antigravity`
            },
            expiring: {
                subject: `Plus que 24h pour ${tenant.name} !`,
                body: `Bonjour ${admin.name},\n\nVotre période d'essai expire demain !\n\nNe perdez pas vos données de pointage. Passez à un plan payant dès maintenant pour continuer à utiliser Antigravity.\n\n→ Accédez à votre espace: https://app.antigravity.io/billing\n\nDes questions ? Répondez à cet email.\n\nL'équipe Antigravity`
            },
            extension: {
                subject: `Prolongation exceptionnelle pour ${tenant.name} ?`,
                body: `Bonjour ${admin.name},\n\nVotre période d'essai est terminée, mais vos données sont toujours là.\n\nSi vous avez besoin de plus de temps pour tester, contactez-nous ! Nous pouvons vous offrir une prolongation exceptionnelle.\n\nÀ bientôt,\nL'équipe Antigravity`
            }
        };

        const template = templates[templateType] || templates.help;

        // Envoyer l'email
        await sendEmail({
            to: admin.phoneNumber, // phoneNumber contient l'email pour les managers
            subject: template.subject,
            html: template.body.replace(/\n/g, '<br>')
        });

        // Ajouter une note automatique
        await prisma.leadNote.create({
            data: {
                tenantId,
                content: `📧 Email de relance envoyé (${templateType})`,
                createdBy: req.superAdmin?.id || 'system'
            }
        });

        res.status(200).json({
            message: 'Email de relance envoyé',
            to: admin.phoneNumber,
            template: templateType
        });
    } catch (error: any) {
        console.error('Error sending relance email:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
    }
};

/**
 * GET /superadmin/leads/:id/notes
 * Récupérer les notes d'un lead
 */
export const getLeadNotes = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.params.id as string;

        const notes = await prisma.leadNote.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(notes);
    } catch (error: any) {
        console.error('Error fetching lead notes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des notes' });
    }
};

// ==========================================
// EXTERNAL LEADS (Leads Manuels)
// ==========================================

/**
 * GET /superadmin/external-leads
 * Liste tous les leads manuels
 */
export const getExternalLeads = async (req: Request, res: Response): Promise<void> => {
    try {
        const externalLeads = await prisma.externalLead.findMany({
            where: {
                convertedToTenantId: null // Non convertis uniquement
            },
            include: {
                notes: {
                    select: { id: true, content: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 3
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            total: externalLeads.length,
            leads: externalLeads.map(lead => ({
                ...lead,
                type: 'EXTERNAL',
                admin: { name: lead.contactName, phoneNumber: lead.phone || lead.email },
                leadStatus: lead.temperature
            }))
        });
    } catch (error: any) {
        console.error('Error fetching external leads:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des leads' });
    }
};

/**
 * POST /superadmin/external-leads
 * Créer un nouveau lead manuel
 */
export const createExternalLead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { companyName, contactName, email, phone, source, temperature, nextAction, nextActionAt } = req.body;

        if (!companyName || !contactName) {
            res.status(400).json({ error: 'Nom entreprise et nom contact requis' });
            return;
        }

        const lead = await prisma.externalLead.create({
            data: {
                companyName,
                contactName,
                email,
                phone,
                source: source || 'MANUAL',
                temperature: temperature || 'COLD',
                status: 'NEW',
                nextAction,
                nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
                assignedTo: req.superAdmin?.id
            }
        });

        // Ajouter note de création
        await prisma.leadNote.create({
            data: {
                externalLeadId: lead.id,
                content: `🆕 Lead créé manuellement (Source: ${source || 'MANUAL'})`,
                createdBy: req.superAdmin?.id || 'system'
            }
        });

        res.status(201).json({
            message: 'Lead créé avec succès',
            lead
        });
    } catch (error: any) {
        console.error('Error creating external lead:', error);
        res.status(500).json({ error: 'Erreur lors de la création du lead' });
    }
};

/**
 * PUT /superadmin/external-leads/:id
 * Mettre à jour un lead manuel
 */
export const updateExternalLead = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { status, temperature, nextAction, nextActionAt, companyName, contactName, email, phone } = req.body;

        const lead = await prisma.externalLead.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(temperature && { temperature }),
                ...(nextAction !== undefined && { nextAction }),
                ...(nextActionAt !== undefined && { nextActionAt: nextActionAt ? new Date(nextActionAt) : null }),
                ...(companyName && { companyName }),
                ...(contactName && { contactName }),
                ...(email !== undefined && { email }),
                ...(phone !== undefined && { phone })
            }
        });

        res.status(200).json({
            message: 'Lead mis à jour',
            lead
        });
    } catch (error: any) {
        console.error('Error updating external lead:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du lead' });
    }
};

/**
 * POST /superadmin/external-leads/:id/notes
 * Ajouter une note sur un lead externe
 */
export const addExternalLeadNote = async (req: Request, res: Response): Promise<void> => {
    try {
        const externalLeadId = req.params.id as string;
        const { content } = req.body;

        if (!content || content.trim() === '') {
            res.status(400).json({ error: 'Contenu de la note requis' });
            return;
        }

        const note = await prisma.leadNote.create({
            data: {
                externalLeadId,
                content: content.trim(),
                createdBy: req.superAdmin?.id || 'unknown'
            }
        });

        res.status(201).json({
            message: 'Note ajoutée',
            note
        });
    } catch (error: any) {
        console.error('Error adding external lead note:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout de la note' });
    }
};

/**
 * POST /superadmin/external-leads/:id/convert
 * Convertir un lead externe en client (tenant)
 */
export const convertExternalLead = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const lead = await prisma.externalLead.findUnique({ where: { id } });
        if (!lead) {
            res.status(404).json({ error: 'Lead non trouvé' });
            return;
        }

        // Rediriger vers la page de création de tenant avec les infos pré-remplies
        res.status(200).json({
            message: 'Utilisez l\'endpoint /admin/tenants/create pour créer le client',
            prefill: {
                companyName: lead.companyName,
                adminName: lead.contactName,
                adminEmail: lead.email,
                externalLeadId: lead.id
            }
        });
    } catch (error: any) {
        console.error('Error converting lead:', error);
        res.status(500).json({ error: 'Erreur lors de la conversion' });
    }
};

/**
 * DELETE /superadmin/external-leads/:id
 * Supprimer un lead externe
 */
export const deleteExternalLead = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        await prisma.externalLead.delete({ where: { id } });

        res.status(200).json({ message: 'Lead supprimé' });
    } catch (error: any) {
        console.error('Error deleting external lead:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
};
