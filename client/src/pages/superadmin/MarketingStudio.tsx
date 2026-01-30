import { useState, useEffect, useRef } from 'react';
import { MessageSquare, QrCode, Download, Copy, Check, AlertTriangle, RefreshCw, Smartphone, Save } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface PlatformConfig {
    botWelcomeText: string;
    botBtn1Label: string;
    botBtn2Label: string;
    whatsappPhoneNumber: string | null;
}

export default function MarketingStudio() {
    const [activeTab, setActiveTab] = useState<'bot' | 'qr'>('bot');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Bot Config
    const [config, setConfig] = useState<PlatformConfig>({
        botWelcomeText: 'Je ne reconnais pas ce numéro. Que voulez-vous faire ?',
        botBtn1Label: 'Créer un compte',
        botBtn2Label: 'En savoir plus',
        whatsappPhoneNumber: null
    });

    // QR Code
    const [triggerMessage, setTriggerMessage] = useState('Start');
    const qrRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch('/admin/config', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setConfig({
                    botWelcomeText: data.botWelcomeText || 'Je ne reconnais pas ce numéro. Que voulez-vous faire ?',
                    botBtn1Label: data.botBtn1Label || 'Créer un compte',
                    botBtn2Label: data.botBtn2Label || 'En savoir plus',
                    whatsappPhoneNumber: data.whatsappPhoneNumber || null
                });
            }
        } catch (error) {
            console.error('Error fetching config:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('superadmin_token');
            await fetch('/admin/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });
        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            setSaving(false);
        }
    };

    const whatsappUrl = config.whatsappPhoneNumber
        ? `https://wa.me/${config.whatsappPhoneNumber}?text=${encodeURIComponent(triggerMessage)}`
        : '';

    const copyToClipboard = () => {
        navigator.clipboard.writeText(whatsappUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadQR = () => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (canvas) {
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = `qr-whatsapp-${triggerMessage.toLowerCase().replace(/\s+/g, '-')}.png`;
            a.click();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">📢 Studio Marketing</h1>
                <p className="text-slate-500 mt-1">Personnalisez le bot et générez des QR Codes</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('bot')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'bot'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Configuration Bot
                </button>
                <button
                    onClick={() => setActiveTab('qr')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'qr'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <QrCode className="w-4 h-4" />
                    Générateur QR Code
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'bot' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Form */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                        <h2 className="font-semibold text-slate-900">Messages du Bot</h2>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Message d'accueil
                            </label>
                            <textarea
                                value={config.botWelcomeText}
                                onChange={(e) => setConfig({ ...config, botWelcomeText: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Message affiché aux numéros inconnus..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Bouton 1 <span className="text-slate-400 text-xs">(max 20 car.)</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.botBtn1Label}
                                    onChange={(e) => setConfig({ ...config, botBtn1Label: e.target.value.slice(0, 20) })}
                                    maxLength={20}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Bouton 2 <span className="text-slate-400 text-xs">(max 20 car.)</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.botBtn2Label}
                                    onChange={(e) => setConfig({ ...config, botBtn2Label: e.target.value.slice(0, 20) })}
                                    maxLength={20}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Numéro WhatsApp du Bot <span className="text-slate-400 text-xs">(sans +)</span>
                            </label>
                            <input
                                type="text"
                                value={config.whatsappPhoneNumber || ''}
                                onChange={(e) => setConfig({ ...config, whatsappPhoneNumber: e.target.value.replace(/\D/g, '') })}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                placeholder="33612345678"
                            />
                        </div>

                        <button
                            onClick={saveConfig}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>

                    {/* WhatsApp Preview */}
                    <div className="bg-slate-100 rounded-2xl p-6">
                        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Smartphone className="w-5 h-5" />
                            Aperçu WhatsApp
                        </h2>

                        <div className="bg-[#e5ddd5] rounded-xl p-4 max-w-xs mx-auto">
                            {/* Bot Message */}
                            <div className="bg-white rounded-lg p-3 shadow-sm mb-3">
                                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                                    👋 Bonjour !{'\n\n'}{config.botWelcomeText}
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="space-y-2">
                                <button className="w-full bg-white border border-[#25D366] text-[#25D366] py-2 px-4 rounded-lg text-sm font-medium">
                                    {config.botBtn1Label || 'Bouton 1'}
                                </button>
                                <button className="w-full bg-white border border-[#25D366] text-[#25D366] py-2 px-4 rounded-lg text-sm font-medium">
                                    {config.botBtn2Label || 'Bouton 2'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'qr' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* QR Generator */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                        <h2 className="font-semibold text-slate-900">Générateur de QR Code</h2>

                        {!config.whatsappPhoneNumber && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-amber-800 font-medium text-sm">Numéro non configuré</p>
                                    <p className="text-amber-700 text-xs mt-0.5">
                                        Configurez d'abord le numéro du bot dans l'onglet "Configuration Bot".
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Message de déclenchement
                            </label>
                            <input
                                type="text"
                                value={triggerMessage}
                                onChange={(e) => setTriggerMessage(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                placeholder="Start, Demo, Promo2025..."
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Ce message sera pré-rempli quand l'utilisateur scannera le QR.
                            </p>
                        </div>

                        {config.whatsappPhoneNumber && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Lien Magique (copier dans emails)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={whatsappUrl}
                                            readOnly
                                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm"
                                        />
                                        <button
                                            onClick={copyToClipboard}
                                            className="px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                                        >
                                            {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-slate-600" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={downloadQR}
                                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Télécharger le QR Code (PNG)
                                </button>
                            </>
                        )}
                    </div>

                    {/* QR Preview */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center">
                        {config.whatsappPhoneNumber ? (
                            <div ref={qrRef} className="text-center">
                                <QRCodeCanvas
                                    value={whatsappUrl}
                                    size={256}
                                    level="H"
                                    includeMargin={true}
                                    bgColor="#ffffff"
                                    fgColor="#000000"
                                />
                                <p className="text-slate-500 text-sm mt-4">
                                    Scannez pour ouvrir WhatsApp
                                </p>
                                <p className="text-slate-400 text-xs mt-1">
                                    Message: "{triggerMessage}"
                                </p>
                            </div>
                        ) : (
                            <div className="text-center text-slate-400">
                                <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p>Configurez le numéro du bot pour générer un QR Code</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
