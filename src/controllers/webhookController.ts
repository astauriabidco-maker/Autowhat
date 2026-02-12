import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { identifyUser } from '../services/authService';
import { sendMessage, sendInteractiveList, sendInteractiveButtons, sendDocument } from '../services/whatsappService';
import { checkIn, checkOut } from '../services/attendanceService';
import { createRequest, handleManagerResponse, formatDateForMessage } from '../services/leaveService';
import { downloadAndSaveMetaImage } from '../services/storageService';
import { isWithinRange, checkLocationCompliance } from '../services/locationService';
import { setConversationState, updateTempExpenseData, createExpense, EXPENSE_CATEGORIES } from '../services/expenseService';
import { getWeeklySummary, getHistory, formatWeeklySummaryMessage, formatHistoryMessage } from '../services/statsService';
import { getDocumentsForEmployee, getDocumentById, formatDocumentListMessage } from '../services/documentService';
import { notifyAllManagers } from '../services/notificationService';
import { getBotMessage, getEmployeeLanguage } from '../config/i18nBot';

// Anti-spam cooldown for Magic Link messages (in-memory cache)
// In production, consider using Redis for persistence across restarts
const magicLinkCooldowns = new Map<string, number>();

// Expense category buttons (WhatsApp allows max 3 per message, so we use list)
const EXPENSE_CATEGORY_BUTTONS = [
    { id: 'cat_repas', title: '🍔 Repas' },
    { id: 'cat_essence', title: '⛽ Essence' },
    { id: 'cat_hotel', title: '🏨 Hôtel' }
];

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
    'cmd_expense': 'expense',
    'cmd_stats': 'stats',
    'cmd_docs': 'documents',
    'cmd_sos': 'sos'
};

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
    // Match patterns like "congé 25/12", "leave 25/12/2026", "congés 01-02"
    const regex = /^(?:cong[ée]s?|leave)\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i;
    const match = message.match(regex);
    return match ? match[1] : null;
}

/**
 * Check if message is a manager approval/rejection response
 */
function isManagerResponse(message: string): boolean {
    const regex = /^(OK|OUI|APPROVE|VALIDE|ACCEPTE|NON|REFUSE|REJECT|REJETTE)\s*#?\s*[a-zA-Z0-9-]+/i;
    return regex.test(message.trim());
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

                        // Handle "Admin Start" command for manager activation
                        if (!employee && messageType === 'text' && messageBody.toLowerCase().trim() === 'admin start') {
                            console.log(`🔑 Processing ADMIN START activation from ${from}`);

                            // Try to find manager with flexible phone matching
                            const manager = await prisma.employee.findFirst({
                                where: {
                                    role: 'MANAGER',
                                    OR: [
                                        { phoneNumber: from },           // Without +
                                        { phoneNumber: `+${from}` },     // With +
                                        { phoneNumber: { endsWith: from.slice(-9) } }  // Last 9 digits
                                    ]
                                },
                                include: { tenant: true }
                            });

                            if (manager) {
                                // Extract first name
                                const firstName = (manager.name || 'Manager').split(' ')[0];

                                // Update botActivated flag if field exists
                                try {
                                    await prisma.employee.update({
                                        where: { id: manager.id },
                                        data: { phoneNumber: from }  // Normalize to WhatsApp format
                                    });
                                } catch (e) {
                                    console.log('Phone number already normalized');
                                }

                                await sendMessage(
                                    from,
                                    `👋 Bonjour *${firstName}* !\n\n` +
                                    `Je vous ai reconnu. Vous êtes l'administrateur de *${manager.tenant.name}*.\n\n` +
                                    `✅ Votre bot WhatsApp est maintenant activé !\n\n` +
                                    `Tapez *Menu* pour voir vos options.`,
                                    phoneNumberId
                                );
                                console.log(`✅ Manager ${manager.name} activated successfully`);
                            } else {
                                await sendMessage(
                                    from,
                                    `⚠️ Je ne reconnais pas ce numéro administrateur.\n\n` +
                                    `Assurez-vous d'avoir utilisé ce numéro lors de votre inscription sur le site web.\n\n` +
                                    `📞 Numéro reçu: +${from}`,
                                    phoneNumberId
                                );
                                console.log(`❌ Unknown manager number: ${from}`);
                            }
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
                                    // Generate Magic Link
                                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                    const magicLinkUrl = `${frontendUrl}/register?phone=%2B${from}&source=whatsapp`;

                                    await sendMessage(
                                        from,
                                        `🚀 C'est parti !\n\n` +
                                        `Cliquez sur ce lien pour créer votre espace Manager :\n\n` +
                                        `👉 ${magicLinkUrl}\n\n` +
                                        `✨ Essai gratuit 14 jours !`,
                                        phoneNumberId
                                    );
                                    console.log(`📧 Magic Link sent to ${from} after btn_signup click`);
                                    continue;
                                }

                                if (buttonId === 'btn_info') {
                                    await sendMessage(
                                        from,
                                        `📱 *Antigravity* permet de gérer vos équipes terrain via WhatsApp :\n\n` +
                                        `✅ Pointage par message\n` +
                                        `✅ Planning automatique\n` +
                                        `✅ Rapports en temps réel\n\n` +
                                        `🌐 En savoir plus : www.whatspoint.fr`,
                                        phoneNumberId
                                    );
                                    console.log(`ℹ️ Info message sent to ${from} after btn_info click`);
                                    continue;
                                }
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
                            const welcomeText = platformConfig?.botWelcomeText || 'Je ne reconnais pas ce numéro. Que voulez-vous faire ?';
                            const btn1Label = (platformConfig?.botBtn1Label || 'Créer un compte').slice(0, 20); // Max 20 chars
                            const btn2Label = (platformConfig?.botBtn2Label || 'En savoir plus').slice(0, 20);

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

                                    // Save photo URL and move to next state
                                    await updateTempExpenseData(employee.id, { photoUrl });
                                    await setConversationState(employee.id, 'WAITING_EXPENSE_AMOUNT');

                                    await sendMessage(
                                        from,
                                        `📷 Photo reçue ! ✅\n\n💰 Quel est le montant de la dépense ?\n(Ex: 25.50)`,
                                        phoneNumberId
                                    );
                                } catch (error) {
                                    console.error('❌ Error processing expense photo:', error);
                                    await sendMessage(from, `❌ Erreur lors du traitement de la photo. Réessayez.`, phoneNumberId);
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

                        // 3. Check for leave request pattern first
                        const leaveDate = parseLeaveRequest(messageBody);
                        if (leaveDate) {
                            console.log(`📅 Processing LEAVE REQUEST for ${employee.name}: ${leaveDate}`);

                            const result = await createRequest(employee, leaveDate);

                            if (result.success && result.request && result.managerPhoneNumber) {
                                // Format the date for display
                                const formattedDate = formatDateForMessage(result.request.startDate);
                                const requestIdShort = result.request.id.slice(0, 8);

                                // Notify the manager
                                const managerMessage =
                                    `📋 *Nouvelle demande de congé*\n\n` +
                                    `👤 De: *${employee.name}*\n` +
                                    `📅 Date: *${formattedDate}*\n` +
                                    `🆔 ID: *#${requestIdShort}*\n\n` +
                                    `Répondez:\n` +
                                    `• *OK ${requestIdShort}* pour approuver\n` +
                                    `• *NON ${requestIdShort}* pour refuser`;

                                await sendMessage(
                                    result.managerPhoneNumber.replace('+', ''),
                                    managerMessage,
                                    phoneNumberId
                                );

                                // Confirm to employee
                                await sendMessage(
                                    from,
                                    `✅ Demande de congé envoyée au manager pour le ${formattedDate}.\n\nVous recevrez une notification dès qu'elle sera traitée.`,
                                    phoneNumberId
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
                                            category
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
                            const documentUrl = `${baseUrl}${document.url}`;

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

                        // 6. Process standard text commands
                        const command = messageBody.toLowerCase().trim();
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

