import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendMessage } from '../services/whatsappService';
import { getCredentialsForTenant } from '../services/whatsappConfigService';

const GPS_MODES = ['STRICT', 'WARNING', 'DISABLED'] as const;
type GpsMode = typeof GPS_MODES[number];
type CountryBounds = {
    label: string;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
};

const COUNTRY_BOUNDS: Record<string, CountryBounds[]> = {
    FR: [{ label: 'France', minLat: 41, maxLat: 51.5, minLon: -5.5, maxLon: 10 }],
    CM: [{ label: 'Cameroun', minLat: 1.5, maxLat: 13.5, minLon: 8, maxLon: 16.5 }],
    BE: [{ label: 'Belgique', minLat: 49.4, maxLat: 51.6, minLon: 2.5, maxLon: 6.5 }],
    CH: [{ label: 'Suisse', minLat: 45.7, maxLat: 47.9, minLon: 5.7, maxLon: 10.6 }],
    DE: [{ label: 'Allemagne', minLat: 47.2, maxLat: 55.2, minLon: 5.8, maxLon: 15.1 }],
    ES: [{ label: 'Espagne', minLat: 35.8, maxLat: 43.9, minLon: -9.5, maxLon: 4.4 }],
    GB: [{ label: 'Royaume-Uni', minLat: 49.8, maxLat: 59.5, minLon: -8.7, maxLon: 2.1 }],
    US: [{ label: 'États-Unis', minLat: 24, maxLat: 49.8, minLon: -125, maxLon: -66 }],
    CA: [{ label: 'Canada', minLat: 41, maxLat: 84, minLon: -141, maxLon: -52 }]
};

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

function isPointInBounds(latitude: number, longitude: number, bounds: CountryBounds): boolean {
    return latitude >= bounds.minLat &&
        latitude <= bounds.maxLat &&
        longitude >= bounds.minLon &&
        longitude <= bounds.maxLon;
}

function inferCountryFromCoordinates(latitude: number | null, longitude: number | null): { code: string; label: string } | null {
    if (latitude === null || longitude === null) return null;

    for (const [code, boundsList] of Object.entries(COUNTRY_BOUNDS)) {
        const match = boundsList.find(bounds => isPointInBounds(latitude, longitude, bounds));
        if (match) return { code, label: match.label };
    }

    return null;
}

function getCountryLabel(country: string): string {
    return COUNTRY_BOUNDS[country]?.[0]?.label || country;
}

function getCountryMismatch(
    selectedCountry: string,
    latitude: number | null,
    longitude: number | null
): { selectedCountry: string; selectedLabel: string; detectedCountry: string; detectedLabel: string } | null {
    if (!COUNTRY_BOUNDS[selectedCountry]) return null;

    const detected = inferCountryFromCoordinates(latitude, longitude);
    if (!detected || detected.code === selectedCountry) return null;

    return {
        selectedCountry,
        selectedLabel: getCountryLabel(selectedCountry),
        detectedCountry: detected.code,
        detectedLabel: detected.label
    };
}

function isAddressFriendlyCountry(country: string): boolean {
    return ['FR', 'BE', 'CH', 'US', 'CA', 'GB', 'DE', 'ES', 'IT', 'NL'].includes(country.toUpperCase());
}

function jsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function cleanPhone(value: unknown): string | null {
    const phone = stringValue(value);
    return phone ? phone.replace(/^\+/, '') : null;
}

async function notifyGpsProvider(tenantId: string, providerPhone: unknown, message: string) {
    const phone = cleanPhone(providerPhone);
    if (!phone) return;

    try {
        const credentials = await getCredentialsForTenant(tenantId);
        await sendMessage(phone, message, credentials);
    } catch (error) {
        console.warn('Site GPS provider notification skipped:', error);
    }
}

async function getPendingGpsProposalOrNull(tenantId: string, managerId: string) {
    const manager = await prisma.employee.findFirst({
        where: {
            id: managerId,
            tenantId,
            role: 'MANAGER',
            conversationState: 'WAITING_MANAGER_SITE_GPS_APPROVAL'
        },
        select: {
            id: true,
            name: true,
            tenantId: true,
            tempExpenseData: true
        }
    });

    if (!manager) return null;

    const data = jsonObject(manager.tempExpenseData);
    const siteId = stringValue(data.siteId);
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);

    if (!siteId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return { manager, data, invalid: true as const };
    }

    const site = await prisma.site.findFirst({
        where: { id: siteId, tenantId }
    });

    if (!site) {
        return { manager, data, invalid: true as const };
    }

    return {
        manager,
        data,
        site,
        siteId,
        latitude,
        longitude,
        invalid: false as const
    };
}

async function clearManagerSiteGpsState(managerId: string) {
    await prisma.employee.update({
        where: { id: managerId },
        data: {
            conversationState: null,
            tempExpenseData: Prisma.DbNull
        }
    });
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
 * GET /api/sites/gps-activity
 * Positions proposées par collaborateurs + historique GPS récent.
 */
export const getSiteGpsActivity = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
        }

        const sites = await prisma.site.findMany({
            where: { tenantId },
            select: { id: true, name: true, country: true }
        });
        const siteMap = new Map(sites.map(site => [site.id, site]));

        const managersWithPending = await prisma.employee.findMany({
            where: {
                tenantId,
                role: 'MANAGER',
                conversationState: 'WAITING_MANAGER_SITE_GPS_APPROVAL'
            },
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                tempExpenseData: true
            }
        });

        const pendingProposals = managersWithPending
            .map(manager => {
                const data = jsonObject(manager.tempExpenseData);
                const siteId = data.siteId ? String(data.siteId) : null;
                const site = siteId ? siteMap.get(siteId) : null;
                const latitude = Number(data.latitude);
                const longitude = Number(data.longitude);

                if (!siteId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    return null;
                }

                return {
                    managerId: manager.id,
                    managerName: manager.name,
                    siteId,
                    siteName: data.siteName || site?.name || 'Site',
                    siteCountry: data.siteCountry || site?.country || null,
                    latitude,
                    longitude,
                    detectedCountry: data.detectedCountry || null,
                    providerEmployeeId: data.providerEmployeeId || null,
                    providerName: data.providerName || null,
                    providerPhone: data.providerPhone || null,
                    sharedAt: data.sharedAt || null
                };
            })
            .filter((proposal): proposal is NonNullable<typeof proposal> => Boolean(proposal));

        const events = await prisma.onboardingEvent.findMany({
            where: {
                tenantId,
                type: { in: ['SITE_GPS_POSITION_SHARED', 'SITE_GPS_UPDATED', 'SITE_GPS_REJECTED'] }
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                employee: { select: { id: true, name: true, phoneNumber: true, role: true } }
            }
        });

        const history = events.map(event => {
            const metadata = jsonObject(event.metadata);
            const siteId = metadata.siteId ? String(metadata.siteId) : null;
            const site = siteId ? siteMap.get(siteId) : null;

            return {
                id: event.id,
                type: event.type,
                createdAt: event.createdAt,
                siteId,
                siteName: metadata.siteName || site?.name || null,
                latitude: typeof metadata.latitude === 'number' ? metadata.latitude : null,
                longitude: typeof metadata.longitude === 'number' ? metadata.longitude : null,
                siteCountry: metadata.siteCountry || metadata.country || site?.country || null,
                detectedCountry: metadata.detectedCountry || null,
                source: metadata.source || null,
                actor: event.employee
                    ? {
                        id: event.employee.id,
                        name: event.employee.name,
                        phoneNumber: event.employee.phoneNumber,
                        role: event.employee.role
                    }
                    : null,
                providerEmployeeId: metadata.providerEmployeeId || null,
                managerId: metadata.managerId || null
            };
        });

        res.json({ pendingProposals, history });
    } catch (error) {
        console.error('getSiteGpsActivity error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * POST /api/sites/gps-proposals/:managerId/approve
 * Valider depuis le dashboard une position GPS proposée par collaborateur.
 */
export const approveSiteGpsProposal = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const managerId = req.params.managerId as string;
        const correctCountry = req.body?.correctCountry === true;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
        }

        const proposal = await getPendingGpsProposalOrNull(tenantId, managerId);
        if (!proposal) {
            return res.status(404).json({ error: 'Position proposée introuvable ou déjà traitée' });
        }

        if (proposal.invalid) {
            await clearManagerSiteGpsState(proposal.manager.id);
            return res.status(409).json({ error: 'Position proposée expirée. La demande a été nettoyée.' });
        }

        const nextCountry = correctCountry
            ? stringValue(proposal.data.detectedCountry) || stringValue(proposal.data.siteCountry) || proposal.site.country
            : proposal.site.country;

        const updated = await prisma.site.update({
            where: { id: proposal.site.id },
            data: {
                latitude: proposal.latitude,
                longitude: proposal.longitude,
                country: nextCountry.toUpperCase(),
                gpsMode: proposal.site.gpsMode === 'DISABLED' ? 'WARNING' : proposal.site.gpsMode
            }
        });

        await prisma.onboardingEvent.create({
            data: {
                tenantId,
                employeeId: req.user?.userId,
                type: 'SITE_GPS_UPDATED',
                metadata: {
                    source: correctCountry ? 'manager_dashboard_corrected_country' : 'manager_dashboard_validated',
                    siteId: updated.id,
                    siteName: updated.name,
                    latitude: updated.latitude,
                    longitude: updated.longitude,
                    country: updated.country,
                    providerEmployeeId: stringValue(proposal.data.providerEmployeeId),
                    managerId: proposal.manager.id
                }
            }
        });

        await clearManagerSiteGpsState(proposal.manager.id);
        await notifyGpsProvider(
            tenantId,
            proposal.data.providerPhone,
            `✅ Votre position a été validée pour le site *${updated.name}*.`
        );

        res.json({
            success: true,
            site: updated,
            message: correctCountry
                ? `Position validée et pays corrigé pour ${updated.name}.`
                : `Position validée pour ${updated.name}.`
        });
    } catch (error) {
        console.error('approveSiteGpsProposal error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * POST /api/sites/gps-proposals/:managerId/reject
 * Refuser depuis le dashboard une position GPS proposée par collaborateur.
 */
export const rejectSiteGpsProposal = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const managerId = req.params.managerId as string;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
        }

        const proposal = await getPendingGpsProposalOrNull(tenantId, managerId);
        if (!proposal) {
            return res.status(404).json({ error: 'Position proposée introuvable ou déjà traitée' });
        }

        const data = proposal.data;
        const siteName = stringValue(data.siteName) || (proposal.invalid ? 'concerné' : proposal.site.name);

        await prisma.onboardingEvent.create({
            data: {
                tenantId,
                employeeId: req.user?.userId,
                type: 'SITE_GPS_REJECTED',
                metadata: {
                    source: 'manager_dashboard_rejected',
                    siteId: stringValue(data.siteId),
                    siteName,
                    latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
                    longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
                    siteCountry: stringValue(data.siteCountry),
                    detectedCountry: stringValue(data.detectedCountry),
                    providerEmployeeId: stringValue(data.providerEmployeeId),
                    managerId: proposal.manager.id
                }
            }
        });

        await clearManagerSiteGpsState(proposal.manager.id);
        await notifyGpsProvider(
            tenantId,
            data.providerPhone,
            `⚠️ Votre position n'a pas été retenue pour le site *${siteName}*.`
        );

        res.json({
            success: true,
            message: `Position refusée pour ${siteName}. Le site n'a pas été modifié.`
        });
    } catch (error) {
        console.error('rejectSiteGpsProposal error:', error);
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
            locationMethod,
            acceptCountryMismatch
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

        const countryMismatch = getCountryMismatch(siteCountry, parsedLatitude, parsedLongitude);
        if (countryMismatch && acceptCountryMismatch !== true) {
            return res.status(409).json({
                code: 'SITE_COUNTRY_LOCATION_MISMATCH',
                error: `La position détectée semble être en ${countryMismatch.detectedLabel}, alors que le site est déclaré en ${countryMismatch.selectedLabel}.`,
                ...countryMismatch
            });
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
        const { name, address, country, latitude, longitude, radius, gpsMode, acceptCountryMismatch } = req.body;

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

        const nextCountry = country ? String(country).toUpperCase() : existingSite.country;
        const nextLatitude = latitude !== undefined ? parseNullableFloat(latitude) : existingSite.latitude;
        const nextLongitude = longitude !== undefined ? parseNullableFloat(longitude) : existingSite.longitude;
        const countryMismatch = getCountryMismatch(nextCountry, nextLatitude, nextLongitude);
        if (countryMismatch && acceptCountryMismatch !== true) {
            return res.status(409).json({
                code: 'SITE_COUNTRY_LOCATION_MISMATCH',
                error: `La position détectée semble être en ${countryMismatch.detectedLabel}, alors que le site est déclaré en ${countryMismatch.selectedLabel}.`,
                ...countryMismatch
            });
        }

        const site = await prisma.site.update({
            where: { id },
            data: {
                name,
                address,
                country: nextCountry,
                latitude: nextLatitude,
                longitude: nextLongitude,
                radius: radius ? parseRadius(radius, existingSite.radius) : existingSite.radius,
                gpsMode: gpsMode ? normalizeGpsMode(gpsMode) : existingSite.gpsMode
            }
        });

        const gpsChanged = existingSite.latitude !== site.latitude || existingSite.longitude !== site.longitude;
        if (gpsChanged && site.latitude !== null && site.longitude !== null) {
            await prisma.onboardingEvent.create({
                data: {
                    tenantId,
                    employeeId: req.user?.userId,
                    type: 'SITE_GPS_UPDATED',
                    metadata: {
                        source: 'manager_dashboard',
                        siteId: site.id,
                        siteName: site.name,
                        latitude: site.latitude,
                        longitude: site.longitude,
                        country: site.country,
                        gpsMode: site.gpsMode
                    }
                }
            });
        }

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
