import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { sendMessage } from '../services/whatsappService';
import prisma from '../lib/prisma';


const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const RETENTION_HOURS = 24; // 24h grace period for external APIs to download the file before RGPD wipe

export function startNightlyWorker() {
    console.log('🌙 [Nightly Worker] Cron jobs initialized (Runs daily at 02:00 AM)');

    // Run every day at 02:00 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('⏰ [Nightly Worker] Starting scheduled tasks...');
        
        await performRGPDMediaPurge();
        await scanAndAlertExpiringDocuments();
        
        console.log('💤 [Nightly Worker] Tasks completed. Sleeping.');
    });
}

/**
 * 1. RGPD Purge - "Hit & Run" Security
 * Wipe everything in the uploads directory older than 24h.
 */
async function performRGPDMediaPurge() {
    console.log('🧹 [RGPD] Starting proactive media purge (Medical notes, Receipts)...');

    if (!fs.existsSync(UPLOADS_DIR)) return;

    const files = await fs.promises.readdir(UPLOADS_DIR);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
        // Skip hidden files like .gitkeep
        if (file.startsWith('.')) continue;

        const filePath = path.join(UPLOADS_DIR, file);
        const stats = await fs.promises.stat(filePath);
        
        const fileAgeHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

        if (fileAgeHours > RETENTION_HOURS) {
            try {
                await fs.promises.unlink(filePath);
                deletedCount++;
                console.log(`[RGPD] 🚨 Purged expired file: ${file}`);
            } catch (err) {
                console.error(`[RGPD] ❌ Failed to purge file ${file}`, err);
            }
        }
    }

    console.log(`🧹 [RGPD] Purge completed. Deleted ${deletedCount} sensitive files.`);
}

/**
 * 2. Proactive Alert Agent
 * Scans DB for expiring documents (e.g. CACES, Visite médicale) 
 * and sends proactive WhatsApp messages.
 */
async function scanAndAlertExpiringDocuments() {
    console.log('📅 [Proactive Agent] Scanning for expiring documents in the next 30 days...');

    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    const expiringDocs = await prisma.document.findMany({
        where: {
            expiryDate: {
                gte: today,
                lte: in30Days
            },
            employeeId: { not: null }
        },
        include: {
            employee: true
        }
    });

    if (expiringDocs.length === 0) {
        console.log('📅 [Proactive Agent] No documents expiring soon.');
        return;
    }

    const systemPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    // In a real prod environment we would batch these to avoid rate limits
    for (const doc of expiringDocs) {
        if (!doc.employee || !doc.employee.phoneNumber) continue;

        try {
            const expiryString = doc.expiryDate?.toLocaleDateString('fr-FR');
            
            const message = `⚠️ *Alerte RH Automatique*\n\nBonjour ${doc.employee.name},\nVotre document "*${doc.name}*" arrive à expiration le *${expiryString}*.\n\nVous devrez me fournir une copie à jour de ce justificatif rapidement. Pour cela, cliquez dans le menu ou répondez 'Document'.`;
            
            console.log(`💬 [Proactive Agent] Alerting ${doc.employee.name} about ${doc.name} (${doc.employee.phoneNumber})`);
            
            await sendMessage(
                doc.employee.phoneNumber, 
                message, 
                systemPhoneNumberId
            );

        } catch (error) {
            console.error(`❌ [Proactive Agent] Failed to alert employee ${doc.employee?.name}:`, error);
        }
    }

    console.log(`📅 [Proactive Agent] Sent ${expiringDocs.length} proactive alerts!`);
}
