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
        <div className="fixed inset-x-2 bottom-2 z-50 rounded-2xl bg-slate-950/95 p-2.5 text-white shadow-2xl ring-1 ring-white/10 sm:inset-x-0 sm:bottom-0 sm:rounded-none sm:bg-slate-900 sm:p-4">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-2 pr-8 sm:gap-3 sm:pr-0">
                    <Cookie className="flex-shrink-0 text-amber-400" size={18} />
                    <p className="text-xs leading-4 text-slate-100 sm:text-base sm:leading-6">
                        <span className="sm:hidden">
                            Cookies d'audience.
                        </span>
                        <span className="hidden sm:inline">
                            Nous utilisons des cookies pour améliorer votre expérience et analyser l'utilisation du site.
                        </span>{' '}
                        <a
                            href="/legal/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200"
                        >
                            <span className="sm:hidden">Détails</span>
                            <span className="hidden sm:inline">En savoir plus</span>
                        </a>
                    </p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-shrink-0 sm:gap-3">
                    <button
                        onClick={handleRefuse}
                        className="min-h-9 flex-1 rounded-lg border border-slate-600 bg-transparent px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:min-h-10 sm:flex-none sm:px-4 sm:py-2"
                    >
                        Refuser
                    </button>
                    <button
                        onClick={handleAccept}
                        className="min-h-9 flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 sm:min-h-10 sm:flex-none sm:px-4 sm:py-2"
                    >
                        Accepter
                    </button>
                    <button
                        onClick={handleRefuse}
                        className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-white sm:hidden"
                        aria-label="Fermer"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
