import { useState, useEffect } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Loader2,
    Pause,
    Play,
    RefreshCw,
    Server,
    Zap,
    TrendingUp,
    Clock,
    XCircle
} from 'lucide-react';

interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

interface HealthData {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    redisEnabled: boolean;
    queuePaused: boolean;
    qualityScore: 'GREEN' | 'YELLOW' | 'RED' | null;
    lastQualityAlert: string | null;
    stats: QueueStats;
}

export default function ServerHealth() {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const token = localStorage.getItem('superadmin_token');

    const fetchHealth = async () => {
        try {
            setError(null);
            const res = await fetch('/admin/queue/health', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHealth(data);
                setLastRefresh(new Date());
            } else {
                setError('Erreur lors de la récupération des données');
            }
        } catch (err) {
            setError('Erreur de connexion au serveur');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        // Auto-refresh every 10 seconds
        const interval = setInterval(fetchHealth, 10000);
        return () => clearInterval(interval);
    }, []);

    const handlePause = async () => {
        if (!confirm('⚠️ Êtes-vous sûr de vouloir METTRE EN PAUSE la queue WhatsApp ?')) return;

        setActionLoading(true);
        try {
            const res = await fetch('/admin/queue/pause', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                await fetchHealth();
            }
        } catch (err) {
            setError('Erreur lors de la mise en pause');
        } finally {
            setActionLoading(false);
        }
    };

    const handleResume = async () => {
        setActionLoading(true);
        try {
            const res = await fetch('/admin/queue/resume', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                await fetchHealth();
            }
        } catch (err) {
            setError('Erreur lors de la reprise');
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-100 text-green-700 border-green-200';
            case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'critical': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getQualityBadge = (score: string | null) => {
        switch (score) {
            case 'GREEN':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                        <CheckCircle size={16} /> Vert - Excellent
                    </span>
                );
            case 'YELLOW':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
                        <AlertTriangle size={16} /> Jaune - Attention
                    </span>
                );
            case 'RED':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                        <XCircle size={16} /> Rouge - Critique
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-semibold">
                        <Activity size={16} /> Non connecté
                    </span>
                );
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                        <Server className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Santé Serveur</h1>
                        <p className="text-slate-500 text-sm">
                            Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-FR')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => fetchHealth()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                    <RefreshCw size={16} />
                    Rafraîchir
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    {error}
                </div>
            )}

            {health && (
                <>
                    {/* Status Banner */}
                    <div className={`rounded-xl border p-6 ${getStatusColor(health.status)}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {health.status === 'healthy' && <CheckCircle size={32} />}
                                {health.status === 'warning' && <AlertTriangle size={32} />}
                                {health.status === 'critical' && <XCircle size={32} />}
                                <div>
                                    <h2 className="text-xl font-bold capitalize">
                                        {health.status === 'healthy' ? '✅ Système Sain' :
                                            health.status === 'warning' ? '⚠️ Attention Requise' :
                                                '🚨 État Critique'}
                                    </h2>
                                    {health.issues.length > 0 && (
                                        <ul className="mt-1 text-sm">
                                            {health.issues.map((issue, i) => (
                                                <li key={i}>• {issue}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            {health.queuePaused && (
                                <span className="px-4 py-2 bg-red-600 text-white rounded-full font-bold animate-pulse">
                                    ⏸️ QUEUE EN PAUSE
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Traffic Control Section */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
                            🚦 Traffic Control
                        </h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Meta Quality Score */}
                            <div className="bg-slate-50 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-600 font-medium">Qualité Meta WhatsApp</span>
                                    {getQualityBadge(health.qualityScore)}
                                </div>
                                {health.lastQualityAlert && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        Dernière alerte : {new Date(health.lastQualityAlert).toLocaleString('fr-FR')}
                                    </p>
                                )}
                                <p className="text-xs text-slate-400 mt-3">
                                    Ce score est mis à jour automatiquement via les webhooks Meta.
                                </p>
                            </div>

                            {/* Emergency Controls */}
                            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-5 border border-red-100">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-red-800 font-semibold">Contrôle d'Urgence</span>
                                    <Zap className="text-red-500" size={20} />
                                </div>
                                <div className="flex gap-3">
                                    {health.queuePaused ? (
                                        <button
                                            onClick={handleResume}
                                            disabled={actionLoading}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-semibold"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                                            ▶️ REPRENDRE
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handlePause}
                                            disabled={actionLoading}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-semibold"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <Pause size={18} />}
                                            ⏸️ PAUSE D'URGENCE
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-red-600 mt-3">
                                    La pause arrête immédiatement tous les envois WhatsApp. Les messages s'accumulent dans la queue.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Queue Stats */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
                            <Activity size={20} /> Statistiques Queue
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-yellow-50 rounded-xl p-4 text-center">
                                <Clock className="mx-auto text-yellow-600 mb-2" size={24} />
                                <p className="text-2xl font-bold text-yellow-700">{health.stats.waiting}</p>
                                <p className="text-xs text-yellow-600 font-medium">En attente</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <Loader2 className="mx-auto text-blue-600 mb-2" size={24} />
                                <p className="text-2xl font-bold text-blue-700">{health.stats.active}</p>
                                <p className="text-xs text-blue-600 font-medium">En cours</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 text-center">
                                <CheckCircle className="mx-auto text-green-600 mb-2" size={24} />
                                <p className="text-2xl font-bold text-green-700">{health.stats.completed}</p>
                                <p className="text-xs text-green-600 font-medium">Traités</p>
                            </div>
                            <div className="bg-red-50 rounded-xl p-4 text-center">
                                <XCircle className="mx-auto text-red-600 mb-2" size={24} />
                                <p className="text-2xl font-bold text-red-700">{health.stats.failed}</p>
                                <p className="text-xs text-red-600 font-medium">Échoués</p>
                            </div>
                            <div className="bg-purple-50 rounded-xl p-4 text-center">
                                <TrendingUp className="mx-auto text-purple-600 mb-2" size={24} />
                                <p className="text-2xl font-bold text-purple-700">{health.stats.delayed}</p>
                                <p className="text-xs text-purple-600 font-medium">Différés</p>
                            </div>
                        </div>

                        {!health.redisEnabled && (
                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                                <AlertTriangle className="inline mr-2" size={16} />
                                <strong>Mode Direct</strong> - Redis désactivé. Les messages sont envoyés directement sans queue.
                            </div>
                        )}
                    </div>

                    {/* Configuration Info */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                            Configuration
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Redis</span>
                                <p className="font-semibold text-slate-900">
                                    {health.redisEnabled ? '✅ Activé' : '❌ Désactivé'}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Rate Limit</span>
                                <p className="font-semibold text-slate-900">10 msgs/sec</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Backoff</span>
                                <p className="font-semibold text-slate-900">Exponentiel (2s base)</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Tentatives max</span>
                                <p className="font-semibold text-slate-900">3</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
