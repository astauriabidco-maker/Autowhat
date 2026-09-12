import cron from 'node-cron';
import { runWhatsAppPoolHealthAlert } from '../services/whatsappPoolHealthAlertService';

const DEFAULT_SCHEDULE = '*/30 * * * *';

export function startWhatsAppPoolHealthWorker() {
    const schedule = process.env.WHATSAPP_POOL_HEALTH_CRON || DEFAULT_SCHEDULE;

    console.log(`[WhatsApp Pool Health] Cron scheduled: ${schedule}`);

    cron.schedule(schedule, async () => {
        try {
            const result = await runWhatsAppPoolHealthAlert();
            if (result.alertsDetected > 0) {
                console.warn('[WhatsApp Pool Health] Alert run completed:', result);
            }
        } catch (error) {
            console.error('[WhatsApp Pool Health] Alert run failed:', error);
        }
    });
}
