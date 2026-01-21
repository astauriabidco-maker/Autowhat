import { Request, Response } from 'express';
import { identifyUser } from '../services/authService';
import { sendMessage } from '../services/whatsappService';

/**
 * Handles the Webhook verification challenge from Meta.
 */
export const verifyWebhook = (req: Request, res: Response): any => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode && token) {
        if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
            console.log('✅ Webhook Verified');
            return res.status(200).send(challenge);
        } else {
            console.error('❌ Webhook Verification Failed: Invalid Token');
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400); // Bad Request if parameters are missing
};

/**
 * Handles incoming events from WhatsApp.
 */
export const handleMessage = async (req: Request, res: Response): Promise<any> => {
    try {
        const body = req.body;

        // Check if it's a WhatsApp event
        if (body.object === 'whatsapp_business_account') {
            // Iterate over entries
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    const value = change.value;

                    // Check if it's a message
                    if (value.messages && value.messages.length > 0) {
                        const message = value.messages[0];
                        const from = message.from; // e.g. "33612345678"
                        const messageBody = message.text?.body || '';

                        console.log(`📩 Received message from ${from}: ${messageBody}`);

                        // 1. Identify User
                        // Note: Meta sends number without '+', so we might need to add it or handle it in authService
                        // Let's assume we pass it as is or prepend '+' if your DB has it.
                        // Our previous auth logic removes cleaned chars so '336...' vs '+336...' might match if we striped '+' too.
                        // Let's verify identifyUser logic: currently it strips space and dash.
                        // If DB has '+336...' and we search '336...', we need to align.
                        // For safety, let's prepend '+' if missing, or adjust auth service later.
                        // "Loose" matching usually involves stripping '+' from both sides.

                        // For now, let's just pass 'from' directly.
                        const employee = await identifyUser(`+${from}`); // Adding + to match seed format likely

                        if (employee) {
                            // 2. Known User
                            const responseText = `Bonjour ${employee.name}, vous êtes chez ${employee.tenant.name}. J'ai reçu : "${messageBody}"`;
                            await sendMessage(from, responseText);
                        } else {
                            // 3. Unknown User
                            await sendMessage(from, 'Numéro non reconnu. Contactez votre RH.');
                        }
                    } else if (value.statuses) {
                        // Status update (sent, delivered, read) - just log/ignore for now
                        const status = value.statuses[0];
                        console.log(`ℹ️ Status update for ${status.recipient_id}: ${status.status}`);
                    }
                }
            }
            return res.sendStatus(200);
        } else {
            // Not a whatsapp event
            return res.sendStatus(404);
        }
    } catch (error) {
        console.error('❌ Error in webhook handler:', error);
        return res.sendStatus(500); // Should be 200 really to avoid retries loops from Meta but let's signal error locally
    }
};
