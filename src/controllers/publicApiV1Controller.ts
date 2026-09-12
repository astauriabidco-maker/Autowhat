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
