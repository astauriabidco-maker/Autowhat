import { dispatchWebhook, WEBHOOK_EVENTS } from './webhookService';
import prisma from '../lib/prisma';


// Type pour l'employé retourné par authService
interface Employee {
    id: string;
    name: string | null;
    phoneNumber: string;
    role: string;
    tenantId: string;
    tenant: {
        id: string;
        name: string;
    };
}

interface CheckInResult {
    success: boolean;
    message: string;
    checkInTime?: Date;
}

interface CheckOutResult {
    success: boolean;
    message: string;
    checkOutTime?: Date;
    duration?: string;
}

/**
 * Formate une date en heure locale (Europe/Paris)
 */
const formatTimeInParis = (date: Date): string => {
    return date.toLocaleTimeString('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Calcule la durée entre deux dates
 */
const calculateDuration = (checkIn: Date, checkOut: Date): string => {
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
};

/**
 * Enregistre un pointage d'entrée (Check-in)
 * - Vérifie si un pointage est déjà ouvert aujourd'hui
 * - Si non, crée une nouvelle entrée
 * @param employee - Employé qui pointe
 * @param messageTimestamp - Optionnel: timestamp du message WhatsApp (pour gestion offline)
 */
export const checkIn = async (employee: Employee, messageTimestamp?: Date): Promise<CheckInResult> => {
    // Utiliser le timestamp du message WhatsApp si fourni, sinon l'heure actuelle
    const checkInTime = messageTimestamp || new Date();

    // Définir le début et la fin de la journée en UTC basé sur le timestamp réel
    const startOfDay = new Date(checkInTime);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(checkInTime);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Vérifier si un pointage existe déjà aujourd'hui pour cet employé
    const existingAttendance = await prisma.attendance.findFirst({
        where: {
            employeeId: employee.id,
            tenantId: employee.tenantId,
            checkIn: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    });

    if (existingAttendance) {
        // Pointage déjà effectué
        const checkInTimeFormatted = formatTimeInParis(existingAttendance.checkIn);
        return {
            success: false,
            message: `Vous avez déjà pointé aujourd'hui à ${checkInTimeFormatted}.`
        };
    }

    // Créer le pointage d'entrée avec le timestamp réel
    const attendance = await prisma.attendance.create({
        data: {
            checkIn: checkInTime,
            employeeId: employee.id,
            tenantId: employee.tenantId,
            status: 'PRESENT'
        }
    });

    // --- LATENESS DETECTION ---
    const [startHour, startMin] = (employee.tenant as any).workStartTime?.split(':').map(Number) || [9, 0];
    const theoreticalStart = new Date(checkInTime);
    theoreticalStart.setHours(startHour, startMin, 0, 0);

    const isLate = checkInTime.getTime() > theoreticalStart.getTime() + (5 * 60 * 1000); // 5 min tolerance
    const delayMinutes = isLate ? Math.round((checkInTime.getTime() - theoreticalStart.getTime()) / (1000 * 60)) : 0;

    if (isLate) {
        console.log(`⚠️ LATE ARRIVAL: ${employee.name} arrived at ${formatTimeInParis(checkInTime)} (expected ${startHour}:${startMin})`);
        dispatchWebhook(WEBHOOK_EVENTS.LATE_ARRIVAL, {
            attendanceId: attendance.id,
            employeeId: employee.id,
            employeeName: employee.name,
            delayMinutes,
            checkInTime: checkInTime.toISOString(),
            expectedTime: `${startHour}:${startMin}`
        }, employee.tenantId);
    }

    // Dispatch standard check-in webhook
    dispatchWebhook(WEBHOOK_EVENTS.CHECK_IN, {
        attendanceId: attendance.id,
        employeeId: employee.id,
        employeeName: employee.name,
        checkInTime: checkInTime.toISOString(),
        tenantName: employee.tenant.name,
        isLate,
        delayMinutes
    }, employee.tenantId);

    // Log si le timestamp diffère significativement (plus de 5 min)
    const now = new Date();
    const timeDiffMinutes = Math.abs(now.getTime() - checkInTime.getTime()) / (1000 * 60);
    if (timeDiffMinutes > 5) {
        console.log(`📱 [Offline Mode] Check-in with message timestamp: ${formatTimeInParis(checkInTime)} (received at server: ${formatTimeInParis(now)})`);
    }

    return {
        success: true,
        message: `Pointage enregistré à ${formatTimeInParis(checkInTime)}.`,
        checkInTime: checkInTime
    };
};

/**
 * Enregistre un pointage de sortie (Check-out)
 * - Cherche le dernier pointage ouvert (checkOut is NULL)
 * - Met à jour avec l'heure de sortie
 * @param employee - Employé qui pointe
 * @param messageTimestamp - Optionnel: timestamp du message WhatsApp (pour gestion offline)
 */
export const checkOut = async (employee: Employee, messageTimestamp?: Date): Promise<CheckOutResult> => {
    // Utiliser le timestamp du message WhatsApp si fourni, sinon l'heure actuelle
    const checkOutTime = messageTimestamp || new Date();

    // Chercher le dernier pointage ouvert pour cet employé
    const openAttendance = await prisma.attendance.findFirst({
        where: {
            employeeId: employee.id,
            tenantId: employee.tenantId,
            checkOut: null
        },
        orderBy: {
            checkIn: 'desc'
        }
    });

    if (!openAttendance) {
        return {
            success: false,
            message: "Vous n'avez pas pointé ce matin. Dites 'Hi' pour commencer votre journée."
        };
    }

    // Mettre à jour avec l'heure de sortie réelle
    await prisma.attendance.update({
        where: { id: openAttendance.id },
        data: { checkOut: checkOutTime }
    });

    const duration = calculateDuration(openAttendance.checkIn, checkOutTime);

    // Dispatch webhook event
    dispatchWebhook(WEBHOOK_EVENTS.CHECK_OUT, {
        attendanceId: openAttendance.id,
        employeeId: employee.id,
        employeeName: employee.name,
        checkInTime: openAttendance.checkIn.toISOString(),
        checkOutTime: checkOutTime.toISOString(),
        duration,
        tenantName: employee.tenant.name
    }, employee.tenantId);

    // Log si le timestamp diffère significativement (plus de 5 min)
    const now = new Date();
    const timeDiffMinutes = Math.abs(now.getTime() - checkOutTime.getTime()) / (1000 * 60);
    if (timeDiffMinutes > 5) {
        console.log(`📱 [Offline Mode] Check-out with message timestamp: ${formatTimeInParis(checkOutTime)} (received at server: ${formatTimeInParis(now)})`);
    }

    return {
        success: true,
        message: `Départ enregistré à ${formatTimeInParis(checkOutTime)}. Durée de travail : ${duration}.`,
        checkOutTime: checkOutTime,
        duration
    };
};
