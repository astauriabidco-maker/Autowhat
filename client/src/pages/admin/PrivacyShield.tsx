import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
    Shield,
    Eye,
    EyeOff,
    Clock,
    Trash2,
    Database,
    Check,
    AlertTriangle,
    RefreshCw,
    Info
} from 'lucide-react';

interface PrivacySettings {
    isPrivacyModeEnabled: boolean;
    dataRetentionDays: number;
    lastPurgeDate: string | null;
}

interface PurgeEstimate {
    attendances: number;
    tickets: number;
    total: number;
    message?: string;
}

interface AnonymizationPreview {
    original: string;
    anonymized: string;
}

const RETENTION_OPTIONS = [
    { value: 30, label: '30 jours' },
    { value: 90, label: '3 mois' },
    { value: 180, label: '6 mois' },
    { value: 365, label: '1 an' },
    { value: 730, label: '2 ans' },
    { value: 0, label: 'Illimité' }
];

export default function PrivacyShield() {
    const [settings, setSettings] = useState<PrivacySettings | null>(null);
    const [estimate, setEstimate] = useState<PurgeEstimate | null>(null);
    const [preview, setPreview] = useState<AnonymizationPreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [purging, setPurging] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [settingsRes, estimateRes, previewRes] = await Promise.all([
                axios.get('/api/privacy/settings'),
                axios.get('/api/privacy/purge-estimate'),
                axios.get('/api/privacy/preview')
            ]);
            setSettings(settingsRes.data);
            setEstimate(estimateRes.data);
            setPreview(previewRes.data);
        } catch (error) {
            console.error('Error fetching privacy data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (updates: Partial<PrivacySettings>) => {
        if (!settings) return;

        setSaving(true);
        try {
            const res = await axios.put('/api/privacy/settings', updates);
            setSettings(res.data);

            // Refresh estimate if retention changed
            if (updates.dataRetentionDays !== undefined) {
                const estimateRes = await axios.get('/api/privacy/purge-estimate');
                setEstimate(estimateRes.data);
            }

            setSuccessMessage('Paramètres sauvegardés');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error updating settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const triggerPurge = async () => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer les données expirées maintenant ?')) return;

        setPurging(true);
        try {
            await axios.post('/api/privacy/purge');
            await fetchData();
            setSuccessMessage('Purge effectuée avec succès');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error triggering purge:', error);
        } finally {
            setPurging(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-8 h-8 text-blue-500" />
                    <h1 className="text-2xl font-bold text-gray-900">Privacy Shield</h1>
                </div>
                <p className="text-gray-600">
                    Protégez les données de votre entreprise et assurez la conformité RGPD.
                </p>
            </div>

            {/* Success Message */}
            {successMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"
                >
                    <Check className="w-5 h-5" />
                    {successMessage}
                </motion.div>
            )}

            <div className="grid gap-6">
                {/* Card 1: Stealth Mode */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                {settings?.isPrivacyModeEnabled ? (
                                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                                        <EyeOff className="w-6 h-6 text-green-600" />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                                        <Eye className="w-6 h-6 text-gray-500" />
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Mode Furtif</h2>
                                    <p className="text-sm text-gray-500">
                                        Anonymise les données envoyées à WhatsApp/Meta
                                    </p>
                                </div>
                            </div>

                            {/* Toggle Switch */}
                            <button
                                onClick={() => updateSettings({ isPrivacyModeEnabled: !settings?.isPrivacyModeEnabled })}
                                disabled={saving}
                                className={`relative w-14 h-7 rounded-full transition-colors ${settings?.isPrivacyModeEnabled ? 'bg-green-500' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings?.isPrivacyModeEnabled ? 'translate-x-7' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Preview */}
                        {preview && (
                            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
                                    <Info className="w-4 h-4" />
                                    Exemple de transformation
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Avant</div>
                                        <div className="p-3 bg-white rounded border border-gray-200 text-sm">
                                            {preview.original}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-green-600 mb-1">Après (anonymisé)</div>
                                        <div className="p-3 bg-green-50 rounded border border-green-200 text-sm text-green-800">
                                            {preview.anonymized}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Card 2: Data Retention */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Rétention des données (RGPD)</h2>
                                <p className="text-sm text-gray-500">
                                    Durée de conservation de l'historique
                                </p>
                            </div>
                        </div>

                        {/* Retention Selector */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Conserver l'historique pendant...
                            </label>
                            <select
                                value={settings?.dataRetentionDays || 365}
                                onChange={(e) => updateSettings({ dataRetentionDays: parseInt(e.target.value) })}
                                disabled={saving}
                                className="w-full md:w-64 px-4 py-2.5 border border-gray-300 rounded-lg
                                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {RETENTION_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Purge Estimate */}
                        {estimate && estimate.total > 0 && settings?.dataRetentionDays !== 0 && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div>
                                        <div className="font-medium text-amber-800">
                                            Données à purger
                                        </div>
                                        <div className="text-sm text-amber-700 mt-1">
                                            La prochaine purge automatique supprimera environ <strong>{estimate.total}</strong> enregistrements :
                                        </div>
                                        <ul className="text-sm text-amber-700 mt-2 space-y-1">
                                            <li>• {estimate.attendances} pointages</li>
                                            <li>• {estimate.tickets} tickets fermés</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {settings?.dataRetentionDays === 0 && (
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Database className="w-5 h-5" />
                                    <span>Conservation illimitée - aucune donnée ne sera supprimée automatiquement</span>
                                </div>
                            </div>
                        )}

                        {/* Last Purge Info */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="text-sm text-gray-500">
                                {settings?.lastPurgeDate ? (
                                    <>
                                        Dernière purge : {new Date(settings.lastPurgeDate).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </>
                                ) : (
                                    'Aucune purge effectuée'
                                )}
                            </div>

                            {settings?.dataRetentionDays !== 0 && (
                                <button
                                    onClick={triggerPurge}
                                    disabled={purging || estimate?.total === 0}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                                               text-red-600 hover:bg-red-50 border border-red-200 
                                               rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {purging ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                    Purger maintenant
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-blue-50 border border-blue-200 rounded-xl p-6"
                >
                    <div className="flex items-start gap-3">
                        <Info className="w-6 h-6 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-800 mb-2">
                                À propos de Privacy Shield
                            </h3>
                            <ul className="text-sm text-blue-700 space-y-2">
                                <li>
                                    <strong>Mode Furtif :</strong> Transforme les noms de sites et d'employés en codes anonymes avant envoi à WhatsApp. Cela empêche Meta de profiler vos activités.
                                </li>
                                <li>
                                    <strong>Purge automatique :</strong> S'exécute chaque nuit à 04h00 et supprime les pointages et tickets fermés dépassant la période de rétention.
                                </li>
                                <li>
                                    <strong>Conformité RGPD :</strong> Article 5(1)(e) - Limitation de la conservation. Les données ne doivent pas être conservées plus longtemps que nécessaire.
                                </li>
                            </ul>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
