/**
 * Email Service
 * Handles transactional email sending via Nodemailer
 * Uses SMTP configuration from the Integration vault (with env fallback)
 */
import nodemailer, { Transporter } from 'nodemailer';
import { getProviderConfig } from './configService';

// Nullable transporter pattern (defensive initialization)
let transporter: Transporter | null = null;

/**
 * Initialize the email transporter
 * Called lazily on first email send
 */
async function initTransporter(): Promise<Transporter | null> {
    if (transporter) return transporter;

    try {
        const smtpConfig = await getProviderConfig('SMTP');

        if (!smtpConfig.HOST || !smtpConfig.USER || !smtpConfig.PASSWORD) {
            console.warn('⚠️ Email service not configured - SMTP credentials missing');
            return null;
        }

        transporter = nodemailer.createTransport({
            host: smtpConfig.HOST,
            port: parseInt(smtpConfig.PORT || '587'),
            secure: smtpConfig.PORT === '465', // true for 465, false for other ports
            auth: {
                user: smtpConfig.USER,
                pass: smtpConfig.PASSWORD,
            },
        });

        // Verify connection
        await transporter.verify();
        console.log('✅ Email service initialized successfully');

        return transporter;
    } catch (error) {
        console.error('❌ Email service initialization failed:', error);
        transporter = null;
        return null;
    }
}

/**
 * Get the FROM email address
 */
async function getFromEmail(): Promise<string> {
    const smtpConfig = await getProviderConfig('SMTP');
    return smtpConfig.FROM_EMAIL || 'noreply@whatspoint.com';
}

// ==========================================
// CORE EMAIL SENDING
// ==========================================

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Send an email
 * @param options - Email options (to, subject, html, text)
 * @returns Success boolean
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    const mailer = await initTransporter();

    if (!mailer) {
        console.warn('📧 Email not sent (service not configured):', options.subject);
        return false;
    }

    try {
        const from = await getFromEmail();

        await mailer.sendMail({
            from: `whatsPoint.com <${from}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]+>/g, ''), // Strip HTML for text version
        });

        console.log(`📧 Email sent to ${options.to}: ${options.subject}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return false;
    }
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

/**
 * Base HTML template wrapper
 */
function wrapTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #3b82f6; color: white !important; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #1d4ed8; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
        .footer a { color: #3b82f6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 whatsPoint.com</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} whatsPoint.com. Tous droits réservés.</p>
            <p><a href="https://whatspoint.com">whatspoint.com</a></p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

// ==========================================
// TRANSACTIONAL EMAILS
// ==========================================

/**
 * Send welcome email to new manager
 */
export async function sendWelcomeEmail(manager: { email: string; name: string; tenantName: string }): Promise<boolean> {
    const content = `
        <h2>Bienvenue sur whatsPoint.com, ${manager.name} ! 🎉</h2>
        <p>Votre compte pour <strong>${manager.tenantName}</strong> a été créé avec succès.</p>
        <p>whatsPoint.com vous permet de gérer vos équipes terrain directement via WhatsApp :</p>
        <ul>
            <li>✅ Pointage par géolocalisation</li>
            <li>📸 Preuve photo d'arrivée</li>
            <li>📊 Tableaux de bord temps réel</li>
            <li>💰 Gestion des notes de frais</li>
        </ul>
        <p><a href="https://whatspoint.com/login" class="button">Accéder à mon espace</a></p>
        <p>Pour activer votre bot WhatsApp, envoyez "<strong>Menu</strong>" au numéro configuré.</p>
        <p>À très vite,<br><strong>L'équipe whatsPoint.com</strong></p>
    `;

    return sendEmail({
        to: manager.email,
        subject: `🚀 Bienvenue sur whatsPoint.com, ${manager.name}!`,
        html: wrapTemplate(content),
    });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<boolean> {
    const content = `
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.</p>
        <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
        <p><a href="${resetUrl}?token=${resetToken}" class="button">Réinitialiser mon mot de passe</a></p>
        <p style="color: #6b7280; font-size: 14px;">Ce lien expire dans <strong>1 heure</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        <p>Cordialement,<br><strong>L'équipe whatsPoint.com</strong></p>
    `;

    return sendEmail({
        to: email,
        subject: '🔑 Réinitialisation de votre mot de passe whatsPoint.com',
        html: wrapTemplate(content),
    });
}

/**
 * Send trial expiring reminder
 */
export async function sendTrialExpiringEmail(manager: { email: string; name: string }, daysLeft: number): Promise<boolean> {
    const urgencyColor = daysLeft <= 3 ? '#dc2626' : '#f59e0b';
    const content = `
        <h2>⏰ Votre période d'essai se termine bientôt</h2>
        <p>Bonjour ${manager.name},</p>
        <p>Votre essai gratuit whatsPoint.com se termine dans <strong style="color: ${urgencyColor};">${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.</p>
        <p>Pour continuer à profiter de toutes les fonctionnalités sans interruption :</p>
        <p><a href="https://whatspoint.com/billing" class="button">Passer à Pro</a></p>
        <p>Des questions ? Répondez directement à cet email.</p>
        <p>Cordialement,<br><strong>L'équipe whatsPoint.com</strong></p>
    `;

    return sendEmail({
        to: manager.email,
        subject: `⏰ Plus que ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai whatsPoint.com`,
        html: wrapTemplate(content),
    });
}

/**
 * Send import summary email
 */
export async function sendImportSummaryEmail(
    manager: { email: string; name: string },
    stats: { imported: number; errors: number; total: number }
): Promise<boolean> {
    const statusEmoji = stats.errors === 0 ? '✅' : '⚠️';
    const content = `
        <h2>${statusEmoji} Import terminé</h2>
        <p>Bonjour ${manager.name},</p>
        <p>Votre import d'employés est terminé :</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
                <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Total lignes</strong></td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${stats.total}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">✅ Importés</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; color: #16a34a;"><strong>${stats.imported}</strong></td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">❌ Erreurs</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; color: #dc2626;"><strong>${stats.errors}</strong></td>
            </tr>
        </table>
        <p><a href="https://whatspoint.com/employees" class="button">Voir mon équipe</a></p>
        <p>Cordialement,<br><strong>L'équipe whatsPoint.com</strong></p>
    `;

    return sendEmail({
        to: manager.email,
        subject: `${statusEmoji} Import terminé - ${stats.imported}/${stats.total} employés`,
        html: wrapTemplate(content),
    });
}

/**
 * Send ticket reply notification to client
 */
export async function sendTicketReplyEmail(
    client: { email: string; name: string },
    ticket: { id: string; subject: string },
    messageExcerpt: string
): Promise<boolean> {
    const shortId = ticket.id.slice(0, 8).toUpperCase();
    const truncatedExcerpt = messageExcerpt.length > 200
        ? messageExcerpt.slice(0, 200) + '...'
        : messageExcerpt;

    const content = `
        <h2>🎧 Nouvelle réponse du support</h2>
        <p>Bonjour ${client.name},</p>
        <p>L'équipe support a répondu à votre ticket <strong>#${shortId}</strong> :</p>
        
        <div style="background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-style: italic;">"${truncatedExcerpt}"</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;"><strong>Sujet :</strong> ${ticket.subject}</p>
        
        <p><a href="https://whatspoint.com/support" class="button">Voir la conversation</a></p>
        
        <p>Cordialement,<br><strong>L'équipe whatsPoint.com</strong></p>
    `;

    return sendEmail({
        to: client.email,
        subject: `🎧 Réponse à votre ticket #${shortId} - ${ticket.subject}`,
        html: wrapTemplate(content),
    });
}

/**
 * Check if email service is configured
 */
export async function isEmailConfigured(): Promise<boolean> {
    const smtpConfig = await getProviderConfig('SMTP');
    return !!(smtpConfig.HOST && smtpConfig.USER && smtpConfig.PASSWORD);
}

