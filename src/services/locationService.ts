/**
 * Location Service - Geofencing Logic
 * Vérifie la conformité de localisation selon le profil de l'employé
 */

import { PrismaClient, Employee, Site } from '@prisma/client';

const prisma = new PrismaClient();

interface LocationComplianceResult {
    isCompliant: boolean;
    distance: number | null;
    warning: boolean;
    message: string;
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
};

/**
 * Check if a location is within a certain range of a target location
 */
export const isWithinRange = (
    lat: number,
    lon: number,
    targetLat: number,
    targetLon: number,
    radiusInMeters: number = 500
): { inRange: boolean; distance: number } => {
    const distance = calculateDistance(lat, lon, targetLat, targetLon);
    return {
        inRange: distance <= radiusInMeters,
        distance
    };
};

/**
 * Vérifie si un employé est en conformité avec sa localisation de pointage
 * 
 * LOGIQUE :
 * - MOBILE : Toujours conforme (pas de restriction)
 * - SEDENTARY : Doit être dans le rayon du site rattaché
 */
export async function checkLocationCompliance(
    employee: Employee & { site?: Site | null },
    userLat: number | null,
    userLon: number | null
): Promise<LocationComplianceResult> {

    // --- CAS 1 : Profil MOBILE = Toujours OK ---
    if (employee.workProfile === 'MOBILE') {
        return {
            isCompliant: true,
            distance: null,
            warning: false,
            message: '✅ Pointage validé'
        };
    }

    // --- CAS 2 : Profil SEDENTARY ---

    // Pas de coordonnées utilisateur -> Warning
    if (userLat === null || userLon === null) {
        return {
            isCompliant: true,
            distance: null,
            warning: true,
            message: '⚠️ Localisation non fournie. Pointage enregistré sous réserve.'
        };
    }

    // Récupérer le site de l'employé
    let site = employee.site;
    if (!site && employee.siteId) {
        site = await prisma.site.findUnique({
            where: { id: employee.siteId }
        });
    }

    // Employé sédentaire sans site rattaché -> Warning
    if (!site) {
        return {
            isCompliant: true,
            distance: null,
            warning: true,
            message: '⚠️ Aucun site de rattachement. Pointage enregistré.'
        };
    }

    // Site sans coordonnées GPS -> On ne peut pas vérifier
    if (site.latitude === null || site.longitude === null) {
        return {
            isCompliant: true,
            distance: null,
            warning: false,
            message: '✅ Pointage validé'
        };
    }

    // --- CALCUL DE LA DISTANCE ---
    const distance = calculateDistance(userLat, userLon, site.latitude, site.longitude);
    const radius = site.radius || 200;

    // Dans le rayon -> OK
    if (distance <= radius) {
        return {
            isCompliant: true,
            distance,
            warning: false,
            message: `✅ Pointage validé (${distance}m du site)`
        };
    }

    // Hors du rayon -> Warning
    return {
        isCompliant: true,
        distance,
        warning: true,
        message: `⚠️ Attention, vous êtes à ${distance}m de votre lieu de travail (rayon autorisé: ${radius}m). Pointage enregistré sous réserve.`
    };
}

/**
 * Version simplifiée pour usage direct avec IDs
 */
export async function checkLocationComplianceById(
    employeeId: string,
    userLat: number | null,
    userLon: number | null
): Promise<LocationComplianceResult> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { site: true }
    });

    if (!employee) {
        return {
            isCompliant: true,
            distance: null,
            warning: false,
            message: '✅ Pointage validé'
        };
    }

    return checkLocationCompliance(employee, userLat, userLon);
}
