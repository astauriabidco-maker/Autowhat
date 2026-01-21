import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health Check (Pour vérifier que le serveur tourne)
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'online',
        message: 'WhatsApp Attendance Bot API is running'
    });
});

// TODO: Importer les routes ici (étape suivante)

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
});
