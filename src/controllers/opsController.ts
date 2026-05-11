import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { signUploadUrlIfNeeded } from '../utils/signedFileUrl';
import crypto from 'crypto';

// =============================================
// CUSTOMERS (CRM)
// =============================================

/** GET /api/customers */
export const getCustomers = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { search } = req.query;

        const where: any = { tenantId };
        if (search) {
            where.OR = [
                { companyName: { contains: String(search), mode: 'insensitive' } },
                { contactName: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } },
                { phone: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const customers = await prisma.customer.findMany({
            where,
            include: {
                sites: { orderBy: [{ isMainSite: 'desc' }, { name: 'asc' }] },
                _count: { select: { interventions: true, sites: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** GET /api/customers/:id */
export const getCustomerById = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.id as string;

        const customer = await prisma.customer.findFirst({
            where: { id: customerId, tenantId },
            include: {
                sites: { orderBy: [{ isMainSite: 'desc' }, { name: 'asc' }] },
                interventions: {
                    orderBy: { scheduledStart: 'desc' },
                    take: 10,
                    include: {
                        employee: { select: { id: true, name: true } },
                        customerSite: { select: { id: true, name: true, city: true } },
                    },
                },
                _count: { select: { interventions: true, sites: true } },
            },
        });

        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/customers */
export const createCustomer = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { companyName, contactName, email, phone, address, country, accessCode, notes } = req.body;

        if (!companyName || !contactName) {
            return res.status(400).json({ error: 'companyName and contactName are required' });
        }

        const customer = await prisma.customer.create({
            data: { companyName, contactName, email, phone, address, country, accessCode, notes, tenantId },
            include: { sites: true, _count: { select: { interventions: true, sites: true } } },
        });

        res.status(201).json(customer);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/customers/:id */
export const updateCustomer = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.id as string;
        const { companyName, contactName, email, phone, address, country, accessCode, notes } = req.body;

        const existing = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Customer not found' });

        const customer = await prisma.customer.update({
            where: { id: customerId },
            data: { companyName, contactName, email, phone, address, country, accessCode, notes },
            include: { sites: true, _count: { select: { interventions: true, sites: true } } },
        });

        res.json(customer);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/customers/:id */
export const deleteCustomer = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.id as string;

        const existing = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Customer not found' });

        await prisma.customer.delete({ where: { id: customerId } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/customers/import-csv */
export const importCustomersCSV = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { customers } = req.body;

        if (!Array.isArray(customers) || customers.length === 0) {
            return res.status(400).json({ error: 'customers array is required' });
        }

        const created = await prisma.customer.createMany({
            data: customers.map((c: any) => ({
                companyName: c.companyName || c.company || 'Sans nom',
                contactName: c.contactName || c.contact || 'N/A',
                email: c.email || null,
                phone: c.phone || null,
                address: c.address || null,
                country: c.country || 'FR',
                tenantId,
            })),
        });

        res.status(201).json({ imported: created.count });
    } catch (error) {
        console.error('Error importing customers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// CUSTOMER SITES
// =============================================

/** GET /api/customers/:id/sites */
export const getCustomerSites = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.id as string;

        // Verify customer ownership
        const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const sites = await prisma.customerSite.findMany({
            where: { customerId },
            orderBy: [{ isMainSite: 'desc' }, { name: 'asc' }],
            include: { _count: { select: { interventions: true } } },
        });

        res.json(sites);
    } catch (error) {
        console.error('Error fetching customer sites:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/customers/:id/sites */
export const createCustomerSite = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.id as string;
        const {
            name, address, address2, city, postalCode, country,
            latitude, longitude,
            contactName, contactPhone, contactEmail,
            accessCode, accessNotes, isMainSite,
        } = req.body;

        // Verify customer ownership
        const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        if (!name || !address || !city || !postalCode) {
            return res.status(400).json({ error: 'name, address, city and postalCode are required' });
        }

        // If this is main site, unset other main sites
        if (isMainSite) {
            await prisma.customerSite.updateMany({
                where: { customerId, isMainSite: true },
                data: { isMainSite: false },
            });
        }

        const site = await prisma.customerSite.create({
            data: {
                name, address, address2, city, postalCode,
                country: country || 'FR',
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                contactName, contactPhone, contactEmail,
                accessCode, accessNotes,
                isMainSite: isMainSite || false,
                customerId,
            },
            include: { _count: { select: { interventions: true } } },
        });

        // If first site of customer, auto-update customer's address field
        const siteCount = await prisma.customerSite.count({ where: { customerId } });
        if (siteCount === 1 || isMainSite) {
            await prisma.customer.update({
                where: { id: customerId },
                data: { address: `${address}, ${postalCode} ${city}`, country: country || 'FR' },
            });
        }

        res.status(201).json(site);
    } catch (error) {
        console.error('Error creating customer site:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/customers/:customerId/sites/:siteId */
export const updateCustomerSite = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.customerId as string;
        const siteId = req.params.siteId as string;

        // Verify customer ownership
        const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const existingSite = await prisma.customerSite.findFirst({ where: { id: siteId, customerId } });
        if (!existingSite) return res.status(404).json({ error: 'Site not found' });

        const {
            name, address, address2, city, postalCode, country,
            latitude, longitude,
            contactName, contactPhone, contactEmail,
            accessCode, accessNotes, isMainSite,
        } = req.body;

        // If promoting to main site, unset other main sites
        if (isMainSite && !existingSite.isMainSite) {
            await prisma.customerSite.updateMany({
                where: { customerId, isMainSite: true },
                data: { isMainSite: false },
            });
        }

        const site = await prisma.customerSite.update({
            where: { id: siteId },
            data: {
                ...(name !== undefined && { name }),
                ...(address !== undefined && { address }),
                ...(address2 !== undefined && { address2 }),
                ...(city !== undefined && { city }),
                ...(postalCode !== undefined && { postalCode }),
                ...(country !== undefined && { country }),
                ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
                ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
                ...(contactName !== undefined && { contactName }),
                ...(contactPhone !== undefined && { contactPhone }),
                ...(contactEmail !== undefined && { contactEmail }),
                ...(accessCode !== undefined && { accessCode }),
                ...(accessNotes !== undefined && { accessNotes }),
                ...(isMainSite !== undefined && { isMainSite }),
            },
            include: { _count: { select: { interventions: true } } },
        });

        // If main site, update customer's address field
        if (site.isMainSite) {
            await prisma.customer.update({
                where: { id: customerId },
                data: { address: `${site.address}, ${site.postalCode} ${site.city}` },
            });
        }

        res.json(site);
    } catch (error) {
        console.error('Error updating customer site:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/customers/:customerId/sites/:siteId */
export const deleteCustomerSite = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.customerId as string;
        const siteId = req.params.siteId as string;

        const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const site = await prisma.customerSite.findFirst({ where: { id: siteId, customerId } });
        if (!site) return res.status(404).json({ error: 'Site not found' });

        // Remove site reference from interventions
        await prisma.intervention.updateMany({
            where: { customerSiteId: siteId },
            data: { customerSiteId: null },
        });

        await prisma.customerSite.delete({ where: { id: siteId } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting customer site:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// INTERVENTION TYPES
// =============================================

/** GET /api/intervention-types */
export const getInterventionTypes = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { includeInactive } = req.query;

        const where: any = { tenantId };
        if (!includeInactive) where.isActive = true;

        const types = await prisma.interventionType.findMany({
            where,
            include: { _count: { select: { interventions: true } } },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });

        res.json(types);
    } catch (error) {
        console.error('Error fetching intervention types:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/intervention-types */
export const createInterventionType = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const {
            name, description, color, icon, defaultDuration,
            requiresReport, requiresSignature, requiresPhotos,
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        // Get next sort order
        const maxSort = await prisma.interventionType.aggregate({
            where: { tenantId },
            _max: { sortOrder: true },
        });

        const type = await prisma.interventionType.create({
            data: {
                name,
                description: description || null,
                color: color || '#3b82f6',
                icon: icon || null,
                defaultDuration: defaultDuration ? parseInt(defaultDuration) : 60,
                requiresReport: requiresReport || false,
                requiresSignature: requiresSignature !== false,
                requiresPhotos: requiresPhotos || false,
                sortOrder: (maxSort._max.sortOrder || 0) + 1,
                tenantId,
            },
            include: { _count: { select: { interventions: true } } },
        });

        res.status(201).json(type);
    } catch (error) {
        console.error('Error creating intervention type:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/intervention-types/:id */
export const updateInterventionType = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const typeId = req.params.id as string;

        const existing = await prisma.interventionType.findFirst({ where: { id: typeId, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Intervention type not found' });

        const {
            name, description, color, icon, defaultDuration, isActive,
            requiresReport, requiresSignature, requiresPhotos, sortOrder,
        } = req.body;

        const type = await prisma.interventionType.update({
            where: { id: typeId },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(color !== undefined && { color }),
                ...(icon !== undefined && { icon }),
                ...(defaultDuration !== undefined && { defaultDuration: parseInt(defaultDuration) }),
                ...(isActive !== undefined && { isActive }),
                ...(requiresReport !== undefined && { requiresReport }),
                ...(requiresSignature !== undefined && { requiresSignature }),
                ...(requiresPhotos !== undefined && { requiresPhotos }),
                ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
            },
            include: { _count: { select: { interventions: true } } },
        });

        res.json(type);
    } catch (error) {
        console.error('Error updating intervention type:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/intervention-types/:id */
export const deleteInterventionType = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const typeId = req.params.id as string;

        const existing = await prisma.interventionType.findFirst({
            where: { id: typeId, tenantId },
            include: { _count: { select: { interventions: true } } },
        });
        if (!existing) return res.status(404).json({ error: 'Intervention type not found' });

        // If type has interventions, archive instead of delete
        if (existing._count.interventions > 0) {
            const archived = await prisma.interventionType.update({
                where: { id: typeId },
                data: { isActive: false },
                include: { _count: { select: { interventions: true } } },
            });
            return res.json({ ...archived, _archived: true, message: 'Type archivé car utilisé par des interventions existantes' });
        }

        await prisma.interventionType.delete({ where: { id: typeId } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting intervention type:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PATCH /api/intervention-types/reorder */
export const reorderInterventionTypes = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { orderedIds } = req.body; // string[]

        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds array is required' });
        }

        await Promise.all(
            orderedIds.map((id: string, index: number) =>
                prisma.interventionType.updateMany({
                    where: { id, tenantId },
                    data: { sortOrder: index },
                })
            )
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error reordering intervention types:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// INTERVENTIONS
// =============================================

/** GET /api/interventions */
export const getInterventions = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { status, from, to, employeeId, customerId } = req.query;

        const where: any = { tenantId };
        if (status) where.status = status;
        if (employeeId) where.employeeId = String(employeeId);
        if (customerId) where.customerId = String(customerId);
        if (from || to) {
            where.scheduledStart = {};
            if (from) where.scheduledStart.gte = new Date(String(from));
            if (to) where.scheduledStart.lte = new Date(String(to));
        }

        const interventions = await prisma.intervention.findMany({
            where,
            include: {
                customer: { select: { id: true, companyName: true, contactName: true, address: true, phone: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true, postalCode: true, contactName: true, contactPhone: true, accessCode: true } },
                interventionType: { select: { id: true, name: true, color: true, icon: true, defaultDuration: true, requiresReport: true, requiresSignature: true, requiresPhotos: true } },
                employee: { select: { id: true, name: true, phoneNumber: true } },
            },
            orderBy: { scheduledStart: 'asc' },
        });

        res.json(interventions.map(intervention => ({
            ...intervention,
            signatureUrl: signUploadUrlIfNeeded(intervention.signatureUrl),
            reportPhotos: Array.isArray(intervention.reportPhotos)
                ? intervention.reportPhotos.map((url: unknown) => typeof url === 'string' ? signUploadUrlIfNeeded(url) : url)
                : intervention.reportPhotos
        })));
    } catch (error) {
        console.error('Error fetching interventions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/interventions */
export const createIntervention = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { title, description, customerId, customerSiteId, interventionTypeId, employeeId, scheduledStart, scheduledEnd } = req.body;

        if (!title || !customerId || !employeeId || !scheduledStart || !scheduledEnd) {
            return res.status(400).json({ error: 'title, customerId, employeeId, scheduledStart and scheduledEnd are required' });
        }

        const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // If a site is specified, verify it belongs to this customer
        if (customerSiteId) {
            const site = await prisma.customerSite.findFirst({ where: { id: customerSiteId, customerId } });
            if (!site) return res.status(404).json({ error: 'Customer site not found' });
        }

        const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const signatureToken = crypto.randomUUID();

        // If a type is specified, verify it belongs to this tenant
        if (interventionTypeId) {
            const iType = await prisma.interventionType.findFirst({ where: { id: interventionTypeId, tenantId, isActive: true } });
            if (!iType) return res.status(404).json({ error: 'Intervention type not found' });
        }

        const intervention = await prisma.intervention.create({
            data: {
                title,
                description,
                customerId,
                customerSiteId: customerSiteId || null,
                interventionTypeId: interventionTypeId || null,
                employeeId,
                tenantId,
                scheduledStart: new Date(scheduledStart),
                scheduledEnd: new Date(scheduledEnd),
                signatureToken,
            },
            include: {
                customer: { select: { id: true, companyName: true, contactName: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true, postalCode: true, contactName: true, accessCode: true } },
                interventionType: { select: { id: true, name: true, color: true, icon: true } },
                employee: { select: { id: true, name: true, phoneNumber: true } },
            },
        });

        res.status(201).json(intervention);
    } catch (error) {
        console.error('Error creating intervention:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/interventions/:id */
export const updateIntervention = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const interventionId = req.params.id as string;
        const { title, description, customerId, customerSiteId, interventionTypeId, employeeId, scheduledStart, scheduledEnd, status } = req.body;

        const existing = await prisma.intervention.findFirst({ where: { id: interventionId, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Intervention not found' });

        const data: any = {};
        if (title !== undefined) data.title = title;
        if (description !== undefined) data.description = description;
        if (customerId !== undefined) data.customerId = customerId;
        if (customerSiteId !== undefined) data.customerSiteId = customerSiteId || null;
        if (interventionTypeId !== undefined) data.interventionTypeId = interventionTypeId || null;
        if (employeeId !== undefined) data.employeeId = employeeId;
        if (scheduledStart !== undefined) data.scheduledStart = new Date(scheduledStart);
        if (scheduledEnd !== undefined) data.scheduledEnd = new Date(scheduledEnd);
        if (status !== undefined) {
            data.status = status;
            if (status === 'IN_PROGRESS' && !existing.realStart) {
                data.realStart = new Date();
            }
            if (status === 'COMPLETED' && !existing.realEnd) {
                data.realEnd = new Date();
            }
        }

        const intervention = await prisma.intervention.update({
            where: { id: interventionId },
            data,
            include: {
                customer: { select: { id: true, companyName: true, contactName: true, address: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true } },
                interventionType: { select: { id: true, name: true, color: true, icon: true } },
                employee: { select: { id: true, name: true, phoneNumber: true } },
            },
        });

        res.json(intervention);
    } catch (error) {
        console.error('Error updating intervention:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PATCH /api/interventions/:id/status - Quick status update */
export const updateInterventionStatus = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const interventionId = req.params.id as string;
        const { status } = req.body;

        const validStatuses = ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const existing = await prisma.intervention.findFirst({ where: { id: interventionId, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Intervention not found' });

        const data: any = { status };
        if (status === 'IN_PROGRESS' && !existing.realStart) data.realStart = new Date();
        if (status === 'COMPLETED' && !existing.realEnd) data.realEnd = new Date();

        const intervention = await prisma.intervention.update({ where: { id: interventionId }, data });
        res.json(intervention);
    } catch (error) {
        console.error('Error updating intervention status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/interventions/:id */
export const deleteIntervention = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const interventionId = req.params.id as string;

        const existing = await prisma.intervention.findFirst({ where: { id: interventionId, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Intervention not found' });

        await prisma.intervention.delete({ where: { id: interventionId } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting intervention:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// PUBLIC SIGNATURE (No Auth - Token protected)
// =============================================

/** GET /api/public/intervention/:token - Get intervention data for signature page */
export const getInterventionByToken = async (req: Request, res: Response) => {
    try {
        const tokenValue = req.params.token as string;

        const intervention = await prisma.intervention.findUnique({
            where: { signatureToken: tokenValue },
            include: {
                customer: { select: { companyName: true, contactName: true, address: true } },
                customerSite: { select: { name: true, address: true, city: true, postalCode: true, contactName: true } },
                employee: { select: { name: true } },
                tenant: { select: { name: true } },
            },
        });

        if (!intervention) return res.status(404).json({ error: 'Intervention not found' });
        if (intervention.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Intervention already completed and signed' });
        }

        const reportPhotos = Array.isArray(intervention.reportPhotos)
            ? intervention.reportPhotos.map((url: unknown) => typeof url === 'string' ? signUploadUrlIfNeeded(url) : url)
            : intervention.reportPhotos;

        res.json({
            id: intervention.id,
            title: intervention.title,
            description: intervention.description,
            reportContent: intervention.reportContent,
            reportPhotos,
            scheduledStart: intervention.scheduledStart,
            scheduledEnd: intervention.scheduledEnd,
            realStart: intervention.realStart,
            customer: (intervention as any).customer,
            customerSite: (intervention as any).customerSite,
            employee: (intervention as any).employee,
            tenant: (intervention as any).tenant,
            status: intervention.status,
        });
    } catch (error) {
        console.error('Error fetching intervention by token:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/public/intervention/:token/sign - Submit signature */
export const signIntervention = async (req: Request, res: Response) => {
    try {
        const tokenValue = req.params.token as string;
        const { signatureDataUrl } = req.body;

        if (!signatureDataUrl) {
            return res.status(400).json({ error: 'signatureDataUrl is required' });
        }

        const intervention = await prisma.intervention.findUnique({
            where: { signatureToken: tokenValue },
        });

        if (!intervention) return res.status(404).json({ error: 'Intervention not found' });
        if (intervention.signatureUrl) {
            return res.status(400).json({ error: 'Intervention already signed' });
        }

        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(process.cwd(), 'uploads', 'signatures');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const signatureFilename = `sig_${intervention.id}_${Date.now()}.png`;
        const signaturePath = path.join(uploadsDir, signatureFilename);
        const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(signaturePath, Buffer.from(base64Data, 'base64'));

        const signatureUrl = `/uploads/signatures/${signatureFilename}`;

        const updated = await prisma.intervention.update({
            where: { id: intervention.id },
            data: {
                signatureUrl,
                status: 'COMPLETED',
                realEnd: intervention.realEnd || new Date(),
            },
        });

        res.json({ success: true, intervention: updated });
    } catch (error) {
        console.error('Error signing intervention:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PATCH /api/interventions/:id/report - Submit report (tech) */
export const submitReport = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const interventionId = req.params.id as string;
        const { reportContent, reportPhotos } = req.body;

        const existing = await prisma.intervention.findFirst({ where: { id: interventionId, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Intervention not found' });

        const intervention = await prisma.intervention.update({
            where: { id: interventionId },
            data: {
                reportContent: reportContent || existing.reportContent,
                reportPhotos: reportPhotos || existing.reportPhotos,
            },
        });

        res.json(intervention);
    } catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// DASHBOARD & ANALYTICS
// =============================================

/** GET /api/operations/dashboard */
export const getOperationsDashboard = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Fetch all interventions for the month (wide net)
        const allInterventions = await prisma.intervention.findMany({
            where: {
                tenantId,
                scheduledStart: { gte: monthStart, lte: monthEnd },
            },
            include: {
                customer: { select: { id: true, companyName: true, contactName: true, phone: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true } },
                interventionType: { select: { id: true, name: true, color: true, icon: true } },
                employee: { select: { id: true, name: true, phoneNumber: true } },
            },
            orderBy: { scheduledStart: 'asc' },
        });

        // Today's interventions
        const todayInterventions = allInterventions.filter(i => {
            const s = new Date(i.scheduledStart);
            return s >= todayStart && s <= todayEnd;
        });

        // This week's interventions
        const weekInterventions = allInterventions.filter(i => {
            const s = new Date(i.scheduledStart);
            return s >= weekStart && s <= weekEnd;
        });

        // ---- KPIs ----
        const todayTotal = todayInterventions.length;
        const todayCompleted = todayInterventions.filter(i => i.status === 'COMPLETED').length;
        const todayInProgress = todayInterventions.filter(i => i.status === 'IN_PROGRESS').length;
        const todayEnRoute = todayInterventions.filter(i => i.status === 'EN_ROUTE').length;
        const todayScheduled = todayInterventions.filter(i => i.status === 'SCHEDULED').length;

        // Overdue: SCHEDULED/EN_ROUTE but scheduledEnd < now
        const overdue = allInterventions.filter(i =>
            ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'].includes(i.status) &&
            new Date(i.scheduledEnd) < now
        );

        // Completion rate this month
        const monthCompleted = allInterventions.filter(i => i.status === 'COMPLETED').length;
        const monthTotal = allInterventions.filter(i => i.status !== 'CANCELED').length;
        const completionRate = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;

        // Signature rate
        const signedCount = allInterventions.filter(i => i.signatureUrl).length;
        const completedForSign = allInterventions.filter(i => i.status === 'COMPLETED').length;
        const signatureRate = completedForSign > 0 ? Math.round((signedCount / completedForSign) * 100) : 0;

        // Average duration (completed interventions with real times)
        const withRealTimes = allInterventions.filter(i => i.realStart && i.realEnd);
        let avgDurationMinutes = 0;
        if (withRealTimes.length > 0) {
            const totalMinutes = withRealTimes.reduce((sum, i) => {
                return sum + (new Date(i.realEnd!).getTime() - new Date(i.realStart!).getTime()) / 60000;
            }, 0);
            avgDurationMinutes = Math.round(totalMinutes / withRealTimes.length);
        }

        // ---- Alerts ----
        const alerts: { type: string; severity: 'warning' | 'error' | 'info'; message: string; interventionId?: string }[] = [];

        // Overdue interventions
        overdue.forEach(i => {
            alerts.push({
                type: 'overdue',
                severity: 'error',
                message: `"${i.title}" chez ${i.customer.companyName} est en retard`,
                interventionId: i.id,
            });
        });

        // Missing signature on completed interventions
        allInterventions
            .filter(i => i.status === 'COMPLETED' && !i.signatureUrl)
            .slice(0, 5)
            .forEach(i => {
                alerts.push({
                    type: 'missing_signature',
                    severity: 'warning',
                    message: `Signature manquante pour "${i.title}" (${i.customer.companyName})`,
                    interventionId: i.id,
                });
            });

        // Today scheduled but no employee assigned won't happen (employee is required), skip

        // Upcoming interventions in next 2 hours without EN_ROUTE status
        const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        allInterventions
            .filter(i => {
                const s = new Date(i.scheduledStart);
                return s > now && s <= in2h && i.status === 'SCHEDULED';
            })
            .forEach(i => {
                alerts.push({
                    type: 'upcoming',
                    severity: 'info',
                    message: `"${i.title}" débute bientôt — technicien pas encore en route`,
                    interventionId: i.id,
                });
            });

        // ---- Technician Workload (this week) ----
        const employeeMap = new Map<string, { id: string; name: string; phone: string; count: number; completed: number; hours: number }>();
        weekInterventions.forEach(i => {
            const emp = employeeMap.get(i.employeeId) || {
                id: i.employee.id,
                name: i.employee.name || i.employee.phoneNumber,
                phone: i.employee.phoneNumber,
                count: 0,
                completed: 0,
                hours: 0,
            };
            emp.count++;
            if (i.status === 'COMPLETED') emp.completed++;
            // Calculate hours
            const duration = (new Date(i.scheduledEnd).getTime() - new Date(i.scheduledStart).getTime()) / 3600000;
            emp.hours += duration;
            employeeMap.set(i.employeeId, emp);
        });
        const technicianWorkload = Array.from(employeeMap.values()).sort((a, b) => b.count - a.count);

        // ---- Type distribution (this month) ----
        const typeMap = new Map<string, { name: string; color: string; count: number }>();
        allInterventions.forEach(i => {
            const typeName = i.interventionType?.name || 'Sans type';
            const typeColor = i.interventionType?.color || '#94a3b8';
            const existing = typeMap.get(typeName) || { name: typeName, color: typeColor, count: 0 };
            existing.count++;
            typeMap.set(typeName, existing);
        });
        const typeDistribution = Array.from(typeMap.values()).sort((a, b) => b.count - a.count);

        // ---- Upcoming interventions (next ones) ----
        const upcoming = allInterventions
            .filter(i => new Date(i.scheduledStart) >= now && i.status !== 'CANCELED')
            .slice(0, 8);

        // ---- Weekly chart data ----
        const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const weeklyChart = weekDays.map((day, idx) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(dayDate.getDate() + idx);
            const dayEnd = new Date(dayDate);
            dayEnd.setHours(23, 59, 59);
            const dayInterventions = weekInterventions.filter(i => {
                const s = new Date(i.scheduledStart);
                return s >= dayDate && s <= dayEnd;
            });
            return {
                day,
                total: dayInterventions.length,
                completed: dayInterventions.filter(i => i.status === 'COMPLETED').length,
                inProgress: dayInterventions.filter(i => i.status === 'IN_PROGRESS').length,
            };
        });

        res.json({
            kpis: {
                todayTotal,
                todayCompleted,
                todayInProgress,
                todayEnRoute,
                todayScheduled,
                overdueCount: overdue.length,
                completionRate,
                signatureRate,
                avgDurationMinutes,
                monthTotal: allInterventions.length,
                monthCompleted,
            },
            alerts: alerts.slice(0, 10),
            technicianWorkload,
            typeDistribution,
            upcoming,
            weeklyChart,
            todayInterventions,
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// WHATSAPP NOTIFICATIONS (FSM)
// =============================================

/** POST /api/interventions/:id/notify - Send WhatsApp notification */
export const sendInterventionNotification = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const interventionId = req.params.id as string;
        const { type } = req.body; // 'reminder' | 'en_route' | 'signature' | 'completed'

        if (!['reminder', 'en_route', 'signature', 'completed'].includes(type)) {
            return res.status(400).json({ error: 'Invalid notification type. Must be: reminder, en_route, signature, completed' });
        }

        const intervention = await prisma.intervention.findFirst({
            where: { id: interventionId, tenantId },
            include: {
                customer: { select: { companyName: true, contactName: true, phone: true } },
                customerSite: { select: { name: true, address: true, city: true, postalCode: true } },
                employee: { select: { name: true, phoneNumber: true } },
                tenant: { select: { name: true } },
            },
        });

        if (!intervention) return res.status(404).json({ error: 'Intervention not found' });

        // Import sendMessage dynamically to avoid circular deps
        const { sendMessage } = await import('../services/whatsappService');

        const scheduledDate = new Date(intervention.scheduledStart);
        const dateStr = scheduledDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const address = intervention.customerSite
            ? `${intervention.customerSite.address}, ${intervention.customerSite.postalCode} ${intervention.customerSite.city}`
            : '';
        const techName = intervention.employee.name || 'Notre technicien';
        const companyName = intervention.tenant.name || 'Notre entreprise';

        const sent: string[] = [];

        if (type === 'reminder' && intervention.customer.phone) {
            // J-1 reminder to customer
            const msg = `📅 *Rappel — Intervention prévue demain*\n\n` +
                `Bonjour ${intervention.customer.contactName},\n\n` +
                `Nous vous confirmons l'intervention suivante :\n` +
                `📌 *${intervention.title}*\n` +
                `📆 ${dateStr} à ${timeStr}\n` +
                (address ? `📍 ${address}\n` : '') +
                `👤 Technicien : ${techName}\n\n` +
                `En cas d'empêchement, merci de nous contacter.\n\n` +
                `— ${companyName}`;
            const phone = intervention.customer.phone.replace('+', '');
            await sendMessage(phone, msg);
            sent.push('customer');
        }

        if (type === 'en_route' && intervention.customer.phone) {
            // Tech is on the way
            const msg = `🚗 *Technicien en route*\n\n` +
                `Bonjour ${intervention.customer.contactName},\n\n` +
                `${techName} est en route pour votre intervention :\n` +
                `📌 *${intervention.title}*\n` +
                (address ? `📍 ${address}\n` : '') +
                `⏰ Arrivée estimée : ${timeStr}\n\n` +
                `— ${companyName}`;
            const phone = intervention.customer.phone.replace('+', '');
            await sendMessage(phone, msg);
            sent.push('customer');
        }

        if (type === 'signature' && intervention.customer.phone && intervention.signatureToken) {
            // Send signature link
            const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
            const signUrl = `${baseUrl}/sign/${intervention.signatureToken}`;
            const msg = `✍️ *Signature requise*\n\n` +
                `Bonjour ${intervention.customer.contactName},\n\n` +
                `L'intervention *"${intervention.title}"* est terminée.\n` +
                `Merci de signer le rapport via ce lien :\n\n` +
                `👉 ${signUrl}\n\n` +
                `— ${companyName}`;
            const phone = intervention.customer.phone.replace('+', '');
            await sendMessage(phone, msg);
            sent.push('customer');
        }

        if (type === 'completed') {
            // Notify employee & customer
            if (intervention.customer.phone) {
                const msg = `✅ *Intervention terminée*\n\n` +
                    `Bonjour ${intervention.customer.contactName},\n\n` +
                    `L'intervention *"${intervention.title}"* a été finalisée.\n` +
                    `Merci de votre confiance !\n\n` +
                    `— ${companyName}`;
                const phone = intervention.customer.phone.replace('+', '');
                await sendMessage(phone, msg);
                sent.push('customer');
            }
        }

        res.json({ success: true, sent, type });
    } catch (error) {
        console.error('Error sending intervention notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/operations/daily-briefing - Send morning briefing to all techs */
export const sendDailyBriefing = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const todayInterventions = await prisma.intervention.findMany({
            where: {
                tenantId,
                scheduledStart: { gte: todayStart, lte: todayEnd },
                status: { not: 'CANCELED' },
            },
            include: {
                customer: { select: { companyName: true, contactName: true } },
                customerSite: { select: { name: true, address: true, city: true } },
                employee: { select: { id: true, name: true, phoneNumber: true } },
            },
            orderBy: { scheduledStart: 'asc' },
        });

        // Group by employee
        const grouped = new Map<string, { employee: typeof todayInterventions[0]['employee']; interventions: typeof todayInterventions }>();
        todayInterventions.forEach(i => {
            const existing = grouped.get(i.employeeId) || { employee: i.employee, interventions: [] };
            existing.interventions.push(i);
            grouped.set(i.employeeId, existing);
        });

        const { sendMessage } = await import('../services/whatsappService');

        let sentCount = 0;
        for (const [, data] of grouped) {
            const { employee, interventions } = data;
            const lines = interventions.map((i, idx) => {
                const time = new Date(i.scheduledStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(i.scheduledEnd).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const location = i.customerSite ? `${i.customerSite.address}, ${i.customerSite.city}` : '';
                return `${idx + 1}. ⏰ ${time}–${endTime}\n   📌 *${i.title}* — ${i.customer.companyName}${location ? `\n   📍 ${location}` : ''}`;
            });

            const msg = `🌅 *Bonjour ${employee.name || 'Technicien'} !*\n\n` +
                `Voici votre feuille de route pour aujourd'hui :\n` +
                `📋 *${interventions.length} intervention(s)*\n\n` +
                lines.join('\n\n') +
                `\n\n💪 Bonne journée !`;

            const phone = employee.phoneNumber.replace('+', '');
            await sendMessage(phone, msg);
            sentCount++;
        }

        res.json({ success: true, technicianCount: sentCount, interventionCount: todayInterventions.length });
    } catch (error) {
        console.error('Error sending daily briefing:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
