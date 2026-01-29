import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';

export default function NetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showOnlineBanner, setShowOnlineBanner] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (wasOffline) {
                setShowOnlineBanner(true);
                // Hide the "back online" banner after 3 seconds
                setTimeout(() => {
                    setShowOnlineBanner(false);
                }, 3000);
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [wasOffline]);

    // No banner to show
    if (isOnline && !showOnlineBanner) {
        return null;
    }

    return (
        <div
            className={clsx(
                'fixed bottom-0 left-0 right-0 z-[9999] py-3 px-4 flex items-center justify-center gap-2 text-white font-medium shadow-lg transition-all duration-300',
                !isOnline
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500'
            )}
        >
            {!isOnline ? (
                <>
                    <WifiOff size={20} className="animate-pulse" />
                    <span>⚠️ Mode Hors-ligne. Vos modifications seront synchronisées au retour du réseau.</span>
                </>
            ) : (
                <>
                    <Wifi size={20} />
                    <span>✅ Connexion rétablie</span>
                </>
            )}
        </div>
    );
}
