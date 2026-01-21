import axios from 'axios';

/**
 * Sends a WhatsApp message via the Meta Graph API.
 * @param to Recipient's phone number as a string (E.164, no '+' usually required by API but we'll see).
 * @param text The message body text.
 */
export const sendMessage = async (to: string, text: string) => {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

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
