/**
 * IntegrationWhatsApp Page
 * BYON (Bring Your Own Number) configuration for Enterprise tenants.
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
    ExternalLink,
    Briefcase,
    PhoneCall
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
    const [selectedMethod, setSelectedMethod] = useState<'meta' | 'twilio' | 'concierge' | null>(null);

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

    const handleEmbeddedSignup = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        
        try {
            // Simulation de l'appel Oauth Front-End Facebook JS SDK
            // Normalement : FB.login(..., { scope: 'whatsapp_business_management' })
            
            const token = localStorage.getItem('token');
            const response = await fetch('/api/whatsapp-config/embedded-signup', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: 'fb_oauth_sandbox_code_xyz' })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setSuccess('Connexion automatique réussie !');
            fetchConfig(); // Reload from DB
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Connexion automatique impossible'));
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
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration ? Vos employés utiliseront le numéro partagé.')) {
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

            setSuccess('Configuration supprimée. Vous utilisez maintenant le numéro partagé.');
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

    // Feature gating - not enterprise
    if (!config?.isEnterprise) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                            <MessageSquare className="w-7 h-7 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">WhatsApp Marque Blanche</h2>
                            <p className="text-gray-600">Fonctionnalité Enterprise</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 mb-6">
                        <p className="text-gray-700 mb-4">
                            Connectez votre propre numéro WhatsApp Business API pour :
                        </p>
                        <ul className="space-y-2 text-gray-600">
                            <li className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                Messages envoyés depuis votre numéro
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                Votre marque visible par vos employés
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                Historique dans votre compte Meta Business
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-500" />
                                Pas de risque de bannissement partagé
                            </li>
                        </ul>
                    </div>

                    <div className="text-center">
                        <p className="text-sm text-gray-500 mb-3">
                            Cette fonctionnalité nécessite un plan Enterprise
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
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">WhatsApp Marque Blanche</h1>
                    <p className="text-gray-600">Connectez votre propre numéro WhatsApp Business API</p>
                </div>
            </div>

            {/* Status Card */}
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
                                    🟢 Connecté en Marque Blanche
                                </span>
                            </>
                        ) : (
                            <>
                                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                                <span className="font-medium text-blue-800">
                                    🔵 Utilise le numéro partagé
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
                        Affichage: <strong>{config.displayName}</strong>
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

            {/* If no config, Show 3 Options */}
            {!config?.exists && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Choisissez votre méthode d'intégration</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Option 1: Meta */}
                        <div 
                            onClick={() => setSelectedMethod('meta')}
                            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod === 'meta' ? 'border-[#1877F2] bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        >
                            <div className="w-10 h-10 bg-[#1877F2]/10 text-[#1877F2] rounded-lg flex items-center justify-center mb-3">
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">Connexion Meta</h3>
                            <p className="text-sm text-gray-500 mb-2">Gratuit et instané via "Embedded Signup". Nécessite d'avoir déjà une Page Facebook vitrine.</p>
                            <span className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Le plus rapide</span>
                        </div>

                        {/* Option 2: Twilio */}
                        <div 
                            onClick={() => setSelectedMethod('twilio')}
                            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod === 'twilio' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        >
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3">
                                <PhoneCall className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">Intégration Manuelle</h3>
                            <p className="text-sm text-gray-500 mb-2">Pour brancher un numéro Twilio, Sinch, ou un compte Meta Dev existant (Clés d'API requises).</p>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alternative Experte</span>
                        </div>

                        {/* Option 3: Concierge */}
                        <div 
                            onClick={() => setSelectedMethod('concierge')}
                            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod === 'concierge' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        >
                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-3">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">Service Conciergerie</h3>
                            <p className="text-sm text-gray-500 mb-2">Technophobe ? Laissez l'équipe WhatsPoint acheter et activer la ligne WhatsApp pour vous.</p>
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Tranquillité Totale (150€)</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Blocks Conditionnels */}
            
            {/* 1 - META */}
            {selectedMethod === 'meta' && !config?.exists && (
                <div className="bg-white rounded-xl shadow-sm border-2 border-[#1877F2] p-6 mb-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Connexion Facebook Express</h2>
                            <p className="text-gray-600 text-sm">
                                L'assistant "Embedded Signup" va configurer automatiquement votre ligne en arrière-plan.
                            </p>
                        </div>
                        <button
                            onClick={handleEmbeddedSignup}
                            disabled={saving}
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm font-medium whitespace-nowrap"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
                            Connecter avec Facebook
                        </button>
                    </div>
                </div>
            )}

            {/* 2 - CONCIERGERIE */}
            {selectedMethod === 'concierge' && !config?.exists && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-amber-200 p-8 mb-6 text-center">
                    <h2 className="text-2xl font-bold text-amber-900 mb-3">Service Clés en Main</h2>
                    <p className="text-amber-800 mb-6 max-w-lg mx-auto leading-relaxed">
                        Notre équipe se charge de tout : achat du numéro auprès d'un opérateur, paramétrage de l'API locale, et validation finale sur les serveurs Meta. Vous n'avez aucune manipulation technique à faire.
                    </p>
                    <button className="px-8 py-3 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition shadow-lg flex items-center justify-center gap-2 mx-auto">
                        <Briefcase className="w-5 h-5" />
                        Payer les frais de mise en service (150€)
                    </button>
                    <p className="text-xs text-amber-600 mt-4 opacity-80">Génère un ticket prioritaire auprès du SuperAdmin.</p>
                </div>
            )}

            {/* 3 - TWILIO / MANUEL (Ou si config existante) */}
            {((selectedMethod === 'twilio' && !config?.exists) || config?.exists) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 opacity-100 transition-opacity">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">
                        {config?.exists ? 'Configuration de Connexion Actuelle' : 'Saisie des Clés d\'API'}
                    </h2>

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
                            Nom d'affichage (optionnel)
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={config?.tenantName || 'Vinci RH'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Identité visible dans les messages de test
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
                <h3 className="font-medium text-amber-800 mb-2">⚠️ Configuration Importante</h3>
                <p className="text-sm text-amber-700">
                    Pour que les messages entrants soient routés vers votre numéro, vous devez configurer le webhook
                    dans la console Meta Developer pour pointer vers notre endpoint webhook.
                </p>
            </div>
        </div>
    );
}
