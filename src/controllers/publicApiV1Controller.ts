import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendMessage, sendTemplateMessage, WhatsAppTemplateComponent } from '../services/whatsappService';
import { resolveOutgoingWhatsAppChannel } from '../services/whatsappConfigService';
import { runWithPublicApiIdempotency } from '../services/publicApiIdempotencyService';
import { sendPublicApiData, sendPublicApiError } from '../utils/publicApiResponse';

function normalizePhoneNumber(phoneNumber: unknown): string | null {
    if (typeof phoneNumber !== 'string') {
        return null;
    }

    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = `33${formattedPhone.substring(1)}`;
    }

    return formattedPhone.length >= 8 ? formattedPhone : null;
}

function publicApiEnvelope(res: Response, data: Prisma.InputJsonValue): Prisma.InputJsonObject {
    return {
        data,
        meta: {
            requestId: res.locals.publicApiRequestId
        }
    };
}

function parseBoundedLimit(value: unknown, fallback = 50, max = 200): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(Math.floor(parsed), max);
}

function parseDateQuery(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function maskPhoneLast4(phoneNumber: string | null): string | null {
    const digits = phoneNumber?.replace(/\D/g, '') ?? '';
    return digits.length >= 4 ? digits.slice(-4) : null;
}

export async function getMe(req: Request, res: Response): Promise<void> {
    if (!req.publicApi) {
        sendPublicApiError(res, 401, 'unauthorized', 'Invalid or missing API key.');
        return;
    }

    sendPublicApiData(res, {
        tenant: {
            id: req.publicApi.tenantId,
            name: req.publicApi.tenantName,
            country: req.publicApi.tenantCountry,
            plan: req.publicApi.tenantPlan,
            status: req.publicApi.tenantStatus
        },
        apiKey: {
            id: req.publicApi.apiKeyId,
            name: req.publicApi.apiKeyName,
            prefix: req.publicApi.apiKeyPrefix,
            scopes: req.publicApi.scopes
        }
    });
}

export async function listEmployees(req: Request, res: Response): Promise<void> {
    if (!req.publicApi) {
        sendPublicApiError(res, 401, 'unauthorized', 'Invalid or missing API key.');
        return;
    }

    const limit = parseBoundedLimit(req.query.limit);
    const employees = await prisma.employee.findMany({
        where: {
            tenantId: req.publicApi.tenantId,
            role: { not: 'ARCHIVED' }
        },
        select: {
            id: true,
            name: true,
            role: true,
            language: true,
            workProfile: true,
            phoneNumber: true,
            hasCompletedOnboarding: true,
            isOptedOut: true,
            createdAt: true,
            updatedAt: true,
            site: {
                select: {
                    id: true,
                    name: true,
                    country: true,
                    gpsMode: true
                }
            }
        },
        orderBy: [
            { role: 'asc' },
            { name: 'asc' }
        ],
        take: limit
    });

    sendPublicApiData(res, {
        employees: employees.map(employee => ({
            id: employee.id,
            name: employee.name,
            role: employee.role,
            language: employee.language,
            workProfile: employee.workProfile,
            phoneLast4: maskPhoneLast4(employee.phoneNumber),
            hasCompletedOnboarding: employee.hasCompletedOnboarding,
            isOptedOut: employee.isOptedOut,
            site: employee.site,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt
        })),
        pagination: {
            limit,
            returned: employees.length
        }
    });
}

export async function getAttendanceSummary(req: Request, res: Response): Promise<void> {
    if (!req.publicApi) {
        sendPublicApiError(res, 401, 'unauthorized', 'Invalid or missing API key.');
        return;
    }

    const to = parseDateQuery(req.query.to) ?? new Date();
    const from = parseDateQuery(req.query.from) ?? new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);
    const rangeMs = to.getTime() - from.getTime();

    if (rangeMs < 0) {
        sendPublicApiError(res, 400, 'invalid_date_range', 'from must be before to.');
        return;
    }

    if (rangeMs > 31 * 24 * 60 * 60 * 1000) {
        sendPublicApiError(res, 400, 'date_range_too_large', 'Attendance summary range is limited to 31 days.');
        return;
    }

    const records = await prisma.attendance.findMany({
        where: {
            tenantId: req.publicApi.tenantId,
            checkIn: {
                gte: from,
                lte: to
            }
        },
        select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
            gpsVerdict: true,
            locationWarning: true,
            employee: {
                select: {
                    id: true,
                    name: true,
                    site: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        },
        orderBy: { checkIn: 'desc' },
        take: 500
    });

    const totals = {
        records: records.length,
        present: 0,
        late: 0,
        absent: 0,
        openSessions: 0,
        gpsWarnings: 0
    };
    const daily = new Map<string, typeof totals>();

    for (const record of records) {
        const status = record.status.toUpperCase();
        totals.present += status === 'PRESENT' ? 1 : 0;
        totals.late += status === 'LATE' ? 1 : 0;
        totals.absent += status === 'ABSENT' ? 1 : 0;
        totals.openSessions += record.checkOut ? 0 : 1;
        totals.gpsWarnings += record.locationWarning || record.gpsVerdict === 'WARNING' ? 1 : 0;

        const key = formatDateKey(record.checkIn);
        const day = daily.get(key) ?? {
            records: 0,
            present: 0,
            late: 0,
            absent: 0,
            openSessions: 0,
            gpsWarnings: 0
        };
        day.records += 1;
        day.present += status === 'PRESENT' ? 1 : 0;
        day.late += status === 'LATE' ? 1 : 0;
        day.absent += status === 'ABSENT' ? 1 : 0;
        day.openSessions += record.checkOut ? 0 : 1;
        day.gpsWarnings += record.locationWarning || record.gpsVerdict === 'WARNING' ? 1 : 0;
        daily.set(key, day);
    }

    sendPublicApiData(res, {
        range: {
            from: from.toISOString(),
            to: to.toISOString()
        },
        totals,
        daily: Array.from(daily.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, counts]) => ({ date, ...counts })),
        recentRecords: records.slice(0, 25).map(record => ({
            id: record.id,
            employee: {
                id: record.employee.id,
                name: record.employee.name
            },
            site: record.employee.site,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            status: record.status,
            gpsVerdict: record.gpsVerdict,
            hasLocationWarning: record.locationWarning
        }))
    });
}

export async function sendMessageToEmployee(req: Request, res: Response): Promise<void> {
    await runWithPublicApiIdempotency(req, res, async () => {
        if (!req.publicApi) {
            const body = publicApiEnvelope(res, {
                error: {
                    code: 'unauthorized',
                    message: 'Invalid or missing API key.'
                }
            });
            return { statusCode: 401, body };
        }

        const {
            employeeId,
            phoneNumber,
            message,
            templateName,
            templateLanguage,
            templateVars,
            templateComponents
        } = req.body ?? {};

        if (!employeeId && !phoneNumber) {
            const body = {
                error: {
                    code: 'recipient_required',
                    message: 'employeeId or phoneNumber is required.',
                    requestId: res.locals.publicApiRequestId
                }
            };
            res.locals.publicApiErrorCode = 'recipient_required';
            return { statusCode: 400, body };
        }

        if (!message && !templateName) {
            const body = {
                error: {
                    code: 'message_required',
                    message: 'message or templateName is required.',
                    requestId: res.locals.publicApiRequestId
                }
            };
            res.locals.publicApiErrorCode = 'message_required';
            return { statusCode: 400, body };
        }

        const formattedPhone = normalizePhoneNumber(phoneNumber);
        const employee = await prisma.employee.findFirst({
            where: {
                tenantId: req.publicApi.tenantId,
                role: { not: 'ARCHIVED' },
                ...(employeeId
                    ? { id: String(employeeId) }
                    : {
                        OR: [
                            { phoneNumber: formattedPhone || '' },
                            { phoneNumber: formattedPhone ? `+${formattedPhone}` : '' },
                            { phoneNumber: formattedPhone ? { endsWith: formattedPhone.slice(-9) } : '' }
                        ]
                    })
            },
            select: {
                id: true,
                name: true,
                phoneNumber: true
            }
        });

        if (!employee) {
            const body = {
                error: {
                    code: 'recipient_not_found',
                    message: 'Recipient not found.',
                    requestId: res.locals.publicApiRequestId
                }
            };
            res.locals.publicApiErrorCode = 'recipient_not_found';
            return { statusCode: 404, body };
        }

        const recipientPhone = normalizePhoneNumber(employee.phoneNumber);
        if (!recipientPhone) {
            const body = {
                error: {
                    code: 'recipient_phone_invalid',
                    message: 'Recipient phone number is not usable.',
                    requestId: res.locals.publicApiRequestId
                }
            };
            res.locals.publicApiErrorCode = 'recipient_phone_invalid';
            return { statusCode: 422, body };
        }

        const channel = await resolveOutgoingWhatsAppChannel(req.publicApi.tenantId, 'EMPLOYEE_NOTIFICATION');

        if (templateName) {
            const components: WhatsAppTemplateComponent[] = Array.isArray(templateComponents)
                ? templateComponents
                : Array.isArray(templateVars) && templateVars.length > 0
                    ? [{
                        type: 'body',
                        parameters: templateVars.map((value: unknown) => ({
                            type: 'text',
                            text: String(value)
                        }))
                    }]
                    : [];

            await sendTemplateMessage(
                recipientPhone,
                String(templateName),
                typeof templateLanguage === 'string' ? templateLanguage : 'fr',
                components,
                channel.config
            );
        } else {
            await sendMessage(recipientPhone, String(message), channel.config);
        }

        const body = publicApiEnvelope(res, {
            status: 'accepted',
            recipient: {
                employeeId: employee.id
            },
            channel: {
                intent: channel.intent,
                type: channel.type
            }
        });

        return { statusCode: 202, body };
    });
}
