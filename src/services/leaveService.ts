import { PrismaClient, Employee, LeaveRequest } from '@prisma/client';
import { dispatchWebhook, WEBHOOK_EVENTS } from './webhookService';

const prisma = new PrismaClient();

/**
 * Result of a leave request creation
 */
interface CreateRequestResult {
    success: boolean;
    message: string;
    request?: LeaveRequest;
    managerPhoneNumber?: string;
    kpaiePreCheckContext?: string;
}

/**
 * Result of a manager response handling
 */
interface HandleResponseResult {
    success: boolean;
    message: string;
    employeePhoneNumber?: string;
    requestId?: string;
    status?: string;
}

/**
 * Parse a date string in format DD/MM or DD/MM/YYYY
 * Tolerant parsing with regex
 */
function parseLeaveDate(dateString: string): { startDate: Date; endDate: Date; isHalfDayStart: boolean; isHalfDayEnd: boolean } | null {
    const cleaned = dateString.trim().toLowerCase();

    let isHalfDayStart = false;
    let isHalfDayEnd = false;

    // Detect if the user wants just the morning off
    if (cleaned.includes('matin') || cleaned.includes('am')) {
        isHalfDayStart = false; // Starts in the morning
        isHalfDayEnd = true;    // Ends in the morning (works afternoon)
    } 
    // Detect if the user wants just the afternoon off
    else if (cleaned.includes('apr') || cleaned.includes('aprem') || cleaned.includes('pm')) {
        isHalfDayStart = true;  // Starts in the afternoon (works morning)
        isHalfDayEnd = false;   // Ends in the afternoon
    }

    // Extract just the date part (DD/MM or DD/MM/YYYY)
    const regex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
    const match = cleaned.match(regex);

    if (!match) {
        return null;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
    let year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();

    // Handle 2-digit year
    if (year < 100) {
        year += 2000;
    }

    // Validate day and month
    if (day < 1 || day > 31 || month < 0 || month > 11) {
        return null;
    }

    const startDate = new Date(year, month, day, 0, 0, 0);
    const endDate = new Date(year, month, day, 23, 59, 59);

    // Check if the date is valid (e.g., not 31/02)
    if (startDate.getDate() !== day) {
        return null;
    }

    return { startDate, endDate, isHalfDayStart, isHalfDayEnd };
}

/**
 * Creates a new leave request for an employee
 * @param employee The employee making the request
 * @param dateString The date string (DD/MM or DD/MM/YYYY)
 */
export async function createRequest(
    employee: Employee & { tenant: { name: string } },
    dateString: string | null,
    nlpDates?: { startDate: string; endDate: string; isHalfDayStart: boolean; isHalfDayEnd: boolean; businessDays: number }
): Promise<CreateRequestResult> {
    try {
        let dates: { startDate: Date; endDate: Date; isHalfDayStart: boolean; isHalfDayEnd: boolean } | null = null;
        let requestedDays = 1;

        if (nlpDates) {
            dates = {
                startDate: new Date(nlpDates.startDate),
                endDate: new Date(nlpDates.endDate),
                isHalfDayStart: nlpDates.isHalfDayStart,
                isHalfDayEnd: nlpDates.isHalfDayEnd
            };
            requestedDays = nlpDates.businessDays;
        } else if (dateString) {
            dates = parseLeaveDate(dateString);
            if (dates) {
                if (dates.isHalfDayStart !== dates.isHalfDayEnd) {
                    requestedDays = 0.5; // Morning or Afternoon only
                }
            }
        }

        if (!dates) {
            return {
                success: false,
                message: `Format date invalide. Essayez 'Congé 25/12' ou 'Congé 25/12/2026'.`
            };
        }

        // --- PRE-CHECK ERP (Phase 6) ---

        const { getKPaieBalances } = require('./kpaieService');
        const balanceResult = await getKPaieBalances(employee.tenantId, employee.phoneNumber);
        let kpaiePreCheckContext = '';

        if (balanceResult.success && balanceResult.data) {
            const availableBalance = balanceResult.data.paid_leave;
            
            // Hard block if balance is insufficient
            if (availableBalance < requestedDays) {
                return {
                    success: false,
                    message: `❌ *Refusé par la Paie*\nVotre solde de congés (${availableBalance} jours) est insuffisant pour cette demande (${requestedDays} jours).`
                };
            }
            
            // Enrich Manager Context
            const newBalance = availableBalance - requestedDays;
            kpaiePreCheckContext = `\n📊 *Indicateurs (KPaie) :*\n• Solde après validation : ${newBalance} j ✅\n• Conflits d'équipe : Aucun connu 🟢\n`;
        } else if (balanceResult.error === 'NO_CONFIG') {
             kpaiePreCheckContext = `\n⚠️ *KPaie non configuré* (Solde non vérifié)\n`;
        }

        // Create the leave request
        const request = await prisma.leaveRequest.create({
            data: {
                startDate: dates.startDate,
                endDate: dates.endDate,
                isHalfDayStart: dates.isHalfDayStart,
                isHalfDayEnd: dates.isHalfDayEnd,
                status: 'PENDING',
                employeeId: employee.id,
                tenantId: employee.tenantId,
            }
        });

        // Dispatch webhook (Bridge Strategy)
        await dispatchWebhook(WEBHOOK_EVENTS.LEAVE_REQUESTED, {
            leaveRequestId: request.id,
            employeeId: employee.id,
            employeeName: employee.name,
            startDate: request.startDate,
            endDate: request.endDate,
            isHalfDayStart: request.isHalfDayStart,
            isHalfDayEnd: request.isHalfDayEnd,
            status: request.status
        }, employee.tenantId);

        // Find the manager for this tenant
        const manager = await prisma.employee.findFirst({
            where: {
                tenantId: employee.tenantId,
                role: 'MANAGER'
            }
        });

        if (!manager) {
            return {
                success: false,
                message: `Aucun manager trouvé pour votre entreprise. Contactez votre RH.`
            };
        }

        // Format date for display
        const formattedDate = dates.startDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        return {
            success: true,
            message: `Demande de congé #${request.id.slice(0, 8)} créée pour le ${formattedDate}.`,
            request,
            managerPhoneNumber: manager.phoneNumber,
            kpaiePreCheckContext
        };

    } catch (error) {
        console.error('Error creating leave request:', error);
        return {
            success: false,
            message: `Erreur lors de la création de la demande. Réessayez plus tard.`
        };
    }
}

/**
 * Handles a manager's response to a leave request
 * @param manager The manager responding
 * @param message The message content (e.g., "OK abc123" or "NON abc123")
 */
export async function handleManagerResponse(
    manager: Employee,
    message: string
): Promise<HandleResponseResult> {
    try {
        // Parse the message for approval/rejection and request ID
        const normalizedMessage = message.toUpperCase().trim();

        // Match patterns like "OK abc123", "OUI #abc123", "APPROVE abc123", "NON abc123", "REFUSE abc123"
        const approveRegex = /^(OK|OUI|APPROVE|VALIDE|ACCEPTE)\s*#?\s*([a-zA-Z0-9-]+)/i;
        const rejectRegex = /^(NON|REFUSE|REJECT|REJETTE)\s*#?\s*([a-zA-Z0-9-]+)/i;

        let newStatus: string;
        let requestIdFragment: string;

        const approveMatch = message.match(approveRegex);
        const rejectMatch = message.match(rejectRegex);

        if (approveMatch) {
            newStatus = 'APPROVED';
            requestIdFragment = approveMatch[2];
        } else if (rejectMatch) {
            newStatus = 'REJECTED';
            requestIdFragment = rejectMatch[2];
        } else {
            return {
                success: false,
                message: `Format invalide. Utilisez 'OK [ID]' pour approuver ou 'NON [ID]' pour refuser.`
            };
        }

        // Find the leave request by ID fragment (matching the beginning of the UUID)
        // SECURITY: Only search within manager's tenant
        const request = await prisma.leaveRequest.findFirst({
            where: {
                id: { startsWith: requestIdFragment },
                tenantId: manager.tenantId, // CRITICAL: Multi-tenant isolation
                status: 'PENDING'
            },
            include: {
                employee: true
            }
        });

        if (!request) {
            return {
                success: false,
                message: `Demande #${requestIdFragment} introuvable ou déjà traitée.`
            };
        }

        // Update the request status
        await prisma.leaveRequest.update({
            where: { id: request.id },
            data: { status: newStatus }
        });

        // Dispatch webhook (Bridge Strategy)
        await dispatchWebhook(
            newStatus === 'APPROVED' ? WEBHOOK_EVENTS.LEAVE_APPROVED : WEBHOOK_EVENTS.LEAVE_REJECTED,
            {
                leaveRequestId: request.id,
                employeeId: request.employee.id,
                employeeName: request.employee.name,
                startDate: request.startDate,
                endDate: request.endDate,
                status: newStatus
            },
            manager.tenantId
        );

        const statusText = newStatus === 'APPROVED' ? 'approuvée ✅' : 'refusée ❌';

        return {
            success: true,
            message: `Demande #${requestIdFragment} ${statusText}.`,
            employeePhoneNumber: request.employee.phoneNumber,
            requestId: request.id.slice(0, 8),
            status: newStatus
        };

    } catch (error) {
        console.error('Error handling manager response:', error);
        return {
            success: false,
            message: `Erreur lors du traitement de la réponse. Réessayez plus tard.`
        };
    }
}

/**
 * Format a date for WhatsApp message
 */
export function formatDateForMessage(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
