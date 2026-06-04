import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { identifyUser } from '../services/authService';
import { sendMessage, sendInteractiveList, sendInteractiveButtons, sendDocument, sendTemplateMessage, WhatsAppTemplateComponent } from '../services/whatsappService';
import { checkIn, checkOut } from '../services/attendanceService';
import { createRequest, handleManagerResponse, formatDateForMessage } from '../services/leaveService';
import { downloadAndSaveMetaImage } from '../services/storageService';
import { isWithinRange, checkLocationCompliance } from '../services/locationService';
import { setConversationState, updateTempExpenseData, createExpense, EXPENSE_CATEGORIES } from '../services/expenseService';
import { getWeeklySummary, getHistory, formatWeeklySummaryMessage, formatHistoryMessage } from '../services/statsService';
import { getDocumentsForEmployee, getDocumentById, formatDocumentListMessage } from '../services/documentService';
import { notifyAllManagers } from '../services/notificationService';
import { getBotMessage, getEmployeeLanguage } from '../config/i18nBot';
import { getTemplate } from '../config/industryTemplates';
import { dispatchWebhook, WEBHOOK_EVENTS } from '../services/webhookService';
import { absoluteSignedUploadUrl, absoluteSignedUploadUrlIfNeeded } from '../utils/signedFileUrl';
import { assignNumberToTenant } from '../services/numberAllocationService';

// Anti-spam cooldown for Magic Link messages (in-memory cache)
// In production, consider using Redis for persistence across restarts
const magicLinkCooldowns = new Map<string, number>();

type SignupSessionStep = 'WAITING_COMPANY' | 'WAITING_TEAM_SIZE' | 'WAITING_EMAIL' | 'WAITING_CONFIRMATION';
interface SignupSession {
    step: SignupSessionStep;
    companyName?: string;
    teamSize?: number;
    email?: string;
    createdAt: number;
}

const whatsappSignupSessions = new Map<string, SignupSession>();
const SIGNUP_SESSION_TTL_MS = 30 * 60 * 1000;

// Expense category buttons (WhatsApp allows max 3 per message, so we use list)
const EXPENSE_CATEGORY_BUTTONS = [
    { id: 'cat_repas', title: '🍔 Repas' },
    { id: 'cat_essence', title: '⛽ Essence' },
    { id: 'cat_hotel', title: '🏨 Hôtel' }
];

// Time variation type buttons
const VARIATION_TYPE_BUTTONS = [
    { id: 'var_hs25', title: '⏱️ HS +25%' },
    { id: 'var_hs50', title: '🚀 HS +50%' },
    { id: 'var_night', title: '🌙 Nuit' }
];

const VARIATION_TYPE_MAPPING: Record<string, string> = {
    'var_hs25': 'HS25',
    'var_hs50': 'HS50',
    'var_night': 'NIGHT',
    'var_sunday': 'SUNDAY',
    'var_holiday': 'HOLIDAY'
};

const EXPENSE_CATEGORY_MAPPING: Record<string, string> = {
    'cat_repas': 'REPAS',
    'cat_essence': 'ESSENCE',
    'cat_hotel': 'HOTEL',
    'cat_materiel': 'MATERIEL'
};

// Main menu sections for WhatsApp interactive list
const MENU_SECTIONS = [
    {
        title: '⏰ Pointage',
        rows: [
            { id: 'cmd_hi', title: '👋 Arrivée (Hi)', description: 'Commencer ma journée' },
            { id: 'cmd_bye', title: '🏁 Départ (Bye)', description: 'Finir ma journée' }
        ]
    },
    {
        title: '📋 Administration',
        rows: [
            { id: 'cmd_leave', title: '🏖️ Poser un congé', description: 'Demander un jour de congé' },
            { id: 'cmd_sick', title: '🤒 Arrêt maladie', description: 'Déclarer un arrêt médical' },
            { id: 'cmd_balance', title: '📊 Mes droits (Solde)', description: 'Consulter mes congés/RTT' },
            { id: 'cmd_expense', title: '🧾 Note de frais', description: 'Soumettre une dépense' },
            { id: 'cmd_stats', title: '📊 Mes heures', description: 'Voir mes statistiques' },
            { id: 'cmd_docs', title: '📂 Mes documents', description: 'Consulter mes documents' }
        ]
    },
    {
        title: '🚨 Urgence',
        rows: [
            { id: 'cmd_sos', title: '🚨 SOS / Danger', description: 'Signaler une urgence' }
        ]
    }
];

// Map interactive button IDs to command strings for unified processing
const INTERACTIVE_ID_TO_COMMAND: Record<string, string> = {
    'cmd_hi': 'hi',
    'cmd_bye': 'bye',
    'cmd_leave': 'leave_menu',
    'cmd_sick': 'maladie',
    'cmd_balance': 'balance',
    'cmd_expense': 'expense',
    'cmd_stats': 'stats',
    'cmd_docs': 'documents',
    'cmd_sos': 'sos'
};

const MANAGER_AHA_BUTTONS = [
    { id: 'btn_manager_invite_employee', title: 'Inviter employé' },
    { id: 'btn_manager_demo_pointage', title: 'Simulation' },
    { id: 'btn_manager_menu', title: 'Menu' }
];

const DEFAULT_UNKNOWN_CONTACT_WELCOME =
    "WhatsPoint transforme WhatsApp en pointage, planning et demandes terrain pour vos équipes.\n\n" +
    "Vous pouvez créer votre espace, voir une démo ou simplement répondre à ce message pour parler à Astauria.";
const DEFAULT_UNKNOWN_CONTACT_BTN_1 = 'Créer un espace';
const DEFAULT_UNKNOWN_CONTACT_BTN_2 = 'Voir une démo';

/**
 * Check if the message should trigger the main menu
 */
function shouldShowMenu(message: string): boolean {
    const menuTriggers = ['menu', 'aide', 'options', 'help', '?'];
    const normalized = message.toLowerCase().trim();
    return menuTriggers.includes(normalized);
}

/**
 * Send the main interactive menu to a user
 */
async function sendMainMenu(to: string, phoneNumberId?: string) {
    await sendInteractiveList(
        to,
        'Bonjour ! 👋 Que souhaitez-vous faire ?',
        'Ouvrir le Menu',
        MENU_SECTIONS,
        phoneNumberId
    );
}

/**
 * Unified command processor for both text commands and interactive menu selections
 */
async function processCommand(
    command: string,
    employee: any,
    from: string,
    phoneNumberId?: string,
    messageTimestamp?: Date  // Timestamp réel du message WhatsApp (gestion offline)
) {
    let responseText: string;

    switch (command) {
        case 'hi':
        case 'bonjour':
        case 'start':
        case 'hello':
        case 'salut': {
            // Check-in
            console.log(`⏰ Processing CHECK-IN for ${employee.name}`);
            const result = await checkIn(employee, messageTimestamp);

            if (result.success) {
                responseText = `✅ ${result.message} Bon travail ${employee.name} !`;
            } else {
                responseText = `⚠️ ${result.message}`;
            }
            break;
        }

        case 'bye':
        case 'au revoir':
        case 'stop':
        case 'fin':
        case 'ciao': {
            // Check-out
            console.log(`👋 Processing CHECK-OUT for ${employee.name}`);
            const result = await checkOut(employee, messageTimestamp);

            if (result.success) {
                responseText = `👋 ${result.message} Bonne soirée ${employee.name} !`;
            } else {
                responseText = `⚠️ ${result.message}`;
            }
            break;
        }

        case 'stats':
        case 'bilan':
        case 'mes heures': {
            // Stats command - show weekly hours summary using statsService
            console.log(`📊 Processing STATS for ${employee.name}`);

            try {
                const summary = await getWeeklySummary(employee.id, employee.tenantId);
                responseText = formatWeeklySummaryMessage(summary);
            } catch (error) {
                console.error('Error getting weekly summary:', error);
                responseText = `❌ Erreur lors de la récupération de vos statistiques.`;
            }
            break;
        }

        case 'historique': {
            // History command - show last 10 days of attendance
            console.log(`📋 Processing HISTORIQUE for ${employee.name}`);

            try {
                const history = await getHistory(employee.id, employee.tenantId, 10);
                responseText = formatHistoryMessage(history, employee.name || 'Employé');
            } catch (error) {
                console.error('Error getting history:', error);
                responseText = `❌ Erreur lors de la récupération de votre historique.`;
            }
            break;
        }

        case 'leave_menu': {
            // Leave request guide
            console.log(`🏖️ Processing LEAVE_MENU for ${employee.name}`);
            responseText = `🏖️ *Demander un congé*\n\n` +
                `Pour demander un congé, envoyez:\n` +
                `*Congé DD/MM* (ex: Congé 25/12)\n\n` +
                `Votre manager sera notifié et devra approuver votre demande.`;
            break;
        }

        case 'sos': {
            // SOS - Emergency notification
            console.log(`🚨 Processing SOS from ${employee.name}`);

            // Notify manager about the emergency
            const manager = await prisma.employee.findFirst({
                where: {
                    tenantId: employee.tenantId,
                    role: 'MANAGER'
                }
            });

            if (manager && manager.phoneNumber) {
                await sendMessage(
                    manager.phoneNumber.replace('+', ''),
                    `🚨 *ALERTE URGENCE* 🚨\n\n` +
                    `L'employé *${employee.name}* a déclenché une alerte SOS!\n` +
                    `📞 Numéro: ${employee.phoneNumber}\n\n` +
                    `Veuillez le contacter immédiatement.`,
                    phoneNumberId
                );
            }

            responseText = `🚨 *Alerte SOS envoyée!*\n\n` +
                `Votre manager a été notifié et vous contactera rapidement.\n\n` +
                `En cas d'urgence grave, appelez également le 15 (SAMU) ou 18 (Pompiers).`;
            break;
        }

        case 'documents':
        case 'document':
        case 'contrat':
        case 'paie': {
            // Show employee documents
            console.log(`📂 Processing DOCUMENTS for ${employee.name}`);

            try {
                const documents = await getDocumentsForEmployee(employee.id, employee.tenantId, 5);
                responseText = formatDocumentListMessage(documents, employee.name || 'Employé');

                // Store document IDs in temp data for later selection
                if (documents.length > 0) {
                    await prisma.employee.update({
                        where: { id: employee.id },
                        data: {
                            conversationState: 'WAITING_DOC_SELECTION',
                            tempExpenseData: { documentIds: documents.map(d => d.id) }
                        }
                    });
                }
            } catch (error) {
                console.error('Error fetching documents:', error);
                responseText = `❌ Erreur lors de la récupération de vos documents.`;
            }
            break;
        }

        case 'expense':
        case 'frais': {
            // Start expense workflow
            console.log(`🧾 Starting EXPENSE workflow for ${employee.name}`);
            await setConversationState(employee.id, 'WAITING_EXPENSE_PHOTO');
            responseText = `🧾 *Nouvelle note de frais*\n\n📸 Envoyez la photo du ticket.`;
            break;
        }

        case 'maladie':
        case 'sick': {
            console.log(`🤒 Starting SICK LEAVE workflow for ${employee.name}`);
            await setConversationState(employee.id, 'WAITING_SICK_PHOTO');
            responseText = `🤒 *Déclaration d'arrêt maladie*\n\nPas besoin de taper les dates ! 📷 Envoyez-moi simplement *la photo de votre certificat médical*, je le lirai et l'enregistrerai pour vous.`;
            break;
        }

        case 'balance':
        case 'solde':
        case 'droits': {
            console.log(`📊 Interrogating KPaie for balances of ${employee.name}`);
            
            const softwareName = employee.tenant?.hrisName || "KPaie";
            
            await sendMessage(
                from,
                `🔄 *Connexion en cours...*\nInterrogation de ${softwareName}, merci de patienter...`,
                phoneNumberId
            );

            try {
                const { getKPaieBalances, formatKPaieBalanceMessage } = require('../services/kpaieService');
                
                // On utilise le phoneNumber comme identifiant externe par défaut pour la démo
                // Dans un cas réel, on utiliserait un champ 'externalId' mappé dans l'ERP
                const result = await getKPaieBalances(employee.tenantId, employee.phoneNumber);
                
                if (result.success && result.data) {
                    responseText = formatKPaieBalanceMessage(result.data);
                } else if (result.error === 'NO_CONFIG') {
                    responseText = `⚠️ *Configuration manquante*\nVotre entreprise n'a pas encore configuré l'accès API à ${softwareName}.`;
                } else {
                    responseText = `❌ Impossible de joindre ${softwareName} pour le moment.`;
                }

            } catch (err) {
                 console.error('Error in balance connector:', err);
                 responseText = `❌ Une erreur technique est survenue lors de l'appel à ${softwareName}.`;
            }
            break;
        }

        case 'documents':
        case 'docs': {
            console.log(`📂 Fetching documents for ${employee.name}`);
            
            const docs = await getDocumentsForEmployee(employee.id, employee.tenantId, 5);
            
            if (docs.length === 0) {
                responseText = `📂 *Mes Documents*\n\n_Votre coffre-fort numérique est vide._`;
            } else {
                responseText = formatDocumentListMessage(docs as any, employee.name);
                await setConversationState(employee.id, 'WAITING_DOC_SELECTION');
            }
            break;
        }

        default: {
            // Show interactive menu for unknown commands instead of plain text
            console.log(`📋 Unknown command "${command}", showing menu to ${employee.name}`);
            await sendMainMenu(from, phoneNumberId);
            return; // Don't send additional message
        }
    }

    await sendMessage(from, responseText, phoneNumberId);
}

/**
 * Handles the Webhook verification challenge from Meta.
 */
export const verifyWebhook = (req: Request, res: Response): any => {
    console.log('🔍 [Webhook] Incoming verification request');
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode && token) {
        if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
            console.log('✅ Webhook Verified');
            return res.status(200).send(challenge);
        } else {
            console.error('❌ Webhook Verification Failed: Invalid Token');
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400); // Bad Request if parameters are missing
};

/**
 * Check if message matches a leave request pattern
 */
function parseLeaveRequest(message: string): string | null {
    // Match patterns like "congé 25/12", "leave 25/12/2026", "congés 01/02 matin", "congé 01/02 aprem"
    // Captures the date and any trailing half-day modifier
    const regex = /^(?:cong[ée]s?|leave)\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?(?:\s+(?:matin|apr[èe]s?-?midi|aprem|am|pm))?)/i;
    const match = message.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Check if message is a manager approval/rejection response
 */
function isManagerResponse(message: string): boolean {
    const regex = /^(OK|OUI|APPROVE|VALIDE|ACCEPTE|NON|REFUSE|REJECT|REJETTE)\s*#?\s*[a-zA-Z0-9-]+/i;
    return regex.test(message.trim());
}

function isLandingDemoRequest(message: string): boolean {
    const normalized = message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    return normalized.includes('demo whatspoint') || normalized.includes('voir la demo');
}

function normalizeText(message: string): string {
    return message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function isAffirmative(message: string): boolean {
    return ['oui', 'ok', 'confirmer', 'confirme', 'go', 'yes', 'valider', 'valide'].includes(normalizeText(message));
}

function isCancellation(message: string): boolean {
    return ['annuler', 'stop', 'cancel', 'non'].includes(normalizeText(message));
}

function inferCountryFromPhone(phone: string): string {
    if (phone.startsWith('237')) return 'CM';
    if (phone.startsWith('33')) return 'FR';
    if (phone.startsWith('32')) return 'BE';
    if (phone.startsWith('41')) return 'CH';
    if (phone.startsWith('1')) return 'CA';
    return 'FR';
}

function firstNameFromEmail(email: string): string {
    const localPart = email.split('@')[0] || 'Manager';
    const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
    return cleaned
        ? cleaned.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
        : 'Manager';
}

function isAdminStart(message: string): boolean {
    return normalizeText(message) === 'admin start';
}

async function findManagerByWhatsAppNumber(from: string) {
    return prisma.employee.findFirst({
        where: {
            role: 'MANAGER',
            OR: [
                { phoneNumber: from },
                { phoneNumber: `+${from}` },
                { phoneNumber: { endsWith: from.slice(-9) } }
            ]
        },
        include: { tenant: true }
    });
}

async function sendManagerActivationAha(to: string, manager: any, phoneNumberId?: string) {
    const firstName = (manager.name || 'Manager').split(' ')[0];

    await sendInteractiveButtons(
        to,
        `👋 Bonjour *${firstName}* !\n\n` +
        `Vous êtes bien l'administrateur de *${manager.tenant.name}*.\n\n` +
        `✅ Votre manager WhatsApp est activé.\n\n` +
        `Pour voir la valeur tout de suite, invitez un premier collaborateur. Il pourra pointer depuis WhatsApp sans installer d'application.`,
        MANAGER_AHA_BUTTONS,
        phoneNumberId
    );
}

async function activateManagerWhatsApp(from: string, existingEmployee: any, phoneNumberId?: string): Promise<boolean> {
    const manager = existingEmployee?.role === 'MANAGER'
        ? existingEmployee
        : await findManagerByWhatsAppNumber(from);

    if (!manager) {
        await sendMessage(
            from,
            `⚠️ Je ne reconnais pas ce numéro administrateur.\n\n` +
            `Assurez-vous d'avoir utilisé ce numéro lors de votre inscription.\n\n` +
            `📞 Numéro reçu: +${from}`,
            phoneNumberId
        );
        console.log(`❌ Unknown manager number: ${from}`);
        return true;
    }

    try {
        await prisma.employee.update({
            where: { id: manager.id },
            data: {
                phoneNumber: from,
                hasCompletedOnboarding: true
            }
        });
    } catch (e) {
        console.log('Manager activation update skipped:', e);
    }

    await sendManagerActivationAha(from, manager, phoneNumberId);
    console.log(`✅ Manager ${manager.name} activated successfully`);
    return true;
}

function normalizeInvitePhone(rawPhone: string): string | null {
    const digits = rawPhone.trim().replace(/\D/g, '');

    if (digits.length < 8 || digits.length > 15) {
        return null;
    }

    return `+${digits}`;
}

async function findEmployeeInTenantByPhone(tenantId: string, phoneNumber: string) {
    const withoutPlus = phoneNumber.replace(/^\+/, '');
    return prisma.employee.findFirst({
        where: {
            tenantId,
            OR: [
                { phoneNumber },
                { phoneNumber: withoutPlus },
                { phoneNumber: `+${withoutPlus}` },
                { phoneNumber: { endsWith: withoutPlus.slice(-9) } }
            ]
        }
    });
}

async function sendEmployeeInvitation(employeePhone: string, employeeName: string, manager: any, phoneNumberId?: string) {
    const to = employeePhone.replace(/^\+/, '');
    const templateName = process.env.WHATSAPP_EMPLOYEE_INVITE_TEMPLATE;

    if (templateName) {
        const components: WhatsAppTemplateComponent[] = [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: employeeName },
                    { type: 'text', text: manager.tenant.name }
                ]
            }
        ];

        await sendTemplateMessage(
            to,
            templateName,
            process.env.WHATSAPP_EMPLOYEE_INVITE_TEMPLATE_LANG || 'fr',
            components,
            phoneNumberId
        );
        return 'template';
    }

    await sendMessage(
        to,
        `Bonjour ${employeeName},\n\n` +
        `Vous avez été invité sur WhatsPoint par *${manager.tenant.name}*.\n\n` +
        `Pour pointer votre arrivée, répondez simplement *Hi*.\n` +
        `Pour voir les options disponibles, répondez *Menu*.\n\n` +
        `WhatsPoint est un service édité par Astauria.`,
        phoneNumberId
    );
    return 'session_message';
}

async function createInvitedEmployee(manager: any, name: string, phoneNumber: string) {
    const site = await prisma.site.findFirst({
        where: { tenantId: manager.tenantId },
        orderBy: { name: 'asc' }
    });

    const existingEmployee = await findEmployeeInTenantByPhone(manager.tenantId, phoneNumber);
    if (existingEmployee) {
        if (existingEmployee.role === 'MANAGER') {
            throw new Error('PHONE_ALREADY_MANAGER');
        }

        return prisma.employee.update({
            where: { id: existingEmployee.id },
            data: {
                name,
                phoneNumber,
                siteId: existingEmployee.siteId || site?.id || null,
                workProfile: existingEmployee.workProfile || 'MOBILE'
            }
        });
    }

    return prisma.employee.create({
        data: {
            name,
            phoneNumber,
            role: 'EMPLOYEE',
            tenantId: manager.tenantId,
            siteId: site?.id || null,
            workProfile: 'MOBILE'
        }
    });
}

async function handleManagerAhaAction(selectedId: string, employee: any, from: string, phoneNumberId?: string): Promise<boolean> {
    if (!['btn_manager_invite_employee', 'btn_manager_demo_employee', 'btn_manager_demo_pointage', 'btn_manager_menu'].includes(selectedId)) {
        return false;
    }

    if (employee.role !== 'MANAGER') {
        await sendMessage(from, `Cette action est réservée aux managers.`, phoneNumberId);
        return true;
    }

    if (selectedId === 'btn_manager_menu') {
        await sendMainMenu(from, phoneNumberId);
        return true;
    }

    if (selectedId === 'btn_manager_invite_employee' || selectedId === 'btn_manager_demo_employee') {
        await prisma.employee.update({
            where: { id: employee.id },
            data: {
                conversationState: 'WAITING_EMPLOYEE_INVITE_NAME',
                tempExpenseData: Prisma.DbNull
            }
        });

        await sendMessage(
            from,
            `👤 *Inviter un collaborateur*\n\n` +
            `Quel est son nom complet ?\n\n` +
            `Exemple : *Marie Dupont*`,
            phoneNumberId
        );
        return true;
    }

    if (selectedId === 'btn_manager_demo_pointage') {
        await sendMessage(
            from,
            `🎬 *Simulation de pointage*\n\n` +
            `Dans WhatsPoint, un collaborateur écrit simplement *Hi* dans WhatsApp.\n\n` +
            `WhatsPoint enregistre la présence, rattache le pointage au site et rend l'information disponible dans le dashboard manager et vos outils métier.\n\n` +
            `Cliquez sur *Inviter employé* pour ajouter un vrai collaborateur et lui envoyer l'invitation.`,
            phoneNumberId
        );
        return true;
    }

    return false;
}

async function handleManagerInviteConversation(employee: any, messageBody: string, from: string, phoneNumberId?: string): Promise<boolean> {
    if (!['WAITING_EMPLOYEE_INVITE_NAME', 'WAITING_EMPLOYEE_INVITE_PHONE'].includes(employee.conversationState || '')) {
        return false;
    }

    if (employee.role !== 'MANAGER') {
        await prisma.employee.update({
            where: { id: employee.id },
            data: { conversationState: null, tempExpenseData: Prisma.DbNull }
        });
        return false;
    }

    const trimmed = messageBody.trim();
    if (!trimmed) return true;

    if (isCancellation(trimmed)) {
        await prisma.employee.update({
            where: { id: employee.id },
            data: { conversationState: null, tempExpenseData: Prisma.DbNull }
        });
        await sendMessage(from, `Invitation annulée.`, phoneNumberId);
        return true;
    }

    if (employee.conversationState === 'WAITING_EMPLOYEE_INVITE_NAME') {
        if (trimmed.length < 2 || trimmed.length > 80) {
            await sendMessage(from, `Répondez avec un nom complet, par exemple *Marie Dupont*.`, phoneNumberId);
            return true;
        }

        await prisma.employee.update({
            where: { id: employee.id },
            data: {
                conversationState: 'WAITING_EMPLOYEE_INVITE_PHONE',
                tempExpenseData: { inviteName: trimmed.slice(0, 80) }
            }
        });

        await sendMessage(
            from,
            `Merci. Quel est son numéro WhatsApp avec indicatif pays ?\n\n` +
            `Exemple : *+237690000000* ou *+33600000000*`,
            phoneNumberId
        );
        return true;
    }

    const tempData = employee.tempExpenseData as Record<string, any> | null;
    const inviteName = tempData?.inviteName;
    if (!inviteName) {
        await prisma.employee.update({
            where: { id: employee.id },
            data: { conversationState: 'WAITING_EMPLOYEE_INVITE_NAME', tempExpenseData: Prisma.DbNull }
        });
        await sendMessage(from, `Je n'ai plus le nom. Répondez avec le nom complet du collaborateur.`, phoneNumberId);
        return true;
    }

    const phoneNumber = normalizeInvitePhone(trimmed);
    if (!phoneNumber) {
        await sendMessage(from, `Le numéro ne semble pas valide. Utilisez le format international, par exemple *+237690000000*.`, phoneNumberId);
        return true;
    }

    try {
        const invitedEmployee = await createInvitedEmployee(employee, inviteName, phoneNumber);
        const deliveryMode = await sendEmployeeInvitation(phoneNumber, invitedEmployee.name || inviteName, employee, phoneNumberId);

        await prisma.employee.update({
            where: { id: employee.id },
            data: { conversationState: null, tempExpenseData: Prisma.DbNull }
        });

        await sendMessage(
            from,
            `✅ *Collaborateur ajouté !*\n\n` +
            `👤 ${invitedEmployee.name}\n` +
            `📱 ${phoneNumber}\n\n` +
            (deliveryMode === 'template'
                ? `L'invitation WhatsApp a été envoyée via template Meta.`
                : `J'ai tenté l'envoi WhatsApp direct. Si Meta bloque l'envoi proactif, il faudra valider le template d'invitation collaborateur.`) +
            `\n\nDès qu'il répond *Hi*, son premier pointage apparaîtra dans votre dashboard.`,
            phoneNumberId
        );
    } catch (error: any) {
        if (error.message === 'PHONE_ALREADY_MANAGER') {
            await sendMessage(from, `Ce numéro est déjà utilisé par un manager de votre espace.`, phoneNumberId);
        } else {
            console.error('Error inviting employee from WhatsApp:', error);
            await sendMessage(from, `❌ Impossible d'ajouter ce collaborateur pour le moment. Réessayez ou tapez *Annuler*.`, phoneNumberId);
        }
    }

    return true;
}

function startWhatsAppSignupSession(from: string) {
    whatsappSignupSessions.set(from, {
        step: 'WAITING_COMPANY',
        createdAt: Date.now()
    });
}

function getActiveSignupSession(from: string): SignupSession | null {
    const session = whatsappSignupSessions.get(from);
    if (!session) return null;

    if (Date.now() - session.createdAt > SIGNUP_SESSION_TTL_MS) {
        whatsappSignupSessions.delete(from);
        return null;
    }

    return session;
}

async function createWhatsAppTrialSpace(from: string, session: SignupSession, phoneNumberId?: string) {
    if (!session.companyName || !session.teamSize || !session.email) {
        await sendMessage(
            from,
            `⚠️ Il manque une information pour créer votre espace. Répondez *Créer un espace* pour recommencer.`,
            phoneNumberId
        );
        return;
    }

    const cleanPhone = from.replace(/\D/g, '');
    const existingManager = await prisma.employee.findFirst({
        where: {
            OR: [
                { phoneNumber: cleanPhone },
                { phoneNumber: `+${cleanPhone}` },
                { phoneNumber: { endsWith: cleanPhone.slice(-9) } }
            ]
        },
        include: { tenant: true }
    });

    if (existingManager) {
        const loginUrl = `${process.env.FRONTEND_URL || 'https://app.whatspoint.com'}/login?phone=%2B${cleanPhone}&source=whatsapp`;
        await sendMessage(
            from,
            `✅ Votre numéro est déjà rattaché à *${existingManager.tenant.name}*.\n\n` +
            `Connectez-vous ici avec le code WhatsApp :\n${loginUrl}`,
            phoneNumberId
        );
        return;
    }

    const country = inferCountryFromPhone(cleanPhone);
    const industryKey = 'GENERIC';
    const template = getTemplate(industryKey);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const maxEmployees = Math.max(5, session.teamSize);

    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
            data: {
                name: session.companyName!,
                country,
                industry: industryKey,
                config: JSON.parse(JSON.stringify(template.config)),
                vocabulary: JSON.parse(JSON.stringify(template.vocabulary)),
                plan: 'TRIAL',
                trialEndsAt,
                maxEmployees
            }
        });

        await tx.site.create({
            data: {
                name: 'Site principal',
                tenantId: tenant.id
            }
        });

        const manager = await tx.employee.create({
            data: {
                name: firstNameFromEmail(session.email!),
                phoneNumber: cleanPhone,
                role: 'MANAGER',
                tenantId: tenant.id,
                hasCompletedOnboarding: false
            }
        });

        const lead = await tx.externalLead.create({
            data: {
                companyName: session.companyName!,
                contactName: manager.name || 'Manager WhatsApp',
                email: session.email!,
                phone: `+${cleanPhone}`,
                source: 'WHATSAPP',
                status: 'WON',
                temperature: 'HOT',
                convertedToTenantId: tenant.id,
                convertedAt: new Date()
            }
        });

        await tx.leadNote.create({
            data: {
                externalLeadId: lead.id,
                content: `✅ Espace d'essai créé depuis WhatsApp (${session.teamSize} personnes déclarées).`,
                createdBy: 'whatsapp-bot'
            }
        });

        return { tenant, manager };
    });

    assignNumberToTenant(result.tenant.id, country)
        .catch(err => console.error('Number allocation failed after WhatsApp signup:', err));

    const frontendUrl = process.env.FRONTEND_URL || 'https://app.whatspoint.com';
    const loginUrl = `${frontendUrl}/login?phone=%2B${cleanPhone}&source=whatsapp`;

    await sendMessage(
        from,
        `✅ *Votre espace WhatsPoint est prêt !*\n\n` +
        `Entreprise : *${result.tenant.name}*\n` +
        `Équipe test : *${maxEmployees} personnes*\n\n` +
        `1. Ouvrez votre dashboard :\n${loginUrl}\n\n` +
        `2. Connectez-vous avec le code reçu sur WhatsApp.\n\n` +
        `3. Revenez ici et répondez *Admin Start* pour activer votre manager WhatsApp.`,
        phoneNumberId
    );
}

async function handleWhatsAppSignupSession(from: string, messageBody: string, phoneNumberId?: string): Promise<boolean> {
    const session = getActiveSignupSession(from);
    if (!session) return false;

    const trimmed = messageBody.trim();
    if (!trimmed) return true;

    if (isCancellation(trimmed)) {
        whatsappSignupSessions.delete(from);
        await sendMessage(from, `C'est noté, création annulée. Répondez *Demo WhatsPoint* pour recommencer.`, phoneNumberId);
        return true;
    }

    if (session.step === 'WAITING_COMPANY') {
        session.companyName = trimmed.slice(0, 80);
        session.step = 'WAITING_TEAM_SIZE';
        await sendMessage(
            from,
            `Parfait. Combien de personnes doivent pointer pendant le test ?\n\nExemple : *12*`,
            phoneNumberId
        );
        return true;
    }

    if (session.step === 'WAITING_TEAM_SIZE') {
        const match = trimmed.match(/\d+/);
        const teamSize = match ? parseInt(match[0], 10) : 0;

        if (!teamSize || teamSize < 1 || teamSize > 5000) {
            await sendMessage(from, `Répondez avec un nombre de personnes, par exemple *12*.`, phoneNumberId);
            return true;
        }

        session.teamSize = teamSize;
        session.step = 'WAITING_EMAIL';
        await sendMessage(
            from,
            `Merci. Quel email professionnel utiliser pour votre accès manager ?`,
            phoneNumberId
        );
        return true;
    }

    if (session.step === 'WAITING_EMAIL') {
        const email = trimmed.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            await sendMessage(from, `L'email ne semble pas valide. Exemple : *vous@entreprise.com*`, phoneNumberId);
            return true;
        }

        session.email = email;
        session.step = 'WAITING_CONFIRMATION';
        await sendMessage(
            from,
            `Je vais créer votre espace WhatsPoint :\n\n` +
            `🏢 Entreprise : *${session.companyName}*\n` +
            `👥 Équipe : *${session.teamSize} personnes*\n` +
            `✉️ Email admin : *${session.email}*\n\n` +
            `Répondez *Oui* pour confirmer ou *Annuler*.`,
            phoneNumberId
        );
        return true;
    }

    if (session.step === 'WAITING_CONFIRMATION') {
        if (!isAffirmative(trimmed)) {
            await sendMessage(from, `Répondez *Oui* pour confirmer, ou *Annuler* pour arrêter.`, phoneNumberId);
            return true;
        }

        await createWhatsAppTrialSpace(from, session, phoneNumberId);
        whatsappSignupSessions.delete(from);
        return true;
    }

    return false;
}

/**
 * Handles incoming events from WhatsApp.
 */
export const handleMessage = async (req: Request, res: Response): Promise<any> => {
    try {
        const body = req.body;
        console.log('📩 [Webhook] Request received:', JSON.stringify(body, null, 2));

        // Check if it's a WhatsApp event
        if (body.object === 'whatsapp_business_account') {
            // Iterate over entries
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    const value = change.value;

                    // Check if it's a message
                    if (value.messages && value.messages.length > 0) {
                        const message = value.messages[0];
                        const from = message.from; // e.g. "33612345678"
                        const messageType = message.type; // 'text', 'image', etc.
                        const messageBody = message.text?.body || '';
                        const phoneNumberId = value.metadata?.phone_number_id;

                        // CRITICAL: Extract the real message timestamp for offline support
                        // WhatsApp sends Unix epoch timestamp (seconds since 1970)
                        const whatsappTimestamp = message.timestamp;
                        const messageTimestamp = whatsappTimestamp
                            ? new Date(parseInt(whatsappTimestamp) * 1000)
                            : new Date();

                        console.log(`📩 Received ${messageType} message from ${from}`);
                        console.log(`📱 Received on phone ID: ${phoneNumberId}`);
                        console.log(`🕐 Message timestamp: ${messageTimestamp.toISOString()} (WhatsApp: ${whatsappTimestamp || 'none'})`);

                        // 1. Identify User
                        const employee = await identifyUser(`+${from}`);

                        if (!employee && messageType === 'text' && await handleWhatsAppSignupSession(from, messageBody, phoneNumberId)) {
                            continue;
                        }

                        // Handle "Admin Start" command for manager activation
                        if (messageType === 'text' && isAdminStart(messageBody)) {
                            console.log(`🔑 Processing ADMIN START activation from ${from}`);
                            await activateManagerWhatsApp(from, employee, phoneNumberId);
                            continue;
                        }

                        if (employee && messageType === 'text' && await handleManagerInviteConversation(employee, messageBody, from, phoneNumberId)) {
                            continue;
                        }

                        // ─── FSM: CUSTOMER INTERVENTION REQUEST BOT ───────────────
                        // If the sender is NOT an employee, check if they're a known customer
                        if (!employee) {
                            const senderPhoneNormalized = `+${from}`;
                            const customer = await prisma.customer.findFirst({
                                where: {
                                    phone: {
                                        in: [from, senderPhoneNormalized, `+${from}`.replace('+', '')]
                                    }
                                },
                                include: {
                                    tenant: { select: { id: true, name: true } },
                                    sites: { select: { id: true, name: true, address: true, city: true }, take: 5 },
                                },
                            });

                            if (customer) {
                                console.log(`🏢 Customer detected: ${customer.companyName} (${customer.contactName})`);
                                const senderProfile = value.contacts?.[0]?.profile?.name || customer.contactName;

                                // Handle button replies from customer
                                if (messageType === 'interactive' && message.interactive?.type === 'button_reply') {
                                    const btnId = message.interactive?.button_reply?.id;

                                    if (btnId === 'btn_customer_request') {
                                        // Customer wants to request an intervention
                                        await sendMessage(
                                            from,
                                            `📝 *Décrivez votre besoin*\n\n` +
                                            `Envoyez-nous un message décrivant votre problème ou besoin d'intervention.\n\n` +
                                            `💡 Vous pouvez aussi envoyer une *photo* du problème.\n\n` +
                                            `_Exemple: "Ma climatisation ne fonctionne plus, il fait très chaud dans les bureaux"_`,
                                            phoneNumberId
                                        );
                                        // Mark this customer as waiting for request description
                                        await prisma.customer.update({
                                            where: { id: customer.id },
                                            data: { notes: `__WAITING_REQUEST__${customer.notes || ''}` },
                                        });
                                        continue;
                                    }

                                    if (btnId === 'btn_customer_other') {
                                        await sendMessage(
                                            from,
                                            `📞 Pour toute autre demande, contactez-nous directement.\n\n` +
                                            `— ${customer.tenant.name}`,
                                            phoneNumberId
                                        );
                                        continue;
                                    }
                                }

                                // Check if customer is in "waiting for request" state
                                const isWaiting = customer.notes?.startsWith('__WAITING_REQUEST__');

                                if (isWaiting && (messageType === 'text' || messageType === 'image')) {
                                    // Create intervention request
                                    let requestMessage = messageBody;
                                    let photoUrl: string | null = null;

                                    if (messageType === 'image' && message.image?.id) {
                                        requestMessage = message.image?.caption || 'Photo envoyée';
                                        try {
                                            const { downloadAndSaveMetaImage } = await import('../services/storageService');
                                            const accessToken = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN || '';
                                            photoUrl = await downloadAndSaveMetaImage(message.image.id, accessToken);
                                        } catch (e) {
                                            console.error('Error downloading customer photo:', e);
                                        }
                                    }

                                    // Detect urgency keywords
                                    const urgentKeywords = ['urgent', 'urgence', 'immédiat', 'danger', 'fuite', 'panne', 'bloqué', 'critique'];
                                    const isUrgent = urgentKeywords.some(k => requestMessage.toLowerCase().includes(k));

                                    // Create the request
                                    const request = await prisma.interventionRequest.create({
                                        data: {
                                            message: requestMessage,
                                            photoUrl,
                                            urgency: isUrgent ? 'URGENT' : 'NORMAL',
                                            senderPhone: from,
                                            senderName: senderProfile,
                                            customerId: customer.id,
                                            tenantId: customer.tenant.id,
                                        },
                                    });

                                    // Clean customer waiting state
                                    await prisma.customer.update({
                                        where: { id: customer.id },
                                        data: { notes: (customer.notes || '').replace('__WAITING_REQUEST__', '') || null },
                                    });

                                    // Confirm to customer
                                    await sendMessage(
                                        from,
                                        `✅ *Demande enregistrée !*\n\n` +
                                        `Bonjour ${customer.contactName},\n\n` +
                                        `Votre demande d'intervention a été transmise à notre équipe${isUrgent ? ' en **PRIORITÉ**' : ''}.\n` +
                                        `📋 Référence : #${request.id.slice(0, 8)}\n\n` +
                                        `Vous serez notifié dès qu'un technicien sera assigné.\n\n` +
                                        `— ${customer.tenant.name}`,
                                        phoneNumberId
                                    );

                                    // Notify all managers of this tenant
                                    const managers = await prisma.employee.findMany({
                                        where: { tenantId: customer.tenant.id, role: 'MANAGER' },
                                        select: { phoneNumber: true, name: true },
                                    });

                                    for (const mgr of managers) {
                                        if (mgr.phoneNumber) {
                                            await sendMessage(
                                                mgr.phoneNumber.replace('+', ''),
                                                `📩 *Nouvelle demande d'intervention !*\n\n` +
                                                `🏢 Client : *${customer.companyName}*\n` +
                                                `👤 Contact : ${customer.contactName}\n` +
                                                (isUrgent ? `🔴 *URGENT*\n` : '') +
                                                `\n💬 _"${requestMessage.slice(0, 200)}"_\n\n` +
                                                `📋 Réf: #${request.id.slice(0, 8)}\n\n` +
                                                `Rendez-vous dans Opérations → Demandes pour traiter.`,
                                                phoneNumberId
                                            );
                                        }
                                    }

                                    console.log(`📩 Intervention request ${request.id} created for customer ${customer.companyName}`);
                                    continue;
                                }

                                // Default: send customer greeting with buttons
                                const cooldownKey = `customer_greeting_${from}`;
                                const lastSent = magicLinkCooldowns.get(cooldownKey);
                                const now = Date.now();
                                if (lastSent && (now - lastSent) < 30 * 60 * 1000) { // 30min cooldown
                                    // If within cooldown but text message, treat as request description
                                    if (messageType === 'text' && messageBody.length > 5) {
                                        // Auto-create request without waiting
                                        const urgentKeywords = ['urgent', 'urgence', 'immédiat', 'danger', 'fuite', 'panne', 'bloqué', 'critique'];
                                        const isUrgent = urgentKeywords.some(k => messageBody.toLowerCase().includes(k));

                                        const request = await prisma.interventionRequest.create({
                                            data: {
                                                message: messageBody,
                                                urgency: isUrgent ? 'URGENT' : 'NORMAL',
                                                senderPhone: from,
                                                senderName: senderProfile,
                                                customerId: customer.id,
                                                tenantId: customer.tenant.id,
                                            },
                                        });

                                        await sendMessage(
                                            from,
                                            `✅ *Demande enregistrée !*\n\n` +
                                            `Votre demande a été transmise à notre équipe.\n` +
                                            `📋 Réf: #${request.id.slice(0, 8)}\n\n` +
                                            `— ${customer.tenant.name}`,
                                            phoneNumberId
                                        );

                                        // Notify managers
                                        const managers = await prisma.employee.findMany({
                                            where: { tenantId: customer.tenant.id, role: 'MANAGER' },
                                            select: { phoneNumber: true },
                                        });
                                        for (const mgr of managers) {
                                            if (mgr.phoneNumber) {
                                                await sendMessage(
                                                    mgr.phoneNumber.replace('+', ''),
                                                    `📩 *Nouvelle demande d'intervention*\n\n` +
                                                    `🏢 *${customer.companyName}*\n` +
                                                    (isUrgent ? `🔴 *URGENT*\n` : '') +
                                                    `💬 _"${messageBody.slice(0, 200)}"_\n\n` +
                                                    `📋 Réf: #${request.id.slice(0, 8)}`,
                                                    phoneNumberId
                                                );
                                            }
                                        }
                                        continue;
                                    }
                                    continue;
                                }

                                // Send customer greeting with intervention request button
                                await sendInteractiveButtons(
                                    from,
                                    `👋 Bonjour *${customer.contactName}* !\n\n` +
                                    `Vous êtes client de *${customer.tenant.name}*.\n` +
                                    `Comment pouvons-nous vous aider ?`,
                                    [
                                        { id: 'btn_customer_request', title: '🔧 Intervention' },
                                        { id: 'btn_customer_other', title: '📞 Autre demande' },
                                    ],
                                    phoneNumberId
                                );
                                magicLinkCooldowns.set(cooldownKey, Date.now());
                                console.log(`🏢 Customer greeting sent to ${customer.contactName} (${from})`);
                                continue;
                            }
                        }

                        if (!employee) {
                            // Check if this is a button reply from an unknown user
                            if (messageType === 'interactive' && message.interactive?.type === 'button_reply') {
                                const buttonId = message.interactive?.button_reply?.id;

                                if (buttonId === 'btn_signup') {
                                    startWhatsAppSignupSession(from);
                                    await sendMessage(
                                        from,
                                        `🚀 C'est parti.\n\n` +
                                        `On peut préparer votre espace directement ici, dans WhatsApp.\n\n` +
                                        `Quel est le nom de votre entreprise ?`,
                                        phoneNumberId
                                    );
                                    console.log(`🧭 WhatsApp signup started for ${from}`);
                                    continue;
                                }

                                if (buttonId === 'btn_info') {
                                    await sendMessage(
                                        from,
                                        `📱 *Démo WhatsPoint*\n\n` +
                                        `WhatsPoint permet à vos équipes de pointer, consulter leurs plannings et envoyer leurs demandes depuis WhatsApp.\n\n` +
                                        `✅ Pointage et présence\n` +
                                        `✅ Planning consultable\n` +
                                        `✅ Justificatifs et demandes terrain\n` +
                                        `✅ Transmission vers vos outils métier\n\n` +
                                        `Répondez à ce message si vous souhaitez parler à l'équipe Astauria.`,
                                        phoneNumberId
                                    );
                                    console.log(`ℹ️ Info message sent to ${from} after btn_info click`);
                                    continue;
                                }
                            }

                            if (messageType === 'text' && isLandingDemoRequest(messageBody)) {
                                console.log(`🎯 Landing demo request received from unknown number: ${from}`);
                                const platformConfig = await prisma.platformConfig.findFirst();
                                const welcomeText = platformConfig?.botWelcomeText || DEFAULT_UNKNOWN_CONTACT_WELCOME;
                                const btn1Label = (platformConfig?.botBtn1Label || DEFAULT_UNKNOWN_CONTACT_BTN_1).slice(0, 20);
                                const btn2Label = (platformConfig?.botBtn2Label || DEFAULT_UNKNOWN_CONTACT_BTN_2).slice(0, 20);

                                await sendInteractiveButtons(
                                    from,
                                    `👋 Bienvenue sur WhatsPoint.\n\n${welcomeText}`,
                                    [
                                        { id: 'btn_signup', title: btn1Label },
                                        { id: 'btn_info', title: btn2Label }
                                    ],
                                    phoneNumberId
                                );

                                magicLinkCooldowns.set(`magic_link_sent_${from}`, Date.now());
                                continue;
                            }

                            // Unknown user - Send interactive buttons (anti-spam: 1x per 24h)
                            const cooldownKey = `magic_link_sent_${from}`;
                            const lastSent = magicLinkCooldowns.get(cooldownKey);
                            const now = Date.now();
                            const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

                            if (lastSent && (now - lastSent) < COOLDOWN_MS) {
                                console.log(`⏳ Welcome already sent to ${from} within 24h, skipping`);
                                continue;
                            }

                            // Fetch dynamic bot config from database
                            const platformConfig = await prisma.platformConfig.findFirst();
                            const welcomeText = platformConfig?.botWelcomeText || DEFAULT_UNKNOWN_CONTACT_WELCOME;
                            const btn1Label = (platformConfig?.botBtn1Label || DEFAULT_UNKNOWN_CONTACT_BTN_1).slice(0, 20); // Max 20 chars
                            const btn2Label = (platformConfig?.botBtn2Label || DEFAULT_UNKNOWN_CONTACT_BTN_2).slice(0, 20);

                            // Send interactive buttons with dynamic config
                            await sendInteractiveButtons(
                                from,
                                `👋 Bonjour !\n\n${welcomeText}`,
                                [
                                    { id: 'btn_signup', title: btn1Label },
                                    { id: 'btn_info', title: btn2Label }
                                ],
                                phoneNumberId
                            );

                            // Record cooldown
                            magicLinkCooldowns.set(cooldownKey, now);
                            console.log(`📧 Interactive welcome buttons sent to unknown number: ${from}`);
                            continue;
                        }

                        // 2. Handle LOCATION messages - Geographic validation with Geofencing
                        if (messageType === 'location' && message.location) {
                            console.log(`📍 Processing LOCATION for ${employee.name} (workProfile: ${employee.workProfile || 'MOBILE'})`);
                            const { latitude, longitude } = message.location;

                            // Check if employee has an active attendance record today
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const endOfDay = new Date(today);
                            endOfDay.setHours(23, 59, 59, 999);

                            const todayAttendance = await prisma.attendance.findFirst({
                                where: {
                                    employeeId: employee.id,
                                    tenantId: employee.tenantId,
                                    checkIn: { gte: today, lte: endOfDay }
                                }
                            });

                            if (!todayAttendance) {
                                await sendMessage(
                                    from,
                                    `⚠️ Vous devez d'abord pointer votre entrée avec \"Hi\" avant d'envoyer votre position.`,
                                    phoneNumberId
                                );
                                continue;
                            }

                            // GEOFENCING: Check location compliance based on workProfile
                            const complianceResult = await checkLocationCompliance(
                                employee,
                                latitude,
                                longitude
                            );

                            console.log(`📍 Geofencing result for ${employee.name}: ${JSON.stringify(complianceResult)}`);

                            // Update attendance record with GPS data and warning flag
                            await prisma.attendance.update({
                                where: { id: todayAttendance.id },
                                data: {
                                    latitude,
                                    longitude,
                                    distanceFromSite: complianceResult.distance,
                                    locationWarning: complianceResult.warning
                                }
                            });

                            // If out of zone, notify managers
                            if (complianceResult.warning) {
                                const distanceKm = complianceResult.distance ? (complianceResult.distance / 1000).toFixed(1) : '?';
                                await notifyAllManagers(
                                    employee.tenantId,
                                    'GEOFENCE',
                                    'Pointage hors zone',
                                    `📍 ${employee.name || 'Un employé'} a pointé HORS ZONE (Distance: ${distanceKm} km).`,
                                    employee.id
                                );
                            }

                            await sendMessage(from, complianceResult.message, phoneNumberId);
                            continue;
                        }

                        // 3. Handle IMAGE messages - Check conversation state first
                        if (messageType === 'image' && message.image?.id) {
                            // EXPENSE WORKFLOW: Photo step
                            if (employee.conversationState === 'WAITING_EXPENSE_PHOTO') {
                                console.log(`🧾 Processing EXPENSE PHOTO for ${employee.name}`);
                                try {
                                    const accessToken = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN || '';
                                    const photoUrl = await downloadAndSaveMetaImage(message.image.id, accessToken);

                                    await sendMessage(from, `🤖 🔍 *Vision IA* : Je lis votre ticket de caisse, un instant...`, phoneNumberId);
                                    
                                    const { extractExpenseDataFromImage } = require('../services/aiAgentService');
                                    const aiResult = await extractExpenseDataFromImage(photoUrl);

                                    if (aiResult && aiResult.amount) {
                                        await updateTempExpenseData(employee.id, { 
                                            photoUrl, 
                                            amount: aiResult.amount,
                                            tva: aiResult.tva,
                                            merchant: aiResult.merchant,
                                            category: aiResult.category
                                        });
                                        await setConversationState(employee.id, 'WAITING_EXPENSE_CATEGORY');
                                        
                                        const tvaLine = aiResult.tva ? `TVA : *${aiResult.tva.toFixed(2)} ${aiResult.currency}*\n` : '';
                                        
                                        await sendInteractiveButtons(
                                            from,
                                            `✅ *Lecture Automatique (Phase 4) Réussie*\nMontant TTC : *${aiResult.amount.toFixed(2)} ${aiResult.currency}*\n${tvaLine}Fournisseur : *${aiResult.merchant}*\n\n📂 Confirmez ou ajustez la catégorie :`,
                                            EXPENSE_CATEGORY_BUTTONS,
                                            phoneNumberId
                                        );
                                    } else {
                                        await updateTempExpenseData(employee.id, { photoUrl });
                                        await setConversationState(employee.id, 'WAITING_EXPENSE_AMOUNT');
                                        await sendMessage(
                                            from,
                                            `❌ *Lecture IA Échouée*\nJe n'ai pas pu lire le montant sur cette photo.\n\n💰 Quel est le montant de la dépense ?\n(Ex: 25.50)`,
                                            phoneNumberId
                                        );
                                    }
                                } catch (error) {
                                    console.error('❌ Error processing expense photo:', error);
                                    await sendMessage(from, `❌ Erreur lors du traitement de la photo. Réessayez.`, phoneNumberId);
                                }
                                continue;
                            }

                            // SICK LEAVE: Medical certificate upload
                            if (employee.conversationState === 'WAITING_SICK_PHOTO') {
                                console.log(`🤒 Processing SICK LEAVE PHOTO for ${employee.name}`);
                                try {
                                    const accessToken = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN || '';
                                    const photoUrl = await downloadAndSaveMetaImage(message.image.id, accessToken);

                                    await sendMessage(from, `🤖 🔍 *Lecteur IA* : Analyse de votre arrêt de travail en cours...`, phoneNumberId);
                                    
                                    const { extractMedicalCertificateDataFromImage } = require('../services/aiAgentService');
                                    const aiResult = await extractMedicalCertificateDataFromImage(photoUrl);

                                    if (aiResult.isValidDocument && aiResult.startDate && aiResult.endDate) {
                                        // Create the LeaveRequest autonomously!
                                        const sickLeave = await prisma.leaveRequest.create({
                                            data: {
                                                startDate: new Date(aiResult.startDate),
                                                endDate: new Date(aiResult.endDate),
                                                type: 'SICK',
                                                status: 'PENDING',
                                                documentUrl: photoUrl,
                                                employeeId: employee.id,
                                                tenantId: employee.tenantId
                                            }
                                        });

                                        await setConversationState(employee.id, null);

                                        await sendMessage(
                                            from,
                                            `✅ *Analyse Réussie*\nArrêt maladie déposé automatiquement du *${new Date(aiResult.startDate).toLocaleDateString('fr-FR')}* au *${new Date(aiResult.endDate).toLocaleDateString('fr-FR')}*.\n🧑‍⚕️ Médecin: ${aiResult.doctorName}\n\nLe justificatif a été transmis à votre service RH. Bon rétablissement !`,
                                            phoneNumberId
                                        );

                                        // Optional: Fire webhook for HR module (KPaie/MediPlan)
                                        await dispatchWebhook(WEBHOOK_EVENTS.LEAVE_REQUESTED, {
                                            employeeId: employee.id,
                                            employeeName: employee.name,
                                            type: 'SICK',
                                            documentUrl: absoluteSignedUploadUrlIfNeeded(
                                                process.env.BACKEND_URL || process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3000',
                                                photoUrl,
                                                60 * 60
                                            ),
                                            startDate: sickLeave.startDate.toISOString(),
                                            endDate: sickLeave.endDate.toISOString()
                                        }, employee.tenantId);
                                    } else {
                                        await setConversationState(employee.id, null);
                                        await sendMessage(from, `❌ *Analyse Échouée*\nJe n'ai pas pu valider ce document comme un arrêt de travail CERFA.\nVeuillez contacter les RH manuellement.`, phoneNumberId);
                                    }
                                } catch (error) {
                                    console.error('❌ Error processing sick photo:', error);
                                    await sendMessage(from, `❌ Erreur de l'Agent lors de la lecture. Réessayez.`, phoneNumberId);
                                }
                                continue;
                            }

                            // ATTENDANCE: Photo for check-in
                            console.log(`📷 Processing PHOTO ATTENDANCE for ${employee.name}`);

                            // Check if employee has an active attendance record today (already checked in)
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const endOfDay = new Date(today);
                            endOfDay.setHours(23, 59, 59, 999);

                            const todayAttendance = await prisma.attendance.findFirst({
                                where: {
                                    employeeId: employee.id,
                                    tenantId: employee.tenantId, // SECURITY: tenant isolation
                                    checkIn: {
                                        gte: today,
                                        lte: endOfDay
                                    }
                                }
                            });

                            if (!todayAttendance) {
                                await sendMessage(
                                    from,
                                    `⚠️ Vous devez d'abord pointer votre entrée avec "Hi" avant d'envoyer une photo.`,
                                    phoneNumberId
                                );
                                continue;
                            }

                            try {
                                // Download image from Meta (temporary URL) and save to our storage
                                const accessToken = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN || '';
                                const photoUrl = await downloadAndSaveMetaImage(message.image.id, accessToken);

                                // Update attendance record with photo URL
                                await prisma.attendance.update({
                                    where: { id: todayAttendance.id },
                                    data: { photoUrl }
                                });

                                console.log(`✅ Photo saved for ${employee.name}: ${photoUrl}`);

                                await sendMessage(
                                    from,
                                    `📷 Photo bien reçue et ajoutée à ton dossier ! ✅`,
                                    phoneNumberId
                                );
                            } catch (error) {
                                console.error('❌ Error processing photo:', error);
                                await sendMessage(
                                    from,
                                    `❌ Erreur lors du traitement de la photo. Réessayez.`,
                                    phoneNumberId
                                );
                            }
                            continue;
                        }

                        // Check SICK leave dates
                        if (employee.conversationState === 'WAITING_SICK_DATE') {
                            const parsedDate = parseLeaveRequest(messageBody);
                            if (parsedDate) {
                                // For an illness started "today" and ends on parsedDate
                                const todayDateObj = new Date();
                                const endDateObj = new Date(); // Need logic to map parsedDate, parseLeaveRequest returns "YYYY-MM-DD"
                                
                                // Since parseLeaveRequest returns YYYY-MM-DD or similar text in format 'DD/MM/YYYY', 
                                // we actually use createRequest equivalent or write a simple parser.
                                // Actually we know parseLeaveRequest returns 'YYYY-MM-DD' since it's formatting it.
                                let endDate = new Date(parsedDate);
                                if (isNaN(endDate.getTime())) {
                                    // Not a valid DB date directly
                                    endDate = new Date();
                                }
                                
                                await prisma.leaveRequest.create({
                                    data: {
                                        startDate: new Date(),
                                        endDate: endDate,
                                        type: 'SICK',
                                        status: 'PENDING',
                                        employeeId: employee.id,
                                        tenantId: employee.tenantId
                                    }
                                });

                                await setConversationState(employee.id, 'WAITING_SICK_PHOTO');
                                await sendMessage(from, `📸 Date enregistrée. Veuillez maintenant envoyer la *photo de votre arrêt de travail / justificatif*.`, phoneNumberId);
                            } else {
                                await sendMessage(from, `⚠️ Format non reconnu. Exemple : "Jusqu'au 20/03"`, phoneNumberId);
                            }
                            continue;
                        }

                        // NLP Parsing for LEAVE (Intelligent Business Days Calculation)
                        if (employee.conversationState === 'WAITING_LEAVE') {
                            await sendMessage(from, `🧠 _Analyse de vos dates (calcul des jours ouvrés)..._`, phoneNumberId);
                            const { parseNaturalLanguageLeave } = require('../services/aiAgentService');
                            const nlpResult = await parseNaturalLanguageLeave(messageBody);

                            if (!nlpResult.isValid) {
                                await sendMessage(from, `⚠️ Je n'ai pas pu comprendre les dates. Exemple : "Du 12 au 15 juin".`, phoneNumberId);
                                continue;
                            }

                            // Store NLP result and ask for confirmation
                            await prisma.employee.update({
                                where: { id: employee.id },
                                data: {
                                    conversationState: 'WAITING_LEAVE_CONFIRMATION',
                                    tempLeaveData: nlpResult as any
                                }
                            });

                            const sDate = new Date(nlpResult.startDate).toLocaleDateString('fr-FR');
                            const eDate = new Date(nlpResult.endDate).toLocaleDateString('fr-FR');
                            const detail = nlpResult.isHalfDayStart ? ' (Matin/Aprem pris en compte)' : '';

                            await sendMessage(from, `📅 *Récapitulatif de votre demande :*\n\nDu ${sDate} au ${eDate}${detail}\nCela représente *${nlpResult.businessDays} jours ouvrés*.\n\nSouhaitez-vous valider ?\nRépondez *OUI* ou *NON*.`, phoneNumberId);
                            continue;
                        }

                        if (employee.conversationState === 'WAITING_LEAVE_CONFIRMATION') {
                            if (messageBody.toLowerCase().includes('oui') || messageBody.toLowerCase() === 'ok' || messageBody.toLowerCase() === 'valider') {
                                const nlpData = employee.tempLeaveData as any;
                                if (!nlpData) {
                                    await setConversationState(employee.id, null);
                                    await sendMessage(from, `❌ Erreur de session. Veuillez recommencer la demande.`, phoneNumberId);
                                    continue;
                                }

                                await sendMessage(from, `⏳ Validation ERP et envoi au manager...`, phoneNumberId);
                                
                                // Call createRequest with the NLP data to bypass regex
                                const result = await createRequest(employee, null, nlpData);

                                if (!result.success) {
                                    await sendMessage(from, result.message, phoneNumberId);
                                } else {
                                    if (result.request && result.managerPhoneNumber) {
                                        const requestIdShort = result.request.id.slice(0, 8);
                                        const sDate = new Date(result.request.startDate).toLocaleDateString('fr-FR');
                                        const eDate = new Date(result.request.endDate).toLocaleDateString('fr-FR');
                                        
                                        const managerMessage =
                                            `📋 *Nouvelle demande de congé*\n\n` +
                                            `👤 De: *${employee.name}*\n` +
                                            `📅 Date: *Du ${sDate} au ${eDate}*\n` +
                                            `🆔 ID: *#${requestIdShort}*\n` +
                                            (result.kpaiePreCheckContext ? `${result.kpaiePreCheckContext}\n` : `\n`) +
                                            `Veuillez prendre une décision :`;

                                        await sendInteractiveButtons(
                                            result.managerPhoneNumber.replace('+', ''),
                                            managerMessage,
                                            [
                                                { id: `OK_${requestIdShort}`, title: "✅ Accepter" },
                                                { id: `NON_${requestIdShort}`, title: "❌ Refuser" }
                                            ],
                                            phoneNumberId
                                        );
                                    }
                                    await sendMessage(from, `✅ Demande confirmée et envoyée à votre manager.\nVous recevrez une notification de sa décision.`, phoneNumberId);
                                }
                                await prisma.employee.update({
                                    where: { id: employee.id },
                                    data: { conversationState: null }
                                });
                            } else {
                                await prisma.employee.update({
                                    where: { id: employee.id },
                                    data: { conversationState: null }
                                });
                                await sendMessage(from, `❌ Demande annulée.`, phoneNumberId);
                            }
                            continue;
                        }

                        // 4. Check for old leave request pattern first (Fallback)
                        const leaveDate = parseLeaveRequest(messageBody);
                        if (leaveDate) {
                            console.log(`📅 Processing LEAVE REQUEST for ${employee.name}: ${leaveDate}`);

                            const result = await createRequest(employee, leaveDate);

                            if (!result.success) {
                                await sendMessage(from, result.message, phoneNumberId);
                                continue;
                            }

                            if (result.success && result.request && result.managerPhoneNumber) {
                                // Format the date for display
                                let periodStr = '';
                                if (result.request.isHalfDayStart && !result.request.isHalfDayEnd) {
                                    periodStr = ' (Après-midi)';
                                } else if (!result.request.isHalfDayStart && result.request.isHalfDayEnd) {
                                    periodStr = ' (Matin)';
                                }
                                
                                const formattedDate = formatDateForMessage(result.request.startDate) + periodStr;
                                const requestIdShort = result.request.id.slice(0, 8);

                                // Notify the manager via Interactive Buttons (Phase 4)
                                const managerMessage =
                                    `📋 *Nouvelle demande de congé*\n\n` +
                                    `👤 De: *${employee.name}*\n` +
                                    `📅 Date: *${formattedDate}*\n` +
                                    `🆔 ID: *#${requestIdShort}*\n` +
                                    (result.kpaiePreCheckContext ? `${result.kpaiePreCheckContext}\n` : `\n`) +
                                    `Veuillez prendre une décision :`;

                                await sendInteractiveButtons(
                                    result.managerPhoneNumber.replace('+', ''),
                                    managerMessage,
                                    [
                                        { id: `OK_${requestIdShort}`, title: "✅ Accepter" },
                                        { id: `NON_${requestIdShort}`, title: "❌ Refuser" }
                                    ],
                                    phoneNumberId
                                );

                                // Confirm to employee
                                await sendMessage(
                                    from,
                                    `✅ Demande de congé envoyée au manager pour le ${formattedDate}.\n\nVous recevrez une notification dès qu'elle sera traitée.`,
                                    phoneNumberId
                                );

                                // Trigger Webhook to KPaie API
                                await dispatchWebhook(
                                    WEBHOOK_EVENTS.LEAVE_REQUESTED,
                                    {
                                        employeeId: employee.id,
                                        employeeName: employee.name,
                                        leaveDate: formattedDate,
                                        requestId: result.request.id,
                                    },
                                    employee.tenantId
                                );
                            } else {
                                await sendMessage(from, `⚠️ ${result.message}`, phoneNumberId);
                            }
                            continue;
                        }

                        // 3. Check for manager response pattern
                        if (employee.role === 'MANAGER' && isManagerResponse(messageBody)) {
                            console.log(`👔 Processing MANAGER RESPONSE from ${employee.name}: ${messageBody}`);

                            const result = await handleManagerResponse(employee, messageBody);

                            if (result.success && result.employeePhoneNumber) {
                                // Notify manager of success
                                await sendMessage(from, `✅ ${result.message}`, phoneNumberId);

                                // Notify employee of the decision
                                const employeeMessage = result.status === 'APPROVED'
                                    ? `🎉 *Bonne nouvelle !*\n\nVotre demande de congé #${result.requestId} a été *approuvée* par votre manager ! 😎`
                                    : `😔 *Demande refusée*\n\nVotre demande de congé #${result.requestId} a été *refusée* par votre manager. Contactez-le pour plus d'informations.`;

                                await sendMessage(
                                    result.employeePhoneNumber.replace('+', ''),
                                    employeeMessage,
                                    phoneNumberId
                                );
                            } else {
                                await sendMessage(from, `⚠️ ${result.message}`, phoneNumberId);
                            }
                            continue;
                        }

                        // 4. Handle INTERACTIVE message type (button clicks from list menu)
                        if (messageType === 'interactive') {
                            const interactiveType = message.interactive?.type;
                            let selectedId: string | null = null;

                            if (interactiveType === 'list_reply') {
                                selectedId = message.interactive?.list_reply?.id;
                            } else if (interactiveType === 'button_reply') {
                                selectedId = message.interactive?.button_reply?.id;
                            }

                            if (selectedId && await handleManagerAhaAction(selectedId, employee, from, phoneNumberId)) {
                                continue;
                            }

                            if (selectedId && INTERACTIVE_ID_TO_COMMAND[selectedId]) {
                                const mappedCommand = INTERACTIVE_ID_TO_COMMAND[selectedId];
                                console.log(`🎛️ Interactive reply: ${selectedId} -> ${mappedCommand}`);

                                // Route to unified command processing
                                await processCommand(mappedCommand, employee, from, phoneNumberId, messageTimestamp);
                                continue;
                            }

                            // Handle expense category selection
                            if (selectedId && EXPENSE_CATEGORY_MAPPING[selectedId]) {
                                if (employee.conversationState === 'WAITING_EXPENSE_CATEGORY') {
                                    console.log(`🧾 Processing EXPENSE CATEGORY for ${employee.name}: ${selectedId}`);
                                    const category = EXPENSE_CATEGORY_MAPPING[selectedId];
                                    const tempData = employee.tempExpenseData as Record<string, any>;

                                    if (tempData?.photoUrl && tempData?.amount) {
                                        const expense = await createExpense(
                                            employee.id,
                                            employee.tenantId,
                                            tempData.photoUrl,
                                            tempData.amount,
                                            category,
                                            tempData.merchant,
                                            tempData.tva
                                        );

                                        await sendMessage(
                                            from,
                                            `✅ Note de frais de *${tempData.amount.toFixed(2)} €* enregistrée !\n\n` +
                                            `📋 Catégorie: ${EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES]}\n` +
                                            `📝 Statut: En attente de validation`,
                                            phoneNumberId
                                        );
                                    } else {
                                        await sendMessage(from, `❌ Erreur: données manquantes. Veuillez recommencer.`, phoneNumberId);
                                        await setConversationState(employee.id, null);
                                    }
                                    continue;
                                }
                            }

                            console.log(`⚠️ Unknown interactive ID: ${selectedId}`);
                            await sendMessage(from, '❌ Action non reconnue.', phoneNumberId);
                            continue;
                        }

                        // 5. Check if user wants to see the menu (trigger words)
                        if (shouldShowMenu(messageBody)) {
                            console.log(`📋 Showing MENU to ${employee.name}`);
                            await sendMainMenu(from, phoneNumberId);
                            continue;
                        }

                        // 5.5 Check for "frais" trigger to start expense workflow
                        if (messageBody.toLowerCase().trim() === 'frais') {
                            console.log(`🧾 Starting EXPENSE workflow for ${employee.name}`);
                            await setConversationState(employee.id, 'WAITING_EXPENSE_PHOTO');
                            await sendMessage(
                                from,
                                `🧾 *Nouvelle note de frais*\n\n📸 Envoyez la photo du ticket.`,
                                phoneNumberId
                            );
                            continue;
                        }

                        // 5.6 Handle WAITING_EXPENSE_AMOUNT state (parse amount from text)
                        if (employee.conversationState === 'WAITING_EXPENSE_AMOUNT') {
                            console.log(`💰 Processing EXPENSE AMOUNT for ${employee.name}: ${messageBody}`);
                            const amountStr = messageBody.replace(',', '.').trim();
                            const amount = parseFloat(amountStr);

                            if (isNaN(amount) || amount <= 0) {
                                await sendMessage(
                                    from,
                                    `❌ Montant invalide. Veuillez entrer un nombre valide (ex: 25.50)`,
                                    phoneNumberId
                                );
                                continue;
                            }

                            // Save amount and move to category selection
                            await updateTempExpenseData(employee.id, { amount });
                            await setConversationState(employee.id, 'WAITING_EXPENSE_CATEGORY');

                            // Send category buttons
                            await sendInteractiveButtons(
                                from,
                                `💰 Montant: *${amount.toFixed(2)} €*\n\n📂 Choisissez la catégorie:`,
                                EXPENSE_CATEGORY_BUTTONS,
                                phoneNumberId
                            );
                            continue;
                        }

                        // 5.7 Handle WAITING_DOC_SELECTION state (user selects document by number)
                        if (employee.conversationState === 'WAITING_DOC_SELECTION') {
                            console.log(`📂 Processing DOC SELECTION for ${employee.name}: ${messageBody}`);
                            const docIndex = parseInt(messageBody.trim()) - 1; // Convert to 0-indexed
                            const tempData = employee.tempExpenseData as Record<string, any>;
                            const documentIds = tempData?.documentIds as string[];

                            if (isNaN(docIndex) || docIndex < 0 || !documentIds || docIndex >= documentIds.length) {
                                await sendMessage(
                                    from,
                                    `❌ Numéro invalide. Répondez avec un numéro entre 1 et ${documentIds?.length || 0}.`,
                                    phoneNumberId
                                );
                                continue;
                            }

                            // Get the selected document
                            const selectedDocId = documentIds[docIndex];
                            const document = await getDocumentById(selectedDocId, employee.tenantId);

                            if (!document) {
                                await sendMessage(from, `❌ Document introuvable.`, phoneNumberId);
                                await setConversationState(employee.id, null);
                                continue;
                            }

                            // Send the document via WhatsApp
                            const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
                            const documentUrl = absoluteSignedUploadUrl(baseUrl, document.url, 60 * 60);

                            try {
                                await sendDocument(
                                    from,
                                    documentUrl,
                                    document.name,
                                    `📄 ${document.name}`,
                                    phoneNumberId
                                );
                                console.log(`📤 Document sent to ${employee.name}: ${document.name}`);
                            } catch (docError) {
                                console.error('❌ Error sending document:', docError);
                                await sendMessage(from, `❌ Erreur lors de l'envoi du document. Réessayez plus tard.`, phoneNumberId);
                            }

                            // Clear state
                            await setConversationState(employee.id, null);
                            continue;
                        }

                        // ====================================================================
                        // OPT-OUT HANDLING (STOP / REPRENDRE)
                        // ====================================================================
                        const normalizedMessage = messageBody.toLowerCase().trim();

                        if (normalizedMessage === 'stop') {
                            console.log(`🛑 Processing OPT-OUT for ${employee.name}`);

                            try {
                                await prisma.employee.update({
                                    where: { id: employee.id },
                                    data: { isOptedOut: true }
                                });

                                // Send final confirmation (bypasses opt-out check since it's a system message)
                                await sendMessage(
                                    from,
                                    `✅ Vous êtes désinscrit.\\n\\nVous ne recevrez plus de messages de notre bot.\\n\\n` +
                                    `Pour vous réinscrire, envoyez *REPRENDRE* ou *START*.`,
                                    phoneNumberId
                                );
                                console.log(`✅ Employee ${employee.name} opted out successfully`);
                            } catch (optError) {
                                console.error('❌ Error processing opt-out:', optError);
                            }
                            continue;
                        }

                        if (normalizedMessage === 'reprendre' || normalizedMessage === 'start') {
                            console.log(`✅ Processing OPT-IN for ${employee.name}`);

                            try {
                                await prisma.employee.update({
                                    where: { id: employee.id },
                                    data: { isOptedOut: false }
                                });

                                await sendMessage(
                                    from,
                                    `🎉 Vous êtes réinscrit !\\n\\nVous recevrez à nouveau nos messages.\\n\\n` +
                                    `Tapez *Menu* pour voir vos options.`,
                                    phoneNumberId
                                );
                                console.log(`✅ Employee ${employee.name} opted in successfully`);
                            } catch (optError) {
                                console.error('❌ Error processing opt-in:', optError);
                            }
                            continue;
                        }
                        // ====================================================================

                        // 6. Process standard text or Natural Language routing
                        let command = messageBody.toLowerCase().trim();
                        
                        // Check if it's a standard core exact command (hi, menu, etc)
                        const isCoreCommand = ['hi', 'hello', 'bonjour', 'menu', 'aide', 'bye', 'stats', 'documents'].includes(command) || command.startsWith('/');
                        
                        if (!isCoreCommand) {
                            // 🧠 AGENTIC ROUTER: Analyze intent of natural language
                            await sendMessage(from, `🤖 _Compréhension de votre demande en cours..._`, phoneNumberId);
                            const { detectUserIntent } = require('../services/aiAgentService');
                            const intentResult = await detectUserIntent(messageBody);

                            switch(intentResult.intent) {
                                case 'EXPENSE_REPORT':
                                    command = 'expense';
                                    break;
                                case 'SICK_LEAVE':
                                    command = 'maladie';
                                    break;
                                case 'LEAVE_REQUEST':
                                    command = 'leave_menu';
                                    break;
                                case 'HR_BALANCE':
                                    command = 'balance';
                                    break;
                                case 'DOCUMENT_ACCESS':
                                    command = 'documents';
                                    break;
                                case 'STATS':
                                    command = 'stats';
                                    break;
                                case 'FAQ_HR':
                                    await sendMessage(from, `📚 *Assistant RH*\n\nJe parcours actuellement votre règlement intérieur pour trouver la réponse légale à : _"${intentResult.question}"_\nUn instant...`, phoneNumberId);
                                    const { answerHRQuestionViaRAG } = require('../services/aiAgentService');
                                    const ragAnswer = await answerHRQuestionViaRAG(intentResult.question, employee.tenantId);
                                    await sendMessage(from, `🧠 *Directives RH (RAG) :*\n\n${ragAnswer}`, phoneNumberId);
                                    continue; // Skip standard processCommand
                                default:
                                    command = 'menu'; // Fallback to displaying UI if not understood
                                    break;
                            }
                        }

                        await processCommand(command, employee, from, phoneNumberId, messageTimestamp);

                    } else if (value.statuses) {
                        // Status update (sent, delivered, read) - just log
                        const status = value.statuses[0];
                        console.log(`ℹ️ Status update for ${status.recipient_id}: ${status.status}`);
                    }
                }
            }
            return res.sendStatus(200);
        }

        // ====================================================================
        // HANDLE META PLATFORM EVENTS (Quality, etc.)
        // ====================================================================
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    // Handle phone_number_quality_update events from Meta
                    if (change.field === 'phone_number_quality_update') {
                        const qualityData = change.value;
                        console.log(`📊 Meta Quality Update received:`, JSON.stringify(qualityData));

                        const newScore = qualityData?.current_limit?.toUpperCase() || 'GREEN';

                        // Map Meta quality to our values
                        let scoreValue: string;
                        if (newScore.includes('RED') || newScore.includes('LOW')) {
                            scoreValue = 'RED';
                        } else if (newScore.includes('YELLOW') || newScore.includes('MEDIUM')) {
                            scoreValue = 'YELLOW';
                        } else {
                            scoreValue = 'GREEN';
                        }

                        try {
                            // Update platform config with quality score
                            await prisma.platformConfig.update({
                                where: { id: 1 },
                                data: {
                                    whatsappQualityScore: scoreValue,
                                    whatsappQualityAlert: new Date()
                                }
                            });

                            console.log(`📊 WhatsApp quality score updated to: ${scoreValue}`);

                            // Send critical alert if YELLOW or RED
                            if (scoreValue !== 'GREEN') {
                                const alertEmail = process.env.SUPERADMIN_ALERT_EMAIL;
                                if (alertEmail) {
                                    console.log(`🚨 CRITICAL: WhatsApp quality is ${scoreValue}! Alert email would be sent to: ${alertEmail}`);
                                    // TODO: Integrate with email service to send alert
                                    // await sendCriticalAlert(alertEmail, scoreValue);
                                }
                            }
                        } catch (updateError) {
                            console.error('❌ Error updating quality score:', updateError);
                        }
                    }
                }
            }
        }

        // Not a recognized event
        return res.sendStatus(200);
    } catch (error) {
        console.error('❌ Error in webhook handler:', error);
        return res.sendStatus(500);
    }
};
