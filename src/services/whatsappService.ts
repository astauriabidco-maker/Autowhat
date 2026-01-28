import axios from 'axios';

/**
 * Sends a WhatsApp message via the Meta Graph API.
 * @param to Recipient's phone number as a string (E.164, no '+' usually required by API but we'll see).
 * @param text The message body text.
 * @param phoneNumberId Optional phone ID to send from (uses env default if not provided).
 */
export const sendMessage = async (to: string, text: string, phoneNumberId?: string) => {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.error('❌ Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID in .env');
        return;
    }

    console.log(`🔧 DEBUG - Sending from phoneId: ${phoneId} (param: ${phoneNumberId}, env: ${process.env.WHATSAPP_PHONE_ID})`);

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

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
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`✅ Message sent to ${to}`);
    } catch (error: any) {
        console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    }
};

/**
 * Sends a WhatsApp interactive list message (native menu).
 * @param to Recipient's phone number
 * @param bodyText The body text displayed above the list
 * @param buttonText The text shown on the button that opens the list
 * @param sections Array of sections with rows (items)
 * @param phoneNumberId Optional phone ID to send from
 */
export const sendInteractiveList = async (
    to: string,
    bodyText: string,
    buttonText: string,
    sections: any[],
    phoneNumberId?: string
) => {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.error('❌ Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID in .env');
        return;
    }

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

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
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(`✅ Interactive list sent to ${to}`);
    } catch (error: any) {
        console.error('❌ Error sending WhatsApp interactive list:', error.response?.data || error.message);
    }
};

/**
 * Sends a WhatsApp interactive button message (up to 3 buttons).
 * @param to Recipient's phone number
 * @param bodyText The body text displayed above the buttons
 * @param buttons Array of buttons (max 3) with id and title
 * @param phoneNumberId Optional phone ID to send from
 */
export const sendInteractiveButtons = async (
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    phoneNumberId?: string
) => {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.error('❌ Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID in .env');
        return;
    }

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

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
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(`✅ Interactive buttons sent to ${to}`);
    } catch (error: any) {
        console.error('❌ Error sending WhatsApp interactive buttons:', error.response?.data || error.message);
    }
};

/**
 * Sends a document (PDF, etc.) via WhatsApp.
 * Note: WhatsApp requires the document to be accessible via public URL or pre-uploaded media ID.
 * For local files, we need to use a public URL (via ngrok or similar).
 * @param to Recipient's phone number
 * @param documentUrl Public URL of the document
 * @param filename Display filename
 * @param caption Optional caption
 * @param phoneNumberId Optional phone ID to send from
 */
export const sendDocument = async (
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
    phoneNumberId?: string
) => {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.error('❌ Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID in .env');
        return;
    }

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

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
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(`✅ Document "${filename}" sent to ${to}`);
    } catch (error: any) {
        console.error('❌ Error sending WhatsApp document:', error.response?.data || error.message);
    }
};
