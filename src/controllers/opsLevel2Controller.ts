import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { addDays, addWeeks, addMonths, addYears, setHours, setMinutes, startOfDay } from 'date-fns';

// =============================================
// RECURRING INTERVENTIONS 🔄
// =============================================

/** Calculate next occurrence from a given date based on frequency */
function calculateNextOccurrence(
    fromDate: Date,
    frequency: string,
    intervalValue: number = 1,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
): Date {
    let next: Date;
    switch (frequency) {
        case 'DAILY':
            next = addDays(fromDate, intervalValue);
            break;
        case 'WEEKLY':
            next = addWeeks(fromDate, intervalValue);
            if (dayOfWeek !== undefined && dayOfWeek !== null) {
                const diff = dayOfWeek - next.getDay();
                next = addDays(next, diff >= 0 ? diff : diff + 7);
            }
            break;
        case 'BIWEEKLY':
            next = addWeeks(fromDate, 2 * intervalValue);
            break;
        case 'MONTHLY':
            next = addMonths(fromDate, intervalValue);
            if (dayOfMonth) {
                const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
                next.setDate(Math.min(dayOfMonth, maxDay));
            }
            break;
        case 'QUARTERLY':
            next = addMonths(fromDate, 3 * intervalValue);
            break;
        case 'BIANNUAL':
            next = addMonths(fromDate, 6 * intervalValue);
            break;
        case 'ANNUAL':
            next = addYears(fromDate, intervalValue);
            break;
        default:
            next = addMonths(fromDate, intervalValue);
    }
    return next;
}

/** GET /api/recurring-interventions */
export const getRecurringInterventions = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const items = await prisma.recurringIntervention.findMany({
            where: { tenantId },
            include: {
                customer: { select: { id: true, companyName: true, contactName: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true } },
                employee: { select: { id: true, name: true, phoneNumber: true } },
                interventionType: { select: { id: true, name: true, color: true, icon: true, defaultDuration: true } },
                _count: { select: { interventions: true } },
            },
            orderBy: { nextOccurrence: 'asc' },
        });
        res.json(items);
    } catch (error) {
        console.error('Error fetching recurring interventions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/recurring-interventions */
export const createRecurringIntervention = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const {
            title, description, frequency, intervalValue, dayOfWeek, dayOfMonth, preferredTime,
            startDate, endDate, autoAssign,
            interventionTypeId, customerId, customerSiteId, employeeId,
        } = req.body;

        if (!title || !frequency || !startDate || !customerId || !employeeId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Calculate first ocurrence
        const start = new Date(startDate);
        const nextOccurrence = start;

        const item = await prisma.recurringIntervention.create({
            data: {
                title,
                description,
                frequency,
                intervalValue: intervalValue || 1,
                dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
                dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : null,
                preferredTime: preferredTime || '09:00',
                startDate: start,
                endDate: endDate ? new Date(endDate) : null,
                nextOccurrence,
                autoAssign: autoAssign !== false,
                interventionTypeId: interventionTypeId || null,
                customerId,
                customerSiteId: customerSiteId || null,
                employeeId,
                tenantId,
            },
            include: {
                customer: { select: { id: true, companyName: true } },
                employee: { select: { id: true, name: true } },
                interventionType: { select: { id: true, name: true, color: true } },
            },
        });

        res.status(201).json(item);
    } catch (error) {
        console.error('Error creating recurring intervention:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/recurring-interventions/:id */
export const updateRecurringIntervention = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;

        const existing = await prisma.recurringIntervention.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Not found' });

        const {
            title, description, frequency, intervalValue, dayOfWeek, dayOfMonth, preferredTime,
            startDate, endDate, isActive, autoAssign,
            interventionTypeId, customerId, customerSiteId, employeeId,
        } = req.body;

        // Recalculate next if frequency changes
        let nextOccurrence = existing.nextOccurrence;
        if (frequency && frequency !== existing.frequency) {
            const base = existing.lastGenerated || existing.startDate;
            nextOccurrence = calculateNextOccurrence(base, frequency, intervalValue || existing.intervalValue, dayOfWeek, dayOfMonth);
        }

        const item = await prisma.recurringIntervention.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(frequency !== undefined && { frequency }),
                ...(intervalValue !== undefined && { intervalValue }),
                ...(dayOfWeek !== undefined && { dayOfWeek }),
                ...(dayOfMonth !== undefined && { dayOfMonth }),
                ...(preferredTime !== undefined && { preferredTime }),
                ...(startDate !== undefined && { startDate: new Date(startDate) }),
                ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
                ...(isActive !== undefined && { isActive }),
                ...(autoAssign !== undefined && { autoAssign }),
                ...(interventionTypeId !== undefined && { interventionTypeId: interventionTypeId || null }),
                ...(customerId !== undefined && { customerId }),
                ...(customerSiteId !== undefined && { customerSiteId: customerSiteId || null }),
                ...(employeeId !== undefined && { employeeId }),
                nextOccurrence,
            },
        });

        res.json(item);
    } catch (error) {
        console.error('Error updating recurring intervention:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/recurring-interventions/:id */
export const deleteRecurringIntervention = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;
        const existing = await prisma.recurringIntervention.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        await prisma.recurringIntervention.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting recurring intervention:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/recurring-interventions/:id/generate - Manually trigger next occurrence */
export const generateRecurringOccurrence = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;

        const recurring = await prisma.recurringIntervention.findFirst({
            where: { id, tenantId },
            include: { interventionType: true },
        });
        if (!recurring) return res.status(404).json({ error: 'Not found' });
        if (!recurring.isActive) return res.status(400).json({ error: 'Recurring is not active' });

        // Parse preferred time
        const [hours, minutes] = (recurring.preferredTime || '09:00').split(':').map(Number);
        const scheduledStart = recurring.nextOccurrence || new Date();
        scheduledStart.setHours(hours, minutes, 0, 0);

        const duration = recurring.interventionType?.defaultDuration || 60;
        const scheduledEnd = new Date(scheduledStart.getTime() + duration * 60000);

        // Create the intervention
        const intervention = await prisma.intervention.create({
            data: {
                title: recurring.title,
                description: recurring.description,
                interventionTypeId: recurring.interventionTypeId,
                status: 'SCHEDULED',
                scheduledStart,
                scheduledEnd,
                customerId: recurring.customerId,
                customerSiteId: recurring.customerSiteId,
                employeeId: recurring.employeeId,
                recurringInterventionId: recurring.id,
                tenantId,
            },
            include: {
                customer: { select: { id: true, companyName: true, contactName: true } },
                employee: { select: { id: true, name: true } },
            },
        });

        // Calculate next
        const nextOccurrence = calculateNextOccurrence(
            scheduledStart, recurring.frequency, recurring.intervalValue,
            recurring.dayOfWeek, recurring.dayOfMonth
        );

        // Check if we reached endDate
        const shouldDeactivate = recurring.endDate && nextOccurrence > recurring.endDate;

        await prisma.recurringIntervention.update({
            where: { id },
            data: {
                lastGenerated: new Date(),
                nextOccurrence: shouldDeactivate ? null : nextOccurrence,
                isActive: shouldDeactivate ? false : true,
            },
        });

        res.status(201).json(intervention);
    } catch (error) {
        console.error('Error generating recurring occurrence:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// PARTS & MATERIALS 🔧
// =============================================

/** GET /api/parts */
export const getParts = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { category, search, lowStock } = req.query;

        const where: any = { tenantId };
        if (category) where.category = category;
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { reference: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        if (lowStock === 'true') {
            // Only items where stock is at or below minStock
            where.stockQuantity = { lte: prisma.part.fields?.minStock || 0 };
            // Simpler approach: use raw filter
            where.AND = [{ minStock: { gt: 0 } }];
            delete where.stockQuantity;
        }

        const parts = await prisma.part.findMany({
            where,
            include: {
                _count: { select: { interventionParts: true } },
            },
            orderBy: { name: 'asc' },
        });

        // If lowStock filter, do post-filtering
        const result = lowStock === 'true'
            ? parts.filter(p => p.stockQuantity <= p.minStock)
            : parts;

        res.json(result);
    } catch (error) {
        console.error('Error fetching parts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/parts */
export const createPart = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { reference, name, description, category, unitPrice, costPrice, stockQuantity, minStock, unit } = req.body;

        if (!reference || !name) {
            return res.status(400).json({ error: 'Reference and name are required' });
        }

        const part = await prisma.part.create({
            data: {
                reference, name,
                description: description || null,
                category: category || 'GENERAL',
                unitPrice: unitPrice || 0,
                costPrice: costPrice || 0,
                stockQuantity: stockQuantity || 0,
                minStock: minStock || 0,
                unit: unit || 'pce',
                tenantId,
            },
        });

        res.status(201).json(part);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Cette référence existe déjà' });
        }
        console.error('Error creating part:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/parts/:id */
export const updatePart = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;

        const existing = await prisma.part.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Not found' });

        const { reference, name, description, category, unitPrice, costPrice, stockQuantity, minStock, unit, isActive } = req.body;

        const part = await prisma.part.update({
            where: { id },
            data: {
                ...(reference !== undefined && { reference }),
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(category !== undefined && { category }),
                ...(unitPrice !== undefined && { unitPrice }),
                ...(costPrice !== undefined && { costPrice }),
                ...(stockQuantity !== undefined && { stockQuantity }),
                ...(minStock !== undefined && { minStock }),
                ...(unit !== undefined && { unit }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json(part);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Cette référence existe déjà' });
        }
        console.error('Error updating part:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/parts/:id */
export const deletePart = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;
        const existing = await prisma.part.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        await prisma.part.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting part:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PATCH /api/parts/:id/stock - Adjust stock */
export const adjustPartStock = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;
        const { adjustment, reason } = req.body; // adjustment can be +5 or -3

        const existing = await prisma.part.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Not found' });

        const newQuantity = existing.stockQuantity + (adjustment || 0);
        if (newQuantity < 0) return res.status(400).json({ error: 'Stock cannot be negative' });

        const part = await prisma.part.update({
            where: { id },
            data: { stockQuantity: newQuantity },
        });

        res.json(part);
    } catch (error) {
        console.error('Error adjusting stock:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// --- Intervention Parts ---

/** GET /api/interventions/:id/parts */
export const getInterventionParts = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const interventionId = req.params.id;

        // Verify intervention belongs to tenant
        const intervention = await prisma.intervention.findFirst({ where: { id: interventionId, tenantId } });
        if (!intervention) return res.status(404).json({ error: 'Intervention not found' });

        const parts = await prisma.interventionPart.findMany({
            where: { interventionId },
            include: {
                part: { select: { id: true, reference: true, name: true, unit: true, category: true, stockQuantity: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json(parts);
    } catch (error) {
        console.error('Error fetching intervention parts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/interventions/:id/parts */
export const addInterventionPart = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const interventionId = req.params.id;
        const { partId, quantity } = req.body;

        const intervention = await prisma.intervention.findFirst({ where: { id: interventionId, tenantId } });
        if (!intervention) return res.status(404).json({ error: 'Intervention not found' });

        const part = await prisma.part.findFirst({ where: { id: partId, tenantId } });
        if (!part) return res.status(404).json({ error: 'Part not found' });

        const qty = quantity || 1;
        const totalPrice = qty * part.unitPrice;

        // Create intervention part and decrement stock in a transaction
        const [interventionPart] = await prisma.$transaction([
            prisma.interventionPart.create({
                data: {
                    interventionId,
                    partId,
                    quantity: qty,
                    unitPrice: part.unitPrice,
                    totalPrice,
                },
                include: {
                    part: { select: { id: true, reference: true, name: true, unit: true } },
                },
            }),
            prisma.part.update({
                where: { id: partId },
                data: { stockQuantity: { decrement: qty } },
            }),
        ]);

        res.status(201).json(interventionPart);
    } catch (error) {
        console.error('Error adding intervention part:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/interventions/:interventionId/parts/:partLineId */
export const removeInterventionPart = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { id: interventionId, partLineId } = req.params;

        const intervention = await prisma.intervention.findFirst({ where: { id: interventionId, tenantId } });
        if (!intervention) return res.status(404).json({ error: 'Intervention not found' });

        const line = await prisma.interventionPart.findUnique({ where: { id: partLineId } });
        if (!line || line.interventionId !== interventionId) return res.status(404).json({ error: 'Part line not found' });

        // Remove and restore stock
        await prisma.$transaction([
            prisma.interventionPart.delete({ where: { id: partLineId } }),
            prisma.part.update({
                where: { id: line.partId },
                data: { stockQuantity: { increment: line.quantity } },
            }),
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error removing intervention part:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// QUOTES (DEVIS) 💰
// =============================================

/** Generate next quote reference */
async function generateQuoteReference(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DEV-${year}-`;

    const lastQuote = await prisma.quote.findFirst({
        where: { tenantId, reference: { startsWith: prefix } },
        orderBy: { reference: 'desc' },
    });

    if (!lastQuote) return `${prefix}001`;

    const lastNum = parseInt(lastQuote.reference.replace(prefix, ''), 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
}

/** Recalculate quote amounts */
function recalcQuote(lineItems: { quantity: number; unitPrice: number }[], taxRate: number, discount: number) {
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const afterDiscount = subtotal - discount;
    const taxAmount = afterDiscount * (taxRate / 100);
    const totalAmount = afterDiscount + taxAmount;
    return { subtotal, taxAmount, totalAmount };
}

/** GET /api/quotes */
export const getQuotes = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { status, customerId } = req.query;

        const where: any = { tenantId };
        if (status) where.status = status;
        if (customerId) where.customerId = customerId;

        const quotes = await prisma.quote.findMany({
            where,
            include: {
                customer: { select: { id: true, companyName: true, contactName: true } },
                interventionType: { select: { id: true, name: true, color: true } },
                _count: { select: { lineItems: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(quotes);
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** GET /api/quotes/:id */
export const getQuoteById = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;

        const quote = await prisma.quote.findFirst({
            where: { id, tenantId },
            include: {
                customer: { select: { id: true, companyName: true, contactName: true, email: true, phone: true, address: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true, postalCode: true } },
                interventionType: { select: { id: true, name: true, color: true, defaultDuration: true } },
                lineItems: {
                    include: { part: { select: { id: true, reference: true, name: true, unit: true } } },
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!quote) return res.status(404).json({ error: 'Quote not found' });
        res.json(quote);
    } catch (error) {
        console.error('Error fetching quote:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/quotes */
export const createQuote = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const { customerId, customerSiteId, interventionTypeId, taxRate, discount, notes, validUntil, lineItems } = req.body;

        if (!customerId) return res.status(400).json({ error: 'Customer required' });

        const reference = await generateQuoteReference(tenantId);

        // Calculate amounts
        const lines = lineItems || [];
        const rate = taxRate !== undefined ? taxRate : 20;
        const disc = discount || 0;
        const amounts = recalcQuote(lines, rate, disc);

        const quote = await prisma.quote.create({
            data: {
                reference,
                customerId,
                customerSiteId: customerSiteId || null,
                interventionTypeId: interventionTypeId || null,
                taxRate: rate,
                discount: disc,
                notes: notes || null,
                validUntil: validUntil ? new Date(validUntil) : null,
                subtotal: amounts.subtotal,
                taxAmount: amounts.taxAmount,
                totalAmount: amounts.totalAmount,
                tenantId,
                lineItems: {
                    create: lines.map((li: any, idx: number) => ({
                        description: li.description || '',
                        quantity: li.quantity || 1,
                        unitPrice: li.unitPrice || 0,
                        totalPrice: (li.quantity || 1) * (li.unitPrice || 0),
                        type: li.type || 'SERVICE',
                        partId: li.partId || null,
                        sortOrder: idx,
                    })),
                },
            },
            include: {
                customer: { select: { id: true, companyName: true } },
                lineItems: true,
            },
        });

        res.status(201).json(quote);
    } catch (error) {
        console.error('Error creating quote:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/quotes/:id */
export const updateQuote = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;

        const existing = await prisma.quote.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (existing.status === 'CONVERTED') return res.status(400).json({ error: 'Cannot edit a converted quote' });

        const { customerId, customerSiteId, interventionTypeId, taxRate, discount, notes, validUntil, status, lineItems } = req.body;

        // If lineItems provided, rebuild them
        if (lineItems) {
            // Delete existing
            await prisma.quoteLineItem.deleteMany({ where: { quoteId: id } });

            // Create new
            await prisma.quoteLineItem.createMany({
                data: lineItems.map((li: any, idx: number) => ({
                    id: undefined,
                    quoteId: id,
                    description: li.description || '',
                    quantity: li.quantity || 1,
                    unitPrice: li.unitPrice || 0,
                    totalPrice: (li.quantity || 1) * (li.unitPrice || 0),
                    type: li.type || 'SERVICE',
                    partId: li.partId || null,
                    sortOrder: idx,
                })),
            });
        }

        // Recalculate
        const allLines = await prisma.quoteLineItem.findMany({ where: { quoteId: id } });
        const rate = taxRate !== undefined ? taxRate : existing.taxRate;
        const disc = discount !== undefined ? discount : existing.discount;
        const amounts = recalcQuote(allLines, rate, disc);

        const quote = await prisma.quote.update({
            where: { id },
            data: {
                ...(customerId !== undefined && { customerId }),
                ...(customerSiteId !== undefined && { customerSiteId: customerSiteId || null }),
                ...(interventionTypeId !== undefined && { interventionTypeId: interventionTypeId || null }),
                ...(notes !== undefined && { notes }),
                ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
                ...(status !== undefined && { status }),
                ...(status === 'ACCEPTED' && { acceptedAt: new Date() }),
                taxRate: rate,
                discount: disc,
                subtotal: amounts.subtotal,
                taxAmount: amounts.taxAmount,
                totalAmount: amounts.totalAmount,
            },
            include: {
                customer: { select: { id: true, companyName: true } },
                lineItems: { orderBy: { sortOrder: 'asc' } },
            },
        });

        res.json(quote);
    } catch (error) {
        console.error('Error updating quote:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/quotes/:id */
export const deleteQuote = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;
        const existing = await prisma.quote.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        await prisma.quote.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting quote:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/quotes/:id/convert - Convert quote to intervention */
export const convertQuoteToIntervention = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const id = req.params.id;
        const { employeeId, scheduledStart, scheduledEnd } = req.body;

        if (!employeeId || !scheduledStart || !scheduledEnd) {
            return res.status(400).json({ error: 'employeeId, scheduledStart, and scheduledEnd are required' });
        }

        const quote = await prisma.quote.findFirst({
            where: { id, tenantId },
            include: { lineItems: true, interventionType: true },
        });
        if (!quote) return res.status(404).json({ error: 'Quote not found' });
        if (quote.status === 'CONVERTED') return res.status(400).json({ error: 'Already converted' });

        // Build description from quote lines
        const description = quote.lineItems
            .map(li => `• ${li.description} (${li.quantity} × ${li.unitPrice.toFixed(2)}€ = ${li.totalPrice.toFixed(2)}€)`)
            .join('\n');

        // Create intervention
        const intervention = await prisma.intervention.create({
            data: {
                title: `${quote.reference} — ${quote.interventionType?.name || 'Intervention'}`,
                description: `Devis ${quote.reference}\n${description}\n\nTotal TTC: ${quote.totalAmount.toFixed(2)}€`,
                interventionTypeId: quote.interventionTypeId,
                status: 'SCHEDULED',
                scheduledStart: new Date(scheduledStart),
                scheduledEnd: new Date(scheduledEnd),
                customerId: quote.customerId,
                customerSiteId: quote.customerSiteId,
                employeeId,
                quoteId: quote.id,
                tenantId,
            },
            include: {
                customer: { select: { id: true, companyName: true } },
                employee: { select: { id: true, name: true } },
            },
        });

        // Update quote status
        await prisma.quote.update({
            where: { id },
            data: {
                status: 'CONVERTED',
                convertedAt: new Date(),
                convertedInterventionId: intervention.id,
            },
        });

        res.status(201).json(intervention);
    } catch (error) {
        console.error('Error converting quote:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// =============================================
// CUSTOMER HISTORY 📋
// =============================================

/** GET /api/customers/:id/history */
export const getCustomerHistory = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user!.tenantId;
        const customerId = req.params.id;

        const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // Get all interventions for this customer
        const interventions = await prisma.intervention.findMany({
            where: { customerId, tenantId },
            include: {
                employee: { select: { id: true, name: true, phoneNumber: true } },
                interventionType: { select: { id: true, name: true, color: true, icon: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true } },
                parts: {
                    include: { part: { select: { name: true, reference: true, unit: true } } },
                },
            },
            orderBy: { scheduledStart: 'desc' },
        });

        // Get quotes
        const quotes = await prisma.quote.findMany({
            where: { customerId, tenantId },
            include: {
                interventionType: { select: { id: true, name: true, color: true } },
                _count: { select: { lineItems: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Get recurring interventions
        const recurring = await prisma.recurringIntervention.findMany({
            where: { customerId, tenantId },
            include: {
                interventionType: { select: { id: true, name: true, color: true } },
                employee: { select: { id: true, name: true } },
                _count: { select: { interventions: true } },
            },
        });

        // Compute stats
        const totalInterventions = interventions.length;
        const completedInterventions = interventions.filter(i => i.status === 'COMPLETED').length;
        const canceledInterventions = interventions.filter(i => i.status === 'CANCELED').length;

        const completedWithTimes = interventions.filter(i =>
            i.status === 'COMPLETED' && i.realStart && i.realEnd
        );
        const avgDurationMin = completedWithTimes.length > 0
            ? completedWithTimes.reduce((sum, i) => {
                const dur = (new Date(i.realEnd!).getTime() - new Date(i.realStart!).getTime()) / 60000;
                return sum + dur;
            }, 0) / completedWithTimes.length
            : 0;

        // Type distribution
        const typeMap: Record<string, { count: number; name: string; color: string }> = {};
        interventions.forEach(i => {
            const key = i.interventionType?.id || 'other';
            if (!typeMap[key]) typeMap[key] = { count: 0, name: i.interventionType?.name || 'Autre', color: i.interventionType?.color || '#94a3b8' };
            typeMap[key].count++;
        });
        const typeDistribution = Object.values(typeMap).sort((a, b) => b.count - a.count);

        // Total parts cost
        const totalPartsCost = interventions.reduce((sum, i) =>
            sum + i.parts.reduce((s, p) => s + p.totalPrice, 0), 0
        );

        // Total quotes accepted
        const totalQuotesAmount = quotes
            .filter(q => q.status === 'ACCEPTED' || q.status === 'CONVERTED')
            .reduce((sum, q) => sum + q.totalAmount, 0);

        // Build timeline (interventions + quotes merged, sorted by date)
        const timeline = [
            ...interventions.map(i => ({
                type: 'intervention' as const,
                id: i.id,
                date: i.scheduledStart,
                title: i.title,
                status: i.status,
                employee: i.employee,
                interventionType: i.interventionType,
                customerSite: i.customerSite,
                partsCount: i.parts.length,
                partsCost: i.parts.reduce((s, p) => s + p.totalPrice, 0),
                hasReport: !!i.reportContent,
                hasSignature: !!i.signatureUrl,
            })),
            ...quotes.map(q => ({
                type: 'quote' as const,
                id: q.id,
                date: q.createdAt,
                title: `Devis ${q.reference}`,
                status: q.status,
                totalAmount: q.totalAmount,
                interventionType: q.interventionType,
                linesCount: q._count.lineItems,
            })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        res.json({
            customer,
            stats: {
                totalInterventions,
                completedInterventions,
                canceledInterventions,
                completionRate: totalInterventions > 0 ? Math.round((completedInterventions / totalInterventions) * 100) : 0,
                avgDurationMin: Math.round(avgDurationMin),
                typeDistribution,
                totalPartsCost,
                totalQuotesAmount,
                recurringCount: recurring.length,
            },
            timeline,
            recurring,
        });
    } catch (error) {
        console.error('Error fetching customer history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
