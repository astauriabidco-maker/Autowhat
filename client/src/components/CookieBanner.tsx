import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

export default function CookieBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookieConsent');
        if (consent === null) {
            // Small delay for better UX - don't show immediately
            const timer = setTimeout(() => setVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookieConsent', 'true');
        setVisible(false);
    };

    const handleRefuse = () => {
        localStorage.setItem('cookieConsent', 'false');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-slate-900 text-white shadow-2xl">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Cookie className="text-amber-400 flex-shrink-0" size={24} />
                    <p className="text-sm sm:text-base">
                        Nous utilisons des cookies pour améliorer votre expérience et analyser l'utilisation du site.{' '}
                        <a
                            href="/legal/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-400 hover:text-red-300 underline"
                        >
                            En savoir plus
                        </a>
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                        onClick={handleRefuse}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent border border-gray-600 hover:border-gray-500 rounded-lg transition"
                    >
                        Refuser
                    </button>
                    <button
                        onClick={handleAccept}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
                    >
                        Accepter
                    </button>
                    <button
                        onClick={handleRefuse}
                        className="p-1 text-gray-400 hover:text-white sm:hidden"
                        aria-label="Fermer"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
