const demoPhoneNumber = import.meta.env.VITE_BOT_PHONE_NUMBER?.replace(/\D/g, '');

export const whatsappDemoUrl = demoPhoneNumber
    ? `https://wa.me/${demoPhoneNumber}?text=${encodeURIComponent('Bonjour, je veux voir la demo WhatsPoint')}`
    : '/onboarding?intent=demo-whatsapp';

export const isWhatsappDemoExternal = whatsappDemoUrl.startsWith('https://');

export const salesContactUrl = 'mailto:contact@whatspoint.app?subject=Demo%20WhatsPoint';
