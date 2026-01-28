import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
