import { useState } from 'react';
import { Zap, X, Clock } from 'lucide-react';

interface TrialBannerProps {
    plan?: string;
    trialEndsAt?: string | null;
}

export default function TrialBanner({ plan, trialEndsAt }: TrialBannerProps) {
    const [dismissed, setDismissed] = useState(false);
    const [now] = useState(() => Date.now());

    const daysRemaining = plan === 'TRIAL' && trialEndsAt
        ? Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24))
        : null;

    if (dismissed || daysRemaining === null || daysRemaining <= 0) return null;

    const isUrgent = daysRemaining <= 3;

    return (
        <div className={`w-full py-2.5 px-4 flex items-center justify-between gap-4 text-sm ${isUrgent
                ? 'bg-gradient-to-r from-red-100 to-orange-100 text-red-800 border-b border-red-200'
                : 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-b border-amber-200'
            }`}>
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${isUrgent ? 'bg-red-200' : 'bg-amber-200'}`}>
                    {isUrgent ? <Clock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <span>
                    <strong>Période d'essai :</strong> Il vous reste{' '}
                    <span className="font-bold">{daysRemaining} jour{daysRemaining > 1 ? 's' : ''}</span>.
                    {isUrgent && ' Abonnez-vous pour ne pas perdre vos données !'}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <button className="bg-slate-900 text-white px-4 py-1.5 rounded-lg font-medium text-xs hover:bg-slate-800 transition whitespace-nowrap">
                    S'abonner →
                </button>
                <button
                    onClick={() => setDismissed(true)}
                    className="p-1 hover:bg-amber-200 rounded transition"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
