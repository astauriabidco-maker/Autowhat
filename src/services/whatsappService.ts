/**
 * WhatsApp Service
 * Sends messages via Meta Graph API with BYON (Bring Your Own Number) support.
 * 
 * Architecture (with Queue):
 * - Public functions: Check blacklist/opt-out, then add to queue
 * - Raw functions: Actually send via Meta API (called by queue worker)
 * 
 * All functions accept an optional config parameter:
 * - If provided: Uses the tenant's own credentials (BYON/Enterprise)
 * - If not provided: Falls back to system default credentials (shared number)
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { WhatsAppCredentials, getDefaultConfig } from './whatsappConfigService';
import { addToQueue, WhatsAppJob } from './queueService';
import { isRedisEnabled } from './redisConnection';

const prisma = new PrismaClient();

// Type for backward compatibility: accepts either config object or legacy phoneNumberId string
export type ConfigOrPhoneId = WhatsAppCredentials | string | undefined;

// Helper to get credentials (handles both new config object and legacy string phoneNumberId)
function resolveCredentials(configOrPhoneId?: ConfigOrPhoneId): WhatsAppCredentials {
    // If it's a WhatsAppCredentials object
    if (configOrPhoneId && typeof configOrPhoneId === 'object') {
        return configOrPhoneId;
    }

    // If it's a legacy string phoneNumberId, use it with default token
    if (typeof configOrPhoneId === 'string') {
        const defaultConfig = getDefaultConfig();
        return {
            phoneNumberId: configOrPhoneId,
            accessToken: defaultConfig.accessToken
        };
    }

    // No config provided - use defaults
    return getDefaultConfig();
}

// ============================================================================
// BLACKLIST / OPT-OUT CHECK
// ============================================================================

/**
 * Check if a phone number is opted out (blacklisted)
 * Returns true if the recipient should NOT receive messages
 */
async function isBlacklisted(phoneNumber: string): Promise<boolean> {
    try {
        // Clean phone number (remove + if present)
        const cleanNumber = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : phoneNumber;

        // Check if any employee with this phone has opted out
        const employee = await prisma.employee.findFirst({
            where: {
                phoneNumber: {
                    contains: cleanNumber
                },
                isOptedOut: true
            }
        });

        if (employee) {
            console.log(`🚫 Message blocked: ${phoneNumber} has opted out`);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error checking blacklist:', error);
        return false; // On error, allow message (fail-open)
    }
}

// ============================================================================
// RAW SEND FUNCTIONS (Internal - Used by Queue Worker)
// ============================================================================

/**
 * INTERNAL: Sends a WhatsApp message directly via the Meta Graph API.
 * Called by the queue worker. Do not call directly from application code.
 */
export const sendRawMessage = async (
    to: string,
    text: string,
    config?: ConfigOrPhoneId
): Promise<{ success: boolean; error?: string; statusCode?: number }> => {
    const { phoneNumberId, accessToken } = resolveCredentials(config);

    if (!accessToken || !phoneNumberId) {
        console.error('❌ Missing WhatsApp credentials');
        return { success: false, error: 'Missing credentials' };
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    try {
        await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text },
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`✅ Message sent to ${to}`);
        return { success: true };
    } catch (error: any) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('❌ Error sending WhatsApp message:', errorMessage);

        // Return status code for rate limit detection
        return { success: false, error: errorMessage, statusCode };
    }
};

/**
 * INTERNAL: Sends a WhatsApp interactive list message directly.
 */
export const sendRawInteractiveList = async (
    to: string,
    bodyText: string,
    buttonText: string,
    sections: any[],
    config?: ConfigOrPhoneId
): Promise<{ success: boolean; error?: string; statusCode?: number }> => {
    const { phoneNumberId, accessToken } = resolveCredentials(config);

    if (!accessToken || !phoneNumberId) {
        console.error('❌ Missing WhatsApp credentials');
        return { success: false, error: 'Missing credentials' };
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    try {
        await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: { text: bodyText },
                    action: {
                        button: buttonText,
                        sections: sections
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(`✅ Interactive list sent to ${to}`);
        return { success: true };
    } catch (error: any) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('❌ Error sending WhatsApp interactive list:', errorMessage);
        return { success: false, error: errorMessage, statusCode };
    }
};

/**
 * INTERNAL: Sends a WhatsApp interactive button message directly.
 */
export const sendRawInteractiveButtons = async (
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    config?: ConfigOrPhoneId
): Promise<{ success: boolean; error?: string; statusCode?: number }> => {
    const { phoneNumberId, accessToken } = resolveCredentials(config);

    if (!accessToken || !phoneNumberId) {
        console.error('❌ Missing WhatsApp credentials');
        return { success: false, error: 'Missing credentials' };
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    // Format buttons for WhatsApp API
    const formattedButtons = buttons.slice(0, 3).map(btn => ({
        type: 'reply',
        reply: {
            id: btn.id,
            title: btn.title
        }
    }));

    try {
        await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: bodyText },
                    action: {
                        buttons: formattedButtons
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(`✅ Interactive buttons sent to ${to}`);
        return { success: true };
    } catch (error: any) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('❌ Error sending WhatsApp interactive buttons:', errorMessage);
        return { success: false, error: errorMessage, statusCode };
    }
};

/**
 * INTERNAL: Sends a document via WhatsApp directly.
 */
export const sendRawDocument = async (
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
    config?: ConfigOrPhoneId
): Promise<{ success: boolean; error?: string; statusCode?: number }> => {
    const { phoneNumberId, accessToken } = resolveCredentials(config);

    if (!accessToken || !phoneNumberId) {
        console.error('❌ Missing WhatsApp credentials');
        return { success: false, error: 'Missing credentials' };
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    try {
        await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'document',
                document: {
                    link: documentUrl,
                    filename: filename,
                    caption: caption || `📄 ${filename}`
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(`✅ Document "${filename}" sent to ${to}`);
        return { success: true };
    } catch (error: any) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('❌ Error sending WhatsApp document:', errorMessage);
        return { success: false, error: errorMessage, statusCode };
    }
};

// ============================================================================
// PUBLIC SEND FUNCTIONS (App-facing - Uses Queue)
// ============================================================================

/**
 * Sends a WhatsApp message via the queue (rate-limited).
 * Checks opt-out status before queueing.
 * @param to Recipient's phone number as a string (E.164 format without '+')
 * @param text The message body text.
 * @param config Optional WhatsApp credentials for BYON
 */
export const sendMessage = async (
    to: string,
    text: string,
    config?: ConfigOrPhoneId
) => {
    // Check blacklist first
    if (await isBlacklisted(to)) {
        return; // Silently drop
    }

    // If queue is disabled, send directly
    if (!isRedisEnabled()) {
        await sendRawMessage(to, text, config);
        return;
    }

    // Add to queue
    const job: WhatsAppJob = {
        type: 'text',
        to,
        payload: { text },
        config: resolveCredentials(config)
    };

    await addToQueue(job);
};

/**
 * Sends a WhatsApp interactive list message via the queue.
 */
export const sendInteractiveList = async (
    to: string,
    bodyText: string,
    buttonText: string,
    sections: any[],
    config?: ConfigOrPhoneId
) => {
    // Check blacklist first
    if (await isBlacklisted(to)) {
        return;
    }

    if (!isRedisEnabled()) {
        await sendRawInteractiveList(to, bodyText, buttonText, sections, config);
        return;
    }

    const job: WhatsAppJob = {
        type: 'interactive_list',
        to,
        payload: { bodyText, buttonText, sections },
        config: resolveCredentials(config)
    };

    await addToQueue(job);
};

/**
 * Sends a WhatsApp interactive button message via the queue.
 */
export const sendInteractiveButtons = async (
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    config?: ConfigOrPhoneId
) => {
    // Check blacklist first
    if (await isBlacklisted(to)) {
        return;
    }

    if (!isRedisEnabled()) {
        await sendRawInteractiveButtons(to, bodyText, buttons, config);
        return;
    }

    const job: WhatsAppJob = {
        type: 'interactive_buttons',
        to,
        payload: { bodyText, buttons },
        config: resolveCredentials(config)
    };

    await addToQueue(job);
};

/**
 * Sends a document via WhatsApp through the queue.
 */
export const sendDocument = async (
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
    config?: ConfigOrPhoneId
) => {
    // Check blacklist first
    if (await isBlacklisted(to)) {
        return;
    }

    if (!isRedisEnabled()) {
        await sendRawDocument(to, documentUrl, filename, caption, config);
        return;
    }

    const job: WhatsAppJob = {
        type: 'document',
        to,
        payload: { documentUrl, filename, caption },
        config: resolveCredentials(config)
    };

    await addToQueue(job);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Test WhatsApp connection by sending a test message.
 * Used to verify BYON credentials are valid.
 * Note: This bypasses the queue for immediate feedback.
 */
export const testConnection = async (
    to: string,
    credentials: WhatsAppCredentials
): Promise<{ success: boolean; error?: string }> => {
    const { phoneNumberId, accessToken, displayName } = credentials;

    if (!accessToken || !phoneNumberId) {
        return { success: false, error: 'Credentials manquantes' };
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
    const testMessage = `✅ Test de connexion réussi !\n\n📱 Votre numéro WhatsApp marque blanche "${displayName || 'BYON'}" est correctement configuré.`;

    try {
        await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: testMessage },
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return { success: true };
    } catch (error: any) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('❌ WhatsApp connection test failed:', errorMessage);
        return { success: false, error: errorMessage };
    }
};
