import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const GPS_MODES = ['STRICT', 'WARNING', 'DISABLED'] as const;
type GpsMode = typeof GPS_MODES[number];

function normalizeGpsMode(rawMode: unknown): GpsMode {
    return GPS_MODES.includes(rawMode as GpsMode) ? rawMode as GpsMode : 'WARNING';
}

function parseNullableFloat(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseRadius(value: unknown, fallback = 200): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.max(Math.round(parsed), 25), 5000);
}

function isAddressFriendlyCountry(country: string): boolean {
    return ['FR', 'BE', 'CH', 'US', 'CA', 'GB', 'DE', 'ES', 'IT', 'NL'].includes(country.toUpperCase());
}

async function geocodeSiteAddress(address: string, country: string): Promise<{ latitude: number; longitude: number } | null> {
    if (!address.trim() || !isAddressFriendlyCountry(country)) return null;

    try {
        const params = new URLSearchParams({
            q: `${address}, ${country}`,
            format: 'json',
            limit: '1',
            addressdetails: '0'
        });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
            headers: {
                'User-Agent': 'WhatsPoint/1.0 contact exploitation@astauria.com'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) return null;
        const results = await response.json() as Array<{ lat?: string; lon?: string }>;
        const first = results[0];
        if (!first?.lat || !first?.lon) return null;

        const latitude = Number(first.lat);
        const longitude = Number(first.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        return { latitude, longitude };
    } catch (error) {
        console.warn('Site geocoding skipped:', error);
        return null;
    }
}

/**
 * GET /api/sites
 * Liste tous les sites du tenant
 */
export const getSites = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
        }

        const sites = await prisma.site.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                address: true,
                country: true,
                latitude: true,
                longitude: true,
                radius: true,
                gpsMode: true
            }
        });

        res.json({ sites });
    } catch (error) {
        console.error('getSites error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * POST /api/sites
 * Créer un nouveau site pour le tenant
 */
export const createSite = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const {
            name,
            address,
            country,
            latitude,
            longitude,
            radius,
            gpsMode,
            locationMethod
        } = req.body;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Le nom du site est requis' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { country: true }
        });
        const siteCountry = String(country || tenant?.country || 'FR').toUpperCase();
        const mode = normalizeGpsMode(gpsMode || (locationMethod === 'none' ? 'DISABLED' : 'WARNING'));
        let parsedLatitude = parseNullableFloat(latitude);
        let parsedLongitude = parseNullableFloat(longitude);

        if ((parsedLatitude === null || parsedLongitude === null) && address && mode !== 'DISABLED') {
            const geocoded = await geocodeSiteAddress(String(address), siteCountry);
            if (geocoded) {
                parsedLatitude = geocoded.latitude;
                parsedLongitude = geocoded.longitude;
            }
        }

        const site = await prisma.site.create({
            data: {
                name,
                address: address || null,
                country: siteCountry,
                latitude: parsedLatitude,
                longitude: parsedLongitude,
                radius: parseRadius(radius),
                gpsMode: mode,
                tenantId
            }
        });

        res.status(201).json({ site });
    } catch (error) {
        console.error('createSite error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * PUT /api/sites/:id
 * Modifier un site
 */
export const updateSite = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const id = req.params.id as string;
        const { name, address, country, latitude, longitude, radius, gpsMode } = req.body;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
        }

        // Vérifier que le site appartient au tenant
        const existingSite = await prisma.site.findFirst({
            where: { id, tenantId }
        });

        if (!existingSite) {
            return res.status(404).json({ error: 'Site non trouvé' });
        }

        const site = await prisma.site.update({
            where: { id },
            data: {
                name,
                address,
                country: country ? String(country).toUpperCase() : existingSite.country,
                latitude: parseNullableFloat(latitude),
                longitude: parseNullableFloat(longitude),
                radius: radius ? parseRadius(radius, existingSite.radius) : existingSite.radius,
                gpsMode: gpsMode ? normalizeGpsMode(gpsMode) : existingSite.gpsMode
            }
        });

        res.json({ site });
    } catch (error) {
        console.error('updateSite error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * DELETE /api/sites/:id
 * Supprimer un site
 */
export const deleteSite = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const id = req.params.id as string;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
        }

        // Vérifier que le site appartient au tenant
        const existingSite = await prisma.site.findFirst({
            where: { id, tenantId }
        });

        if (!existingSite) {
            return res.status(404).json({ error: 'Site non trouvé' });
        }

        await prisma.site.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteSite error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
