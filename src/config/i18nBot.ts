/**
 * Bot Internationalization Configuration
 * Dictionnaire multi-langue pour les messages WhatsApp
 */

type SupportedLanguage = 'fr' | 'en' | 'es';

interface BotMessages {
    // Greetings & General
    welcome: string;
    unknownUser: string;
    unknownCommand: string;
    menu: string;

    // Check-in/Check-out
    checkinSuccess: string;
    checkinAlready: string;
    checkoutSuccess: string;
    checkoutNoSession: string;

    // Leave
    leaveMenuIntro: string;
    leaveRequested: string;
    leaveApproved: string;
    leaveRejected: string;

    // Expenses
    expensePhotoPrompt: string;
    expenseAmountPrompt: string;
    expenseCategoryPrompt: string;
    expenseCreated: string;

    // Location/Geofencing
    locationOnSite: string;
    locationOffSite: string;
    locationNoSession: string;

    // Notifications
    lateNotification: string;
    geofenceNotification: string;

    // SOS
    sosConfirmed: string;
}

export const BOT_MESSAGES: Record<SupportedLanguage, BotMessages> = {
    fr: {
        // Greetings
        welcome: "Bienvenue {name} ! 👋 Tapez 'Menu' pour voir vos options.",
        unknownUser: "❌ Numéro non reconnu. Contactez votre RH.",
        unknownCommand: "❓ Commande non reconnue. Tapez 'Menu' pour voir les options.",
        menu: "Bonjour ! 👋 Que souhaitez-vous faire ?",

        // Check-in/Check-out
        checkinSuccess: "✅ Pointage enregistré à {time}.",
        checkinAlready: "Vous avez déjà pointé aujourd'hui à {time}.",
        checkoutSuccess: "👋 Départ enregistré à {time}. Durée de travail : {duration}.",
        checkoutNoSession: "Vous n'avez pas pointé ce matin. Dites 'Hi' pour commencer votre journée.",

        // Leave
        leaveMenuIntro: "🏖️ Quel type de congé souhaitez-vous poser ?",
        leaveRequested: "📨 Demande de congé envoyée ! {type} du {start} au {end}. Votre manager sera notifié.",
        leaveApproved: "✅ Votre demande de congé du {start} au {end} a été APPROUVÉE !",
        leaveRejected: "❌ Votre demande de congé du {start} au {end} a été REFUSÉE.",

        // Expenses
        expensePhotoPrompt: "📷 Envoyez une photo du justificatif de votre dépense.",
        expenseAmountPrompt: "📷 Photo reçue ! ✅\n\n💰 Quel est le montant de la dépense ?\n(Ex: 25.50)",
        expenseCategoryPrompt: "💰 Montant: *{amount} €*\n\n📂 Choisissez la catégorie:",
        expenseCreated: "✅ Note de frais enregistrée !\n\n📂 {category}\n💰 {amount} €\n\nEn attente de validation par votre manager.",

        // Location
        locationOnSite: "📍 Position reçue ! Vous êtes *sur site* ({distance}m du point de référence).",
        locationOffSite: "⚠️ Attention ! Vous êtes *hors zone* ({distance}m). Ce pointage sera signalé.",
        locationNoSession: "⚠️ Vous devez d'abord pointer votre entrée avec \"Hi\" avant d'envoyer votre position.",

        // Notifications
        lateNotification: "⚠️ {name} n'a toujours pas pointé ce matin.",
        geofenceNotification: "📍 {name} a pointé HORS ZONE (Distance: {distance} km).",

        // SOS
        sosConfirmed: "🚨 ALERTE SOS ENVOYÉE !\n\nVotre manager a été informé de votre situation. Restez en sécurité."
    },

    en: {
        // Greetings
        welcome: "Welcome {name}! 👋 Type 'Menu' to see your options.",
        unknownUser: "❌ Unknown number. Please contact HR.",
        unknownCommand: "❓ Unknown command. Type 'Menu' for options.",
        menu: "Hello! 👋 What would you like to do?",

        // Check-in/Check-out
        checkinSuccess: "✅ Check-in confirmed at {time}.",
        checkinAlready: "You already checked in today at {time}.",
        checkoutSuccess: "👋 Check-out confirmed at {time}. Work duration: {duration}.",
        checkoutNoSession: "You haven't checked in this morning. Say 'Hi' to start your day.",

        // Leave
        leaveMenuIntro: "🏖️ What type of leave would you like to request?",
        leaveRequested: "📨 Leave request sent! {type} from {start} to {end}. Your manager will be notified.",
        leaveApproved: "✅ Your leave request from {start} to {end} has been APPROVED!",
        leaveRejected: "❌ Your leave request from {start} to {end} has been REJECTED.",

        // Expenses
        expensePhotoPrompt: "📷 Send a photo of your expense receipt.",
        expenseAmountPrompt: "📷 Photo received! ✅\n\n💰 What is the expense amount?\n(e.g., 25.50)",
        expenseCategoryPrompt: "💰 Amount: *{amount} €*\n\n📂 Choose category:",
        expenseCreated: "✅ Expense report saved!\n\n📂 {category}\n💰 {amount} €\n\nPending manager approval.",

        // Location
        locationOnSite: "📍 Location received! You are *on site* ({distance}m from reference point).",
        locationOffSite: "⚠️ Warning! You are *off site* ({distance}m). This check-in will be flagged.",
        locationNoSession: "⚠️ You must first check in with \"Hi\" before sending your location.",

        // Notifications
        lateNotification: "⚠️ {name} hasn't checked in this morning.",
        geofenceNotification: "📍 {name} checked in OFF SITE (Distance: {distance} km).",

        // SOS
        sosConfirmed: "🚨 SOS ALERT SENT!\n\nYour manager has been notified of your situation. Stay safe."
    },

    es: {
        // Greetings
        welcome: "¡Bienvenido {name}! 👋 Escribe 'Menu' para ver tus opciones.",
        unknownUser: "❌ Número no reconocido. Contacta a RRHH.",
        unknownCommand: "❓ Comando no reconocido. Escribe 'Menu' para ver opciones.",
        menu: "¡Hola! 👋 ¿Qué te gustaría hacer?",

        // Check-in/Check-out
        checkinSuccess: "✅ Entrada confirmada a las {time}.",
        checkinAlready: "Ya fichaste hoy a las {time}.",
        checkoutSuccess: "👋 Salida confirmada a las {time}. Duración: {duration}.",
        checkoutNoSession: "No has fichado esta mañana. Dí 'Hi' para empezar tu día.",

        // Leave
        leaveMenuIntro: "🏖️ ¿Qué tipo de permiso quieres solicitar?",
        leaveRequested: "📨 ¡Solicitud enviada! {type} del {start} al {end}. Tu manager será notificado.",
        leaveApproved: "✅ Tu solicitud de permiso del {start} al {end} ha sido APROBADA!",
        leaveRejected: "❌ Tu solicitud de permiso del {start} al {end} ha sido RECHAZADA.",

        // Expenses
        expensePhotoPrompt: "📷 Envía una foto del comprobante de tu gasto.",
        expenseAmountPrompt: "📷 ¡Foto recibida! ✅\n\n💰 ¿Cuál es el monto del gasto?\n(Ej: 25.50)",
        expenseCategoryPrompt: "💰 Monto: *{amount} €*\n\n📂 Elige categoría:",
        expenseCreated: "✅ ¡Nota de gastos guardada!\n\n📂 {category}\n💰 {amount} €\n\nPendiente de aprobación.",

        // Location
        locationOnSite: "📍 ¡Ubicación recibida! Estás *en el sitio* ({distance}m del punto de referencia).",
        locationOffSite: "⚠️ ¡Atención! Estás *fuera de zona* ({distance}m). Este fichaje será señalado.",
        locationNoSession: "⚠️ Primero debes fichar entrada con \"Hi\" antes de enviar tu ubicación.",

        // Notifications
        lateNotification: "⚠️ {name} aún no ha fichado esta mañana.",
        geofenceNotification: "📍 {name} fichó FUERA DE ZONA (Distancia: {distance} km).",

        // SOS
        sosConfirmed: "🚨 ¡ALERTA SOS ENVIADA!\n\nTu manager ha sido informado. Mantente seguro."
    }
};

/**
 * Get a bot message with parameter substitution
 * @param key - Message key from BotMessages
 * @param lang - Language code (fr, en, es)
 * @param params - Parameters to substitute in the message (e.g., {name}, {time})
 */
export function getBotMessage(
    key: keyof BotMessages,
    lang: string = 'fr',
    params: Record<string, string | number> = {}
): string {
    // Validate and default language
    const validLang = ['fr', 'en', 'es'].includes(lang) ? lang as SupportedLanguage : 'fr';

    let message = BOT_MESSAGES[validLang][key] || BOT_MESSAGES['fr'][key] || '';

    // Substitute parameters
    for (const [paramKey, paramValue] of Object.entries(params)) {
        message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }

    return message;
}

/**
 * Get the effective language for an employee
 * Falls back to tenant language, then 'fr'
 */
export function getEmployeeLanguage(employee: { language?: string; tenant?: { language?: string } }): SupportedLanguage {
    if (employee.language && ['fr', 'en', 'es'].includes(employee.language)) {
        return employee.language as SupportedLanguage;
    }
    if (employee.tenant?.language && ['fr', 'en', 'es'].includes(employee.tenant.language)) {
        return employee.tenant.language as SupportedLanguage;
    }
    return 'fr';
}
