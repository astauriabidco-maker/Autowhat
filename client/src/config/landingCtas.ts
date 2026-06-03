const demoPhoneNumber = import.meta.env.VITE_BOT_PHONE_NUMBER?.replace(/\D/g, '');

export const whatsappDemoUrl = demoPhoneNumber
    ? `https://wa.me/${demoPhoneNumber}?text=${encodeURIComponent('Demo WhatsPoint')}`
    : 'mailto:contact@whatspoint.app?subject=Demo%20WhatsPoint%20WhatsApp';

export const isWhatsappDemoExternal = whatsappDemoUrl.startsWith('https://');

export const salesContactUrl = 'mailto:contact@whatspoint.app?subject=Demo%20WhatsPoint';
