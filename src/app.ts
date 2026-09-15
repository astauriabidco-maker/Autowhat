import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { getRedisRuntimeStatus } from './services/redisConnection';

dotenv.config();

// Validate encryption key at startup
import { validateEncryptionKey } from './utils/crypto';
import { assertProductionEnv } from './config/envValidation';
validateEncryptionKey();
assertProductionEnv();

const app = express();
const shouldServeFrontend = process.env.NODE_ENV === 'production' || process.env.SERVE_FRONTEND === 'true';
const frontendDistPath = path.join(process.cwd(), 'client/dist');
const frontendAssetsPath = path.join(frontendDistPath, 'assets');

app.disable('x-powered-by');
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY);
}
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// IMPORTANT: Stripe webhook MUST be registered BEFORE body-parser
// because it needs the raw body for signature verification
import * as webhookStripe from './controllers/webhookStripe';
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), webhookStripe.handleWebhook);

// Middleware de base
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, '');

app.use(cors((req, callback) => {
    const origin = req.header('Origin');
    const host = req.get('host');
    const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const requestOrigins = host
        ? [
            `${forwardedProto || req.protocol}://${host}`,
            `https://${host}`,
            `http://${host}`
        ].map(normalizeOrigin)
        : [];
    const configuredOrigins = allowedOrigins.map(normalizeOrigin);
    const normalizedOrigin = origin ? normalizeOrigin(origin) : null;
    const isAllowed = !normalizedOrigin
        || requestOrigins.includes(normalizedOrigin)
        || configuredOrigins.includes(normalizedOrigin)
        || (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production');

    callback(null, {
        origin: isAllowed,
        credentials: true
    });
}));
app.use(bodyParser.json({
    limit: process.env.JSON_BODY_LIMIT || '1mb',
    verify: (req: any, _res, buf) => {
        const rawBodyPaths = new Set([
            '/webhook',
            '/api/sandbox/webhooks/echo'
        ]);
        if (rawBodyPaths.has(req.originalUrl?.split('?')[0])) {
            req.rawBody = Buffer.from(buf);
        }
    }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '100kb' }));
app.use(cookieParser());

// Swagger API Documentation
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

const partnerDocs = {
    'kalldy-v1.md': {
        title: 'Kalldy v1',
        file: 'kalldy-v1.md',
        path: path.join(process.cwd(), 'docs/kalldy-v1.md')
    },
    'kalldy-poc.md': {
        title: 'Kalldy POC',
        file: 'kalldy-poc.md',
        path: path.join(process.cwd(), 'docs/kalldy-poc.md')
    },
    'connectors.md': {
        title: 'Connecteurs partenaires',
        file: 'connectors.md',
        path: path.join(process.cwd(), 'docs/connectors.md')
    }
} as const;

app.get('/api/docs/public-v1.yaml', (_req, res) => {
    const publicApiSpecPath = path.join(process.cwd(), 'docs/public-api-v1.openapi.yaml');
    res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
    res.sendFile(publicApiSpecPath, (error) => {
        if (error && !res.headersSent) {
            res.status(404).json({ error: 'Public API OpenAPI spec not found' });
        }
    });
});

app.get('/api/docs/partners', (_req, res) => {
    res.status(200).json({
        docs: Object.entries(partnerDocs).map(([slug, doc]) => ({
            slug,
            title: doc.title,
            url: `/api/docs/partners/${doc.file}`
        }))
    });
});

app.get('/api/docs/partners/:docFile', (req, res) => {
    const doc = partnerDocs[req.params.docFile as keyof typeof partnerDocs];

    if (!doc) {
        res.status(404).json({ error: 'Partner documentation not found' });
        return;
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.sendFile(doc.path, (error) => {
        if (error && !res.headersSent) {
            res.status(404).json({ error: 'Partner documentation not found' });
        }
    });
});

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
    const redis = getRedisRuntimeStatus();
    const status = redis.enabled && redis.lastError ? 'degraded' : 'online';

    res.status(200).json({
        status,
        message: 'WhatsPoint API is running',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        redis
    });
});

app.get('/api/frontend-diagnostics', (_req, res) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
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
        assets = fs.readdirSync(frontendAssetsPath);
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
        distPath: frontendDistPath,
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
import { globalErrorHandler } from './middlewares/errorMiddleware';

// Static frontend assets must be served before API/router middleware so hashed
// JS/CSS files never fall through to the React HTML fallback.
if (shouldServeFrontend) {
    app.use('/assets', express.static(frontendAssetsPath, {
        fallthrough: false,
        immutable: true,
        index: false,
        maxAge: '1y'
    }));
    app.use('/images', express.static(path.join(frontendDistPath, 'images'), {
        fallthrough: false,
        immutable: true,
        index: false,
        maxAge: '1y'
    }));
    app.use('/icons', express.static(path.join(frontendDistPath, 'icons'), {
        fallthrough: false,
        immutable: true,
        index: false,
        maxAge: '1y'
    }));
    app.get('/vite.svg', (_req, res) => {
        res.sendFile(path.join(frontendDistPath, 'vite.svg'));
    });
    app.get('/manifest.webmanifest', (_req, res) => {
        res.sendFile(path.join(frontendDistPath, 'manifest.webmanifest'), (error) => {
            if (error && !res.headersSent) {
                res.status(404).type('text/plain').send('Manifest not found');
            }
        });
    });
}

// API Routes
app.use(router);

// ------------------------------------------------------------------
// SOLOPRENEUR OPTIMIZATION: ONE-CONTAINER DEPLOYMENT
// Serve the built React App directly via Express in Production
// ------------------------------------------------------------------
if (shouldServeFrontend) {
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

    app.use(express.static(frontendDistPath));
    
    // Fallback for React Router. Never return HTML for asset-like requests,
    // otherwise browsers reject CSS/JS because they receive text/html.
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        if (path.extname(req.path)) {
            return res.status(404).type('text/plain').send('Static asset not found');
        }
        res.set(htmlHeaders);
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

app.use(globalErrorHandler);

export function createApp() {
    return app;
}

export default app;
