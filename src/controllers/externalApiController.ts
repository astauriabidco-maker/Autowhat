import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendMessage } from '../services/whatsappService';

const prisma = new PrismaClient();

/**
 * Middleware or inline auth helper for External API Keys
 */
async function authenticateExternalApi(req: Request): Promise<string | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const apiKey = authHeader.split(' ')[1];

    // Find the tenant that has this API key in its config
    // In production, an indexed field or separate ApiKey table is better.
    // For this architecture, we filter through active tenants.
    // Given the scale, this is acceptable, but could be cached.
    
    // As Prisma can't easily query inside unstructured JSON across rows efficiently 
    // without raw SQL on JSONB, we'll do a simple raw query or fetch and filter.
    // Using raw SQL for PostgreSQL JSONB:
    try {
        const tenants: any[] = await prisma.$queryRaw`
            SELECT id FROM "Tenant" 
            WHERE config->>'inboundApiKey' = ${apiKey}
            AND status = 'ACTIVE'
            LIMIT 1
        `;

        if (tenants && tenants.length > 0) {
            return tenants[0].id;
        }
    } catch (e) {
        console.error("External Auth Error:", e);
    }
    
    return null;
}

/**
 * POST /api/external/notify
 * Payload: { phoneNumber: string, message: string, templateName?: string, templateVars?: string[] }
 */
export const sendNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('🔔 [External API] Received notification request');
        
        const tenantId = await authenticateExternalApi(req);
        
        if (!tenantId) {
            res.status(401).json({ success: false, error: 'Unauthorized or invalid API Key' });
            return;
        }

        const { phoneNumber, message, templateName, templateVars } = req.body;

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
            console.log(`⚠️ [External API] Employee not found for phone: ${formattedPhone}`);
            res.status(404).json({ success: false, error: 'Employee not found in this organization' });
            return;
        }

        // 2. Identify the WhatsApp Sender Number (Platform or Custom BYON)
        // Fallback to a default if multi-tenant pool is used
        let senderPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        // Try to get BYON config if it exists
        const waConfig = await prisma.whatsAppConfig.findUnique({
            where: { tenantId }
        });
        
        if (waConfig && waConfig.isActive) {
            senderPhoneNumberId = waConfig.phoneNumberId;
        }

        // 3. Send the message
        if (templateName) {
            // Note: Sending template requires specific Meta API structure.
            // Assuming whatsappService has a sendTemplate function (or we implement it here).
            // For now, if template logic isn't fully implemented in whatsappService, we fallback to text
            // or mock the template send.
            console.log(`✉️ Sending Template [${templateName}] to ${formattedPhone}`);
            
            // To be replaced by actual sendTemplate(formattedPhone, templateName, templateVars, senderPhoneNumberId)
            await sendMessage(
                formattedPhone, 
                `[Template: ${templateName}]\n${message || 'Nouvelle notification'}`, 
                senderPhoneNumberId
            );
        } else {
            // Send free text
            console.log(`✉️ Sending Free Text to ${formattedPhone}`);
            await sendMessage(formattedPhone, message, senderPhoneNumberId);
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
