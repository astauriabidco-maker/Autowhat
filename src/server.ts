import { Job } from 'bullmq';
import app from './app';
import { initLateArrivalJob } from './jobs/lateArrivalJob';
import { initReminderJobs } from './jobs/reminderJobs';
import { initOnboardingConversionJobs } from './jobs/onboardingConversionJobs';
import { initRetentionJob } from './modules/privacy/retentionJob';
import { initRecurringInterventionsJob } from './cron/recurringInterventions';
import { startNightlyWorker } from './cron/nightlyWorker';
import { startWebhookQueueWorker } from './cron/webhookQueueWorker';
import { startWhatsAppPoolHealthWorker } from './cron/whatsappPoolHealth';
import { initializeQueue, closeQueue, WhatsAppJob } from './services/queueService';
import { closeRedisConnection, isRedisEnabled } from './services/redisConnection';
import { areLegacyOperationsEnabled } from './middlewares/legacyOperationsMiddleware';
import {
    sendRawMessage,
    sendRawInteractiveList,
    sendRawInteractiveButtons,
    sendRawDocument,
    sendRawTemplateMessage
} from './services/whatsappService';

const PORT = process.env.PORT || 3000;

function shouldStartJobs() {
    return process.env.NODE_ENV !== 'test' && process.env.ENABLE_JOBS !== 'false';
}

function startJobs() {
    if (!shouldStartJobs()) {
        console.log('⏸️ Jobs disabled');
        return;
    }

    // Initialisation des Jobs (Cron)
    initLateArrivalJob();
    initReminderJobs();
    initOnboardingConversionJobs();
    initRetentionJob(); // Privacy Suite - purge automatique RGPD
    if (areLegacyOperationsEnabled()) {
        initRecurringInterventionsJob(); // Legacy operations - recurring interventions
    } else {
        console.log('⏸️ Legacy operations jobs disabled');
    }
    startNightlyWorker(); // AI Agent Proactive Alerts & Hub RGPD Purge
    startWebhookQueueWorker(); // Webhook Delivery Retry Queue (Phase 3)
    startWhatsAppPoolHealthWorker(); // SuperAdmin WhatsApp pool health alerts

    // Initialize WhatsApp Queue (if Redis is enabled)
    if (isRedisEnabled()) {
        console.log('🚀 Initializing WhatsApp queue worker...');

        const processWhatsAppJob = async (job: Job<WhatsAppJob>) => {
            const { type, to, payload, config } = job.data;

            let result;
            switch (type) {
                case 'text':
                    result = await sendRawMessage(to, payload.text, config);
                    break;
                case 'interactive_list':
                    result = await sendRawInteractiveList(
                        to,
                        payload.bodyText,
                        payload.buttonText,
                        payload.sections,
                        config
                    );
                    break;
                case 'interactive_buttons':
                    result = await sendRawInteractiveButtons(
                        to,
                        payload.bodyText,
                        payload.buttons,
                        config
                    );
                    break;
                case 'document':
                    result = await sendRawDocument(
                        to,
                        payload.documentUrl,
                        payload.filename,
                        payload.caption,
                        config
                    );
                    break;
                case 'template':
                    result = await sendRawTemplateMessage(
                        to,
                        payload.templateName,
                        payload.languageCode,
                        payload.components,
                        config
                    );
                    break;
                default:
                    console.error(`Unknown job type: ${type}`);
                    return;
            }

            // Any Meta send failure must be visible in queue monitoring.
            if (!result.success) {
                throw new Error(result.error || 'WhatsApp send failed');
            }
        };

        initializeQueue(processWhatsAppJob);
    }
}

async function shutdown(signal: string) {
    console.log(`🛑 ${signal} received, shutting down gracefully...`);
    await closeQueue();
    await closeRedisConnection();
    process.exit(0);
}

startJobs();

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Redis: ${isRedisEnabled() ? 'Enabled' : 'Disabled (direct sends)'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
