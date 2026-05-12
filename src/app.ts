import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import fs from 'fs';
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
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production')) {
            callback(null, true);
            return;
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Swagger API Documentation
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'AutoWhats API Documentation'
    }));
    // Serve OpenAPI JSON spec
    app.get('/api/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
}

// Uploaded media is served through short-lived signed URLs under /api/files.
app.use('/uploads', (_req, res) => {
    res.status(403).json({ error: 'Direct upload access is forbidden' });
});

// Health Check (Pour vérifier que le serveur tourne)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        message: 'WhatsPoint API is running'
    });
});

app.get('/api/frontend-diagnostics', (_req, res) => {
    const distPath = path.join(process.cwd(), 'client/dist');
    const indexPath = path.join(distPath, 'index.html');
    const commit = process.env.COOLIFY_GIT_COMMIT_SHA
        || process.env.SOURCE_COMMIT
        || process.env.GIT_COMMIT
        || process.env.COMMIT_SHA
        || 'unknown';

    let indexHtml = '';
    let assets: string[] = [];

    try {
        indexHtml = fs.readFileSync(indexPath, 'utf8');
    } catch {
        indexHtml = '';
    }

    try {
        assets = fs.readdirSync(path.join(distPath, 'assets'));
    } catch {
        assets = [];
    }

    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.status(200).json({
        status: 'online',
        commit,
        nodeEnv: process.env.NODE_ENV || 'development',
        serveFrontend: process.env.SERVE_FRONTEND || null,
        distPath,
        indexExists: Boolean(indexHtml),
        scripts: [...indexHtml.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1]),
        stylesheets: [...indexHtml.matchAll(/href="([^"]+\.css)"/g)].map(match => match[1]),
        assets
    });
});

app.get('/api/frontend-reset', (_req, res) => {
    res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.send(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WhatsPoint - Nettoyage</title>
  </head>
  <body style="min-height:100vh;display:grid;place-items:center;margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <main style="width:min(100% - 32px,560px);padding:28px;border:1px solid #dbe4f0;border-radius:12px;background:white;box-shadow:0 18px 45px rgba(15,23,42,.08)">
      <p style="margin:0 0 8px;color:#2563eb;font-weight:700">WhatsPoint</p>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15">Nettoyage du cache en cours...</h1>
      <p id="status" style="margin:0 0 22px;color:#475569;line-height:1.6">Suppression de l'ancien service worker et des caches navigateur.</p>
      <button id="go" style="border:0;border-radius:8px;padding:12px 16px;background:#2563eb;color:#fff;cursor:pointer;font-weight:700">Retourner a l'accueil</button>
    </main>
    <script>
      (async function () {
        const status = document.getElementById('status');
        try {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
          status.textContent = 'Cache nettoye. Vous pouvez revenir a la landing.';
        } catch (error) {
          console.error(error);
          status.textContent = 'Nettoyage partiel. Utilisez ensuite un rechargement force du navigateur.';
        }
        document.getElementById('go').addEventListener('click', () => {
          window.location.href = '/?v=' + Date.now();
        });
      })();
    </script>
  </body>
</html>`);
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

    const serviceWorkerHeaders = {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Service-Worker-Allowed': '/'
    };
    const htmlHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };

    // PWA has been disabled for production builds. These routes keep old browsers
    // from being controlled by a stale service worker that can serve outdated assets.
    app.get('/sw.js', (_req, res) => {
        res.set(serviceWorkerHeaders);
        res.send(`
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('caches' in self) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) {
      client.navigate(client.url);
    }
  })());
});
`);
    });

    app.get('/registerSW.js', (_req, res) => {
        res.set(serviceWorkerHeaders);
        res.send(`
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => {
      if ('caches' in window) {
        return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
    })
    .catch(() => undefined);
}
`);
    });

    app.use(express.static(path.join(process.cwd(), 'client/dist')));
    
    // Fallback for React Router (don't override /api)
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.set(htmlHeaders);
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
