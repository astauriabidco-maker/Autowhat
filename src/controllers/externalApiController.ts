import { Request, Response } from 'express';
import { sendMessage, sendTemplateMessage, WhatsAppTemplateComponent } from '../services/whatsappService';
import prisma from '../lib/prisma';
import { resolveOutgoingWhatsAppChannel } from '../services/whatsappConfigService';
import { resolveTenantIdFromLegacyOrPublicApiKey } from '../services/publicApiKeyService';
import { hashLogIdentifier } from '../utils/safeWebhookLogger';


/**
 * Middleware or inline auth helper for External API Keys
 */
async function authenticateExternalApi(req: Request): Promise<string | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const apiKey = authHeader.split(' ')[1];

    return resolveTenantIdFromLegacyOrPublicApiKey(apiKey, 'messages:send');
}

/**
 * POST /api/external/notify
 * Payload: {
 *   phoneNumber: string,
 *   message?: string,
 *   templateName?: string,
 *   templateLanguage?: string,
 *   templateVars?: string[],
 *   templateComponents?: WhatsAppTemplateComponent[]
 * }
 */
export const sendNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('🔔 [External API] Received notification request');
        res.setHeader('Deprecation', 'true');
        res.setHeader('Link', '</api/v1/messages>; rel="successor-version"');
        
        const tenantId = await authenticateExternalApi(req);
        
        if (!tenantId) {
            res.status(401).json({ success: false, error: 'Unauthorized or invalid API Key' });
            return;
        }

        const { phoneNumber, message, templateName, templateLanguage, templateVars, templateComponents } = req.body;

        if (!phoneNumber) {
            res.status(400).json({ success: false, error: 'phoneNumber is required' });
            return;
        }

        if (!message && !templateName) {
            res.status(400).json({ success: false, error: 'Either message or templateName is required' });
            return;
        }

        // Clean phone number (remove +, spaces, leading 0 if needed)
        // Meta requires international format without + (e.g., 33612345678)
        let formattedPhone = phoneNumber.replace(/\D/g, '');
        if (formattedPhone.startsWith('0')) {
            // Very naive FR normalization, assumes FR if starts with 0
            formattedPhone = '33' + formattedPhone.substring(1);
        }

        // 1. Verify the employee belongs to this tenant
        // We match loosely since formats can vary (with or without +, etc.)
        const employee = await prisma.employee.findFirst({
            where: {
                tenantId: tenantId,
                role: { not: 'ARCHIVED' },
                OR: [
                    { phoneNumber: formattedPhone },
                    { phoneNumber: `+${formattedPhone}` },
                    { phoneNumber: { endsWith: formattedPhone.slice(-9) } }
                ]
            }
        });

        if (!employee) {
            console.log('⚠️ [External API] Employee not found', {
                phoneHash: hashLogIdentifier(formattedPhone)
            });
            res.status(404).json({ success: false, error: 'Employee not found in this organization' });
            return;
        }

        // 2. Identify WhatsApp credentials (BYON, assigned pool number, or default).
        const senderCredentials = (await resolveOutgoingWhatsAppChannel(tenantId, 'GENERAL')).config;

        // 3. Send the message
        if (templateName) {
            console.log('✉️ Sending External API template notification', {
                templateName,
                phoneHash: hashLogIdentifier(formattedPhone)
            });

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
                formattedPhone,
                templateName,
                templateLanguage || 'fr',
                components,
                senderCredentials
            );
        } else {
            // Send free text
            console.log('✉️ Sending External API text notification', {
                phoneHash: hashLogIdentifier(formattedPhone)
            });
            await sendMessage(formattedPhone, message, senderCredentials);
        }

        res.status(200).json({ 
            success: true, 
            message: 'Notification sent successfully',
            recipient: employee.name 
        });

    } catch (error: any) {
        console.error('❌ [External API] Error sending notification:', error.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
