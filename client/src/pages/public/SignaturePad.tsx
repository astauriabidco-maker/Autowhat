import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { format } from 'date-fns';
import {
    CheckCircle2, AlertCircle, Loader2, RotateCcw,
    Building2, User, Calendar, Clock, FileText, Pen
} from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

interface InterventionData {
    id: string;
    title: string;
    description?: string;
    reportContent?: string;
    reportPhotos?: string[];
    scheduledStart: string;
    scheduledEnd: string;
    realStart?: string;
    status: string;
    customer: { companyName: string; contactName: string; address?: string };
    employee: { name: string };
    tenant: { name: string };
}

export default function SignaturePad() {
    const { token } = useParams<{ token: string }>();
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [data, setData] = useState<InterventionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [signatureEmpty, setSignatureEmpty] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`/api/public/intervention/${token}`);
                setData(res.data);
            } catch (e: unknown) {
                setError(getErrorMessage(e, 'Intervention introuvable ou déjà signée.'));
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchData();
    }, [token]);

    const clearSignature = () => {
        sigCanvas.current?.clear();
        setSignatureEmpty(true);
    };

    const handleSign = async () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;

        setSubmitting(true);
        try {
            const signatureDataUrl = sigCanvas.current.toDataURL('image/png');
            await axios.post(`/api/public/intervention/${token}/sign`, { signatureDataUrl });
            setSuccess(true);
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Une erreur est survenue.'));
        } finally {
            setSubmitting(false);
        }
    };

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-500">Chargement de l'intervention...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (error && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
                    <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur</h2>
                    <p className="text-gray-500">{error}</p>
                </div>
            </div>
        );
    }

    // Success State
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} className="text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Intervention signée !</h2>
                    <p className="text-gray-500 mb-6">
                        La signature a été enregistrée avec succès. Un rapport vous sera envoyé par email.
                    </p>
                    <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700">
                        <p className="font-medium">✅ {data?.title}</p>
                        <p className="text-green-600 text-xs mt-1">Clôturée le {format(new Date(), 'dd/MM/yyyy à HH:mm')}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 pb-28">
            {/* Header */}
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-6 pt-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-3">
                        <Pen size={24} className="text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">Signature Client</h1>
                    <p className="text-sm text-gray-500 mt-1">{data.tenant.name}</p>
                </div>

                {/* Intervention Summary */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                        <h2 className="text-white font-bold text-lg">{data.title}</h2>
                        {data.description && (
                            <p className="text-blue-100 text-sm mt-1">{data.description}</p>
                        )}
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                            <Building2 size={16} className="text-blue-500 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-gray-900">{data.customer.companyName}</p>
                                <p className="text-xs text-gray-400">{data.customer.contactName}</p>
                            </div>
                        </div>
                        {data.customer.address && (
                            <p className="text-xs text-gray-500 pl-7">{data.customer.address}</p>
                        )}
                        <div className="flex items-center gap-3 text-sm">
                            <User size={16} className="text-indigo-500 flex-shrink-0" />
                            <span className="text-gray-700">Technicien : <strong>{data.employee.name}</strong></span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                            <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                            {format(new Date(data.scheduledStart), 'dd/MM/yyyy')}
                            &nbsp;·&nbsp;
                            <Clock size={14} className="text-gray-400" />
                            {format(new Date(data.scheduledStart), 'HH:mm')} → {format(new Date(data.scheduledEnd), 'HH:mm')}
                        </div>
                    </div>
                </div>

                {/* Tech Report */}
                {data.reportContent && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FileText size={16} className="text-blue-500" />
                            <h3 className="font-bold text-gray-900 text-sm">Rapport du technicien</h3>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.reportContent}</p>

                        {/* Report Photos */}
                        {data.reportPhotos && Array.isArray(data.reportPhotos) && data.reportPhotos.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 gap-2">
                                {data.reportPhotos.map((url, i) => (
                                    <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Signature Pad */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <Pen size={14} className="text-blue-500" />
                            Votre signature
                        </h3>
                        <button
                            onClick={clearSignature}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
                        >
                            <RotateCcw size={12} />
                            Effacer
                        </button>
                    </div>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
                        <SignatureCanvas
                            ref={sigCanvas}
                            canvasProps={{
                                width: 448,
                                height: 200,
                                className: 'w-full touch-none',
                                style: { width: '100%', height: '200px' },
                            }}
                            penColor="#1e293b"
                            onBegin={() => setSignatureEmpty(false)}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                        Signez dans le cadre ci-dessus avec votre doigt ou votre souris
                    </p>
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSign}
                    disabled={submitting || signatureEmpty}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-green-500/30 hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Validation en cours...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={20} />
                            Valider & Clôturer
                        </>
                    )}
                </button>

                <p className="text-xs text-gray-400 text-center mt-4">
                    En signant, vous confirmez que l'intervention a été réalisée conformément à vos attentes.
                </p>
            </div>
        </div>
    );
}
