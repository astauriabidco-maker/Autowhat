import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { identifyUser } from '../services/authService';
import { sendMessage, sendInteractiveList, sendInteractiveButtons, sendDocument } from '../services/whatsappService';
import { checkIn, checkOut } from '../services/attendanceService';
import { createRequest, handleManagerResponse, formatDateForMessage } from '../services/leaveService';
import { downloadAndSaveMetaImage } from '../services/storageService';
import { isWithinRange } from '../services/locationService';
import { setConversationState, updateTempExpenseData, createExpense, EXPENSE_CATEGORIES } from '../services/expenseService';
import { getWeeklySummary, getHistory, formatWeeklySummaryMessage, formatHistoryMessage } from '../services/statsService';
import { getDocumentsForEmployee, getDocumentById, formatDocumentListMessage } from '../services/documentService';

const prisma = new PrismaClient();

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
    phoneNumberId?: string
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
            const result = await checkIn(employee);

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
            const result = await checkOut(employee);

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

                        console.log(`📩 Received ${messageType} message from ${from}`);
                        console.log(`📱 Received on phone ID: ${phoneNumberId}`);

                        // 1. Identify User
                        const employee = await identifyUser(`+${from}`);

                        if (!employee) {
                            // Unknown user
                            await sendMessage(from, '❌ Numéro non reconnu. Contactez votre RH.', phoneNumberId);
                            continue;
                        }

                        // 2. Handle LOCATION messages - Geographic validation
                        if (messageType === 'location' && message.location) {
                            console.log(`📍 Processing LOCATION for ${employee.name}`);
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
                                    `⚠️ Vous devez d'abord pointer votre entrée avec "Hi" avant d'envoyer votre position.`,
                                    phoneNumberId
                                );
                                continue;
                            }

                            // Calculate distance if tenant has default coordinates
                            let distanceMsg = "";
                            let finalDistance: number | null = null;

                            if (employee.tenant.defaultLatitude && employee.tenant.defaultLongitude) {
                                const { inRange, distance } = isWithinRange(
                                    latitude,
                                    longitude,
                                    employee.tenant.defaultLatitude,
                                    employee.tenant.defaultLongitude
                                );
                                finalDistance = distance;

                                if (inRange) {
                                    distanceMsg = `✅ Position validée (vous êtes à ${distance} mètres du site).`;
                                } else {
                                    const km = (distance / 1000).toFixed(1);
                                    distanceMsg = `⚠️ Attention, vous êtes détecté à ${km} km du site. Pointage marqué 'Hors Site'.`;
                                }
                            } else {
                                distanceMsg = `📍 Position enregistrée (Site non configuré pour la validation GPS).`;
                            }

                            // Update attendance record
                            await prisma.attendance.update({
                                where: { id: todayAttendance.id },
                                data: {
                                    latitude,
                                    longitude,
                                    distanceFromSite: finalDistance
                                }
                            });

                            await sendMessage(from, distanceMsg, phoneNumberId);
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
                                await processCommand(mappedCommand, employee, from, phoneNumberId);
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

                        // 6. Process standard text commands
                        const command = messageBody.toLowerCase().trim();
                        await processCommand(command, employee, from, phoneNumberId);

                    } else if (value.statuses) {
                        // Status update (sent, delivered, read) - just log
                        const status = value.statuses[0];
                        console.log(`ℹ️ Status update for ${status.recipient_id}: ${status.status}`);
                    }
                }
            }
            return res.sendStatus(200);
        } else {
            // Not a whatsapp event
            return res.sendStatus(404);
        }
    } catch (error) {
        console.error('❌ Error in webhook handler:', error);
        return res.sendStatus(500);
    }
};

