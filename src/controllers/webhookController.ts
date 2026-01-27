import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { identifyUser } from '../services/authService';
import { sendMessage } from '../services/whatsappService';
import { checkIn, checkOut } from '../services/attendanceService';
import { createRequest, handleManagerResponse, formatDateForMessage } from '../services/leaveService';
import { downloadAndSaveMetaImage } from '../services/storageService';
import { isWithinRange } from '../services/locationService';

const prisma = new PrismaClient();

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

                        // 3. Handle IMAGE messages - Photo attendance
                        if (messageType === 'image' && message.image?.id) {
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

                        // 4. Process standard commands based on message content
                        const command = messageBody.toLowerCase().trim();
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

                            case 'help':
                            case 'aide':
                            case '?': {
                                // Help message - updated with leave request info
                                responseText = `📋 *Commandes disponibles :*\n\n` +
                                    `• *Hi/Bonjour* → Pointer votre entrée\n` +
                                    `• *Bye/Au revoir* → Pointer votre sortie\n` +
                                    `• *Congé DD/MM* → Demander un congé\n` +
                                    `• *Help* → Afficher cette aide\n\n` +
                                    `Vous êtes connecté en tant que *${employee.name}* (${employee.role}) chez *${employee.tenant.name}*.`;
                                break;
                            }

                            default: {
                                // Unknown command
                                responseText = `🤔 Je ne comprends pas "${messageBody}".\n\n` +
                                    `Dites *"Hi"* pour pointer votre entrée, *"Bye"* pour pointer votre sortie,\n` +
                                    `ou *"Congé 25/12"* pour demander un congé.\n` +
                                    `Tapez *"Help"* pour plus d'informations.`;
                            }
                        }

                        await sendMessage(from, responseText, phoneNumberId);

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

