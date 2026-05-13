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
        <div className="fixed inset-x-2 bottom-2 z-50 rounded-xl bg-slate-950/95 p-1.5 text-white shadow-2xl ring-1 ring-white/10 sm:inset-x-0 sm:bottom-0 sm:rounded-none sm:bg-slate-900 sm:p-4">
            <div className="mx-auto flex max-w-6xl items-center gap-1.5 sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
                    <Cookie className="hidden flex-shrink-0 text-amber-400 min-[370px]:block" size={16} />
                    <p className="min-w-0 truncate text-[11px] leading-4 text-slate-100 sm:text-base sm:leading-6">
                        <span className="sm:hidden">
                            Cookies.
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
                <div className="flex flex-shrink-0 items-center gap-1.5 sm:w-auto sm:gap-3">
                    <button
                        onClick={handleRefuse}
                        className="min-h-8 rounded-lg border border-slate-600 bg-transparent px-2 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:min-h-10 sm:px-4 sm:py-2 sm:text-sm"
                    >
                        Refuser
                    </button>
                    <button
                        onClick={handleAccept}
                        className="min-h-8 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 sm:min-h-10 sm:px-4 sm:py-2 sm:text-sm"
                    >
                        Accepter
                    </button>
                    <button
                        onClick={handleRefuse}
                        className="hidden p-1 text-slate-400 hover:text-white sm:hidden"
                        aria-label="Fermer"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
