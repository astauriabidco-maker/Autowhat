/**
 * IntegrationWhatsApp Page
 * WhatsApp channel modes for shared, dedicated, and assisted BYON setups.
 */

import { useState, useEffect } from 'react';
import {
    MessageSquare,
    Shield,
    Check,
    AlertTriangle,
    Save,
    TestTube,
    Loader2,
    Eye,
    EyeOff,
    Trash2,
    Briefcase,
    PhoneCall,
    ExternalLink
} from 'lucide-react';
import { getErrorMessage } from '../utils/errors';

interface WhatsAppConfig {
    exists: boolean;
    isActive: boolean;
    isEnterprise: boolean;
    tenantName?: string;
    phoneNumberId?: string;
    wabaId?: string;
    displayName?: string;
    maskedToken?: string;
    createdAt?: string;
}

export default function IntegrationWhatsApp() {
    const [config, setConfig] = useState<WhatsAppConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [phoneNumberId, setPhoneNumberId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [wabaId, setWabaId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [testPhone, setTestPhone] = useState('');
    const [selectedMethod, setSelectedMethod] = useState<'shared' | 'pro' | 'enterprise' | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/whatsapp-config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Erreur serveur');
            const data = await response.json();
            setConfig(data);

            // Pre-fill form if config exists
            if (data.exists) {
                setPhoneNumberId(data.phoneNumberId || '');
                setWabaId(data.wabaId || '');
                setDisplayName(data.displayName || '');
            }
        } catch (err) {
            console.error('Error fetching config:', err);
            setError('Impossible de charger la configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!phoneNumberId || !accessToken) {
            setError('Phone Number ID et Access Token sont requis');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/whatsapp-config', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumberId,
                    accessToken,
                    wabaId: wabaId || undefined,
                    displayName: displayName || undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la sauvegarde');
            }

            setSuccess('Configuration sauvegardée avec succès !');
            setAccessToken(''); // Clear token from UI
            fetchConfig(); // Refresh
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Erreur lors de la sauvegarde'));
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!phoneNumberId || !accessToken) {
            setError('Veuillez remplir les champs avant de tester');
            return;
        }

        setTesting(true);
        setError(null);
        setSuccess(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/whatsapp-config/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumberId,
                    accessToken,
                    displayName,
                    testPhone: testPhone || undefined
                })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('✅ Test réussi ! Vérifiez votre WhatsApp.');
            } else {
                throw new Error(data.error || 'Test échoué');
            }
        } catch (err: unknown) {
            setError(`Test échoué: ${getErrorMessage(err, 'Test échoué')}`);
        } finally {
            setTesting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration ? Vos employés repasseront sur le numéro WhatsPoint mutualisé.')) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/whatsapp-config', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Erreur lors de la suppression');

            setSuccess('Configuration supprimée. Vous utilisez maintenant le numéro WhatsPoint mutualisé.');
            setPhoneNumberId('');
            setWabaId('');
            setDisplayName('');
            fetchConfig();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Erreur lors de la suppression'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!config?.isEnterprise) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                            <MessageSquare className="w-7 h-7 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Canal WhatsApp</h2>
                            <p className="text-gray-600">Démarrez sans configuration Meta côté client</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-lg p-5 border border-blue-100">
                            <h3 className="font-semibold text-gray-900 mb-2">MVP: numéro WhatsPoint mutualisé</h3>
                            <p className="text-sm text-gray-600">
                                Le mode le plus rapide pour lancer le pointage. Le numéro et le nom affiché ne sont pas personnalisés.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-5 border border-blue-100">
                            <h3 className="font-semibold text-gray-900 mb-2">Pro: numéro dédié WhatsPoint</h3>
                            <p className="text-sm text-gray-600">
                                WhatsPoint fournit et opère un numéro séparé. Le nom affiché dépend de la validation Meta.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-5 border border-blue-100">
                            <h3 className="font-semibold text-gray-900 mb-2">Enterprise: BYON accompagné</h3>
                            <p className="text-sm text-gray-600">
                                Votre propre compte ou numéro WhatsApp Business, avec cadrage technique WhatsPoint.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 mb-6">
                        <p className="text-gray-700 mb-4">Inclus dès maintenant :</p>
                        <ul className="space-y-2 text-gray-600">
                            <li className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                Pointage WhatsApp opérationnel via le numéro WhatsPoint
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                Aucun compte Meta Business à connecter pour démarrer
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                Passage vers un numéro dédié ou BYON traité avec accompagnement
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-500" />
                                Promesse claire: pas de nom affiché personnalisé garanti sans validation Meta
                            </li>
                        </ul>
                    </div>

                    <div className="text-center">
                        <p className="text-sm text-gray-500 mb-3">
                            Les options dédiées et BYON sont activées avec WhatsPoint selon votre offre.
                        </p>
                        <a
                            href="/billing"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            Mettre à niveau
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Canal WhatsApp</h1>
                    <p className="text-gray-600">Choisissez le mode d'envoi adapté à votre offre</p>
                </div>
            </div>

            <div className={`rounded-xl p-4 mb-6 border ${config?.exists && config?.isActive
                    ? 'bg-green-50 border-green-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {config?.exists && config?.isActive ? (
                            <>
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                <span className="font-medium text-green-800">
                                    Numéro Enterprise connecté
                                </span>
                            </>
                        ) : (
                            <>
                                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                                <span className="font-medium text-blue-800">
                                    MVP: numéro WhatsPoint mutualisé
                                </span>
                            </>
                        )}
                    </div>

                    {config?.exists && (
                        <button
                            onClick={handleDelete}
                            className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                        >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                        </button>
                    )}
                </div>

                {config?.displayName && config?.isActive && (
                    <p className="mt-2 text-sm text-green-700">
                        Nom d'affichage souhaité: <strong>{config.displayName}</strong>
                        <span className="text-green-600"> (soumis à validation Meta)</span>
                    </p>
                )}
            </div>

            {/* Alerts */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <p className="text-green-700">{success}</p>
                </div>
            )}

            {!config?.exists && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Modes disponibles</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div 
                            onClick={() => setSelectedMethod('shared')}
                            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod === 'shared' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        >
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-3">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">MVP: numéro WhatsPoint mutualisé</h3>
                            <p className="text-sm text-gray-500 mb-2">Vos équipes pointent tout de suite via le numéro WhatsPoint. Aucune configuration Meta à prévoir.</p>
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Déjà actif</span>
                        </div>

                        <div 
                            onClick={() => setSelectedMethod('pro')}
                            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod === 'pro' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        >
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3">
                                <PhoneCall className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">Pro: numéro dédié WhatsPoint</h3>
                            <p className="text-sm text-gray-500 mb-2">WhatsPoint fournit et opère un numéro séparé. Le nom affiché reste soumis à validation Meta.</p>
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Activation accompagnée</span>
                        </div>

                        <div 
                            onClick={() => setSelectedMethod('enterprise')}
                            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod === 'enterprise' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        >
                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-3">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">Enterprise: BYON accompagné</h3>
                            <p className="text-sm text-gray-500 mb-2">Votre propre compte ou numéro WhatsApp Business, cadré avec WhatsPoint avant activation.</p>
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Cadrage requis</span>
                        </div>
                    </div>
                </div>
            )}

            {selectedMethod === 'shared' && !config?.exists && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-blue-950 mb-2">Démarrage immédiat confirmé</h2>
                    <p className="text-blue-800 text-sm">
                        Aucun paramétrage n'est nécessaire: le pointage utilise le numéro WhatsPoint mutualisé. C'est le mode recommandé pour éviter toute friction de lancement.
                    </p>
                </div>
            )}

            {selectedMethod === 'pro' && !config?.exists && (
                <div className="bg-indigo-50 rounded-xl shadow-sm border border-indigo-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-indigo-950 mb-2">Activation Pro accompagnée</h2>
                    <p className="text-indigo-800 text-sm leading-relaxed">
                        WhatsPoint peut fournir un numéro dédié à votre organisation. Le numéro est séparé des autres clients, mais le nom affiché WhatsApp dépend de Meta et ne doit pas être promis comme garanti.
                    </p>
                </div>
            )}

            {selectedMethod === 'enterprise' && !config?.exists && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-amber-200 p-8 mb-6 text-center">
                    <h2 className="text-2xl font-bold text-amber-900 mb-3">BYON accompagné</h2>
                    <p className="text-amber-800 mb-6 max-w-lg mx-auto leading-relaxed">
                        Votre propre numéro ou compte WhatsApp Business peut être connecté après cadrage technique. WhatsPoint vous accompagne sur Meta Business, webhooks, templates et mise en production.
                    </p>
                    <button className="px-8 py-3 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition shadow-lg flex items-center justify-center gap-2 mx-auto">
                        <Briefcase className="w-5 h-5" />
                        Demander le cadrage WhatsPoint
                    </button>
                    <p className="text-xs text-amber-600 mt-4 opacity-80">Réservé aux déploiements validés avec WhatsPoint.</p>
                </div>
            )}

            {((selectedMethod === 'enterprise' && !config?.exists) || config?.exists) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 opacity-100 transition-opacity">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">
                        {config?.exists ? 'Configuration technique actuelle' : 'Configuration technique accompagnée'}
                    </h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Ces champs sont réservés aux déploiements Enterprise validés avec WhatsPoint. Ils ne remplacent pas le cadrage Meta et le nom d'affichage reste soumis à validation.
                    </p>

                <div className="space-y-5">
                    {/* Phone Number ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number ID *
                        </label>
                        <input
                            type="text"
                            value={phoneNumberId}
                            onChange={(e) => setPhoneNumberId(e.target.value)}
                            placeholder="123456789012345"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Trouvable dans Meta Business Suite → WhatsApp → Configuration API
                        </p>
                    </div>

                    {/* Access Token */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Access Token (System User) *
                        </label>
                        <div className="relative">
                            <input
                                type={showToken ? 'text' : 'password'}
                                value={accessToken}
                                onChange={(e) => setAccessToken(e.target.value)}
                                placeholder={config?.exists ? '••••••••••••••••' : 'EAAxxxxxxx...'}
                                className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {config?.maskedToken && (
                            <p className="mt-1 text-xs text-gray-500">
                                Token actuel: {config.maskedToken}
                            </p>
                        )}
                    </div>

                    {/* WABA ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            WABA ID (optionnel)
                        </label>
                        <input
                            type="text"
                            value={wabaId}
                            onChange={(e) => setWabaId(e.target.value)}
                            placeholder="WhatsApp Business Account ID"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nom d'affichage souhaité (optionnel)
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={config?.tenantName || 'Vinci RH'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Soumis à validation Meta, non garanti.
                        </p>
                    </div>

                    {/* Test Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Numéro de test (optionnel)
                        </label>
                        <input
                            type="text"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="+33612345678"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Numéro pour recevoir le message de test
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-8 pt-6 border-t">
                    <button
                        onClick={handleTest}
                        disabled={testing || !phoneNumberId || !accessToken}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {testing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <TestTube className="w-4 h-4" />
                        )}
                        Tester la connexion
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving || !phoneNumberId || !accessToken}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
            )}

            {/* Help Section */}
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-medium text-amber-800 mb-2">Configuration importante</h3>
                <p className="text-sm text-amber-700">
                    Pour connecter un numéro Enterprise, WhatsPoint vous accompagne dans la configuration Meta, les webhooks et les templates. Le parcours n'est pas prévu en self-service pour le MVP.
                </p>
            </div>
        </div>
    );
}
