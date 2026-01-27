import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
 */
export const checkIn = async (employee: Employee): Promise<CheckInResult> => {
    // Définir le début et la fin de la journée en UTC
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
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

    // Créer le pointage d'entrée (UTC)
    const now = new Date();
    const attendance = await prisma.attendance.create({
        data: {
            checkIn: now,
            employeeId: employee.id,
            tenantId: employee.tenantId,
            status: 'PRESENT'
        }
    });

    return {
        success: true,
        message: `Pointage enregistré à ${formatTimeInParis(now)}.`,
        checkInTime: now
    };
};

/**
 * Enregistre un pointage de sortie (Check-out)
 * - Cherche le dernier pointage ouvert (checkOut is NULL)
 * - Met à jour avec l'heure de sortie
 */
export const checkOut = async (employee: Employee): Promise<CheckOutResult> => {
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

    // Mettre à jour avec l'heure de sortie (UTC)
    const now = new Date();
    await prisma.attendance.update({
        where: { id: openAttendance.id },
        data: { checkOut: now }
    });

    const duration = calculateDuration(openAttendance.checkIn, now);

    return {
        success: true,
        message: `Départ enregistré à ${formatTimeInParis(now)}. Durée de travail : ${duration}.`,
        checkOutTime: now,
        duration
    };
};
