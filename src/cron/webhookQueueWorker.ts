import cron from 'node-cron';
import { processWebhookQueue } from '../services/webhookService';

export const startWebhookQueueWorker = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            await processWebhookQueue();
        } catch (error) {
            console.error('❌ [Cron] Error running webhook queue worker:', error);
        }
    });

    console.log('🔄 Webhook Queue Worker initialized (runs every minute).');
};
