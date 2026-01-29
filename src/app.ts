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

// Static file serving for uploaded photos
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health Check (Pour vérifier que le serveur tourne)
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'online',
        message: 'WhatsApp Attendance Bot API is running'
    });
});

import router from './routes/index';
import { initLateArrivalJob } from './jobs/lateArrivalJob';
import { initReminderJobs } from './jobs/reminderJobs';

// API Routes
app.use(router);

// Initialisation des Jobs (Cron)
initLateArrivalJob();
initReminderJobs();

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
});
