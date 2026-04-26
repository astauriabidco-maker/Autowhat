import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import path from 'path';

dotenv.config();

// Validate encryption key at startup
import { validateEncryptionKey } from './utils/crypto';
validateEncryptionKey();

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Stripe webhook MUST be registered BEFORE body-parser
// because it needs the raw body for signature verification
import * as webhookStripe from './controllers/webhookStripe';
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookStripe.handleWebhook);

// Middleware de base
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swagger API Documentation
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'AutoWhats API Documentation'
}));
// Serve OpenAPI JSON spec
app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Static file serving for uploaded photos
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health Check (Pour vérifier que le serveur tourne)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        message: 'WhatsPoint API is running'
    });
});

import router from './routes/index';
import { initLateArrivalJob } from './jobs/lateArrivalJob';
import { initReminderJobs } from './jobs/reminderJobs';
import { initRetentionJob } from './modules/privacy/retentionJob';
import { initRecurringInterventionsJob } from './cron/recurringInterventions';
import { startNightlyWorker } from './cron/nightlyWorker';
import { startWebhookQueueWorker } from './cron/webhookQueueWorker';
import { initializeQueue, closeQueue } from './services/queueService';
import { closeRedisConnection, isRedisEnabled } from './services/redisConnection';
import {
    sendRawMessage,
    sendRawInteractiveList,
    sendRawInteractiveButtons,
    sendRawDocument
} from './services/whatsappService';
import { Job } from 'bullmq';
import { WhatsAppJob } from './services/queueService';

// API Routes
app.use(router);

// ------------------------------------------------------------------
// SOLOPRENEUR OPTIMIZATION: ONE-CONTAINER DEPLOYMENT
// Serve the built React App directly via Express in Production
// ------------------------------------------------------------------
if (process.env.NODE_ENV === 'production' || process.env.SERVE_FRONTEND === 'true') {
    console.log('📦 Serving compiled Frontend from client/dist');
    app.use(express.static(path.join(process.cwd(), 'client/dist')));
    
    // Fallback for React Router (don't override /api)
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.sendFile(path.join(process.cwd(), 'client/dist/index.html'));
    });
}


// Initialisation des Jobs (Cron)
initLateArrivalJob();
initReminderJobs();
initRetentionJob(); // Privacy Suite - purge automatique RGPD
initRecurringInterventionsJob(); // Opérations - auto-génération des interventions récurrentes
startNightlyWorker(); // 🌙 AI Agent Proactive Alerts & Hub RGPD Purge
startWebhookQueueWorker(); // 🔄 Webhook Delivery Retry Queue (Phase 3)

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
            default:
                console.error(`Unknown job type: ${type}`);
                return;
        }

        // If rate limited (429), throw to trigger retry
        if (!result.success && result.statusCode === 429) {
            throw new Error('Rate limited by Meta API');
        }
    };

    initializeQueue(processWhatsAppJob);
}

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Redis: ${isRedisEnabled() ? 'Enabled' : 'Disabled (direct sends)'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    await closeQueue();
    await closeRedisConnection();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    await closeQueue();
    await closeRedisConnection();
    process.exit(0);
});
