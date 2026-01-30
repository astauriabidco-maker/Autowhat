import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Globe,
    DollarSign,
    Save,
    Trash2,
    Loader2,
    AlertCircle,
    Check,
    RefreshCw
} from 'lucide-react';

interface Region {
    code: string;
    name: string;
    currency: string;
    flag: string;
}

interface PlanPricing {
    price: number;
    currency: string;
    stripePriceId: string;
    regionalPricingId: string | null;
}

interface MatrixRow {
    planId: string;
    planName: string;
    maxEmployees: number;
    isPopular: boolean;
    pricing: Record<string, PlanPricing>;
}

interface MatrixResponse {
    regions: Region[];
    matrix: MatrixRow[];
}

export default function PricingMatrix() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [regions, setRegions] = useState<Region[]>([]);
    const [matrix, setMatrix] = useState<MatrixRow[]>([]);

    // Edit state
    const [editCell, setEditCell] = useState<{ planId: string; regionCode: string } | null>(null);
    const [editValues, setEditValues] = useState<{ price: string; stripePriceId: string }>({ price: '', stripePriceId: '' });

    const fetchMatrix = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('superadmin_token');
            const res = await axios.get<MatrixResponse>('/admin/pricing/matrix', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRegions(res.data.regions);
            setMatrix(res.data.matrix);
        } catch (err) {
            console.error('Error fetching pricing matrix:', err);
            setError('Erreur lors du chargement de la matrice tarifaire');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatrix();
    }, []);

    const getCurrencySymbol = (currency: string) => {
        const symbols: Record<string, string> = {
            'EUR': '€',
            'USD': '$',
            'XOF': 'FCFA',
            'GBP': '£'
        };
        return symbols[currency] || currency;
    };

    const handleEditStart = (planId: string, regionCode: string, currentPricing: PlanPricing | undefined) => {
        setEditCell({ planId, regionCode });
        setEditValues({
            price: currentPricing?.price?.toString() || '',
            stripePriceId: currentPricing?.stripePriceId || ''
        });
    };

    const handleEditCancel = () => {
        setEditCell(null);
        setEditValues({ price: '', stripePriceId: '' });
    };

    const handleSave = async () => {
        if (!editCell) return;

        const region = regions.find(r => r.code === editCell.regionCode);
        if (!region) return;

        if (!editValues.price || !editValues.stripePriceId) {
            setError('Prix et ID Stripe requis');
            return;
        }

        try {
            setSaving(`${editCell.planId}-${editCell.regionCode}`);
            setError(null);

            const token = localStorage.getItem('superadmin_token');
            await axios.put('/admin/pricing/regional', {
                planId: editCell.planId,
                countryCode: editCell.regionCode,
                price: parseFloat(editValues.price),
                currency: region.currency,
                stripePriceId: editValues.stripePriceId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess('Prix mis à jour avec succès');
            setTimeout(() => setSuccess(null), 3000);

            handleEditCancel();
            fetchMatrix();
        } catch (err) {
            console.error('Error saving regional pricing:', err);
            setError('Erreur lors de la sauvegarde');
        } finally {
            setSaving(null);
        }
    };

    const handleDelete = async (planId: string, regionCode: string, regionalPricingId: string) => {
        if (!confirm('Supprimer ce prix régional ? Le plan utilisera le prix par défaut.')) return;

        try {
            setSaving(`${planId}-${regionCode}`);
            const token = localStorage.getItem('superadmin_token');
            await axios.delete(`/admin/pricing/regional/${regionalPricingId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess('Prix régional supprimé');
            setTimeout(() => setSuccess(null), 3000);
            fetchMatrix();
        } catch (err) {
            console.error('Error deleting regional pricing:', err);
            setError('Erreur lors de la suppression');
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px',
                color: '#64748b'
            }}>
                <Loader2 size={32} className="animate-spin" />
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '0.5rem'
                    }}>
                        <Globe size={28} style={{ display: 'inline', marginRight: '0.75rem', verticalAlign: 'middle' }} />
                        Matrice Tarifaire Internationale
                    </h1>
                    <p style={{ color: '#64748b' }}>
                        Configurez les prix par zone géographique et devise
                    </p>
                </div>
                <button
                    onClick={fetchMatrix}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: '0.5rem',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}
                >
                    <RefreshCw size={18} />
                    Rafraîchir
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
                    color: '#dc2626'
                }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {success && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
                    color: '#16a34a'
                }}>
                    <Check size={20} />
                    {success}
                </div>
            )}

            {/* Legend */}
            <div style={{
                display: 'flex',
                gap: '2rem',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '0.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, background: '#e2e8f0', borderRadius: 2 }} />
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Prix par défaut (base)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, background: '#dbeafe', borderRadius: 2 }} />
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Prix régional configuré</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        💡 Cliquez sur une cellule pour modifier le prix
                    </span>
                </div>
            </div>

            {/* Matrix Table */}
            <div style={{
                background: 'white',
                borderRadius: '1rem',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                <th style={{
                                    padding: '1rem',
                                    textAlign: 'left',
                                    fontWeight: 600,
                                    color: '#475569',
                                    borderBottom: '2px solid #e2e8f0',
                                    position: 'sticky',
                                    left: 0,
                                    background: '#f8fafc',
                                    zIndex: 1
                                }}>
                                    Plan
                                </th>
                                {regions.map(region => (
                                    <th key={region.code} style={{
                                        padding: '1rem',
                                        textAlign: 'center',
                                        fontWeight: 600,
                                        color: '#475569',
                                        borderBottom: '2px solid #e2e8f0',
                                        minWidth: '180px'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '1.25rem' }}>{region.flag}</span>
                                            <span>{region.name}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                {getCurrencySymbol(region.currency)}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.map(row => (
                                <tr key={row.planId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{
                                        padding: '1rem',
                                        fontWeight: 600,
                                        color: '#1e293b',
                                        position: 'sticky',
                                        left: 0,
                                        background: 'white',
                                        zIndex: 1
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {row.planName}
                                            {row.isPopular && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '0.15rem 0.4rem',
                                                    background: '#dbeafe',
                                                    color: '#2563eb',
                                                    borderRadius: '0.25rem'
                                                }}>
                                                    Populaire
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                            Max {row.maxEmployees} employés
                                        </div>
                                    </td>

                                    {regions.map(region => {
                                        const pricing = row.pricing[region.code];
                                        const basePricing = row.pricing['BASE'];
                                        const isEditing = editCell?.planId === row.planId && editCell?.regionCode === region.code;
                                        const isSaving = saving === `${row.planId}-${region.code}`;
                                        const hasRegionalPrice = !!pricing?.regionalPricingId;

                                        return (
                                            <td key={region.code} style={{
                                                padding: '0.75rem',
                                                textAlign: 'center',
                                                background: hasRegionalPrice ? '#f0f9ff' : 'transparent'
                                            }}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <input
                                                            type="number"
                                                            value={editValues.price}
                                                            onChange={e => setEditValues({ ...editValues, price: e.target.value })}
                                                            placeholder="Prix"
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem',
                                                                border: '2px solid #3b82f6',
                                                                borderRadius: '0.375rem',
                                                                fontSize: '0.9rem',
                                                                textAlign: 'center'
                                                            }}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editValues.stripePriceId}
                                                            onChange={e => setEditValues({ ...editValues, stripePriceId: e.target.value })}
                                                            placeholder="price_xxx"
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '0.375rem',
                                                                fontSize: '0.75rem',
                                                                fontFamily: 'monospace'
                                                            }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button
                                                                onClick={handleSave}
                                                                disabled={isSaving}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '0.4rem',
                                                                    background: '#3b82f6',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '0.375rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                            </button>
                                                            <button
                                                                onClick={handleEditCancel}
                                                                style={{
                                                                    padding: '0.4rem 0.75rem',
                                                                    background: '#f1f5f9',
                                                                    color: '#64748b',
                                                                    border: 'none',
                                                                    borderRadius: '0.375rem',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => handleEditStart(row.planId, region.code, pricing)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            padding: '0.5rem',
                                                            borderRadius: '0.5rem',
                                                            transition: 'background 0.2s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        {pricing ? (
                                                            <>
                                                                <div style={{
                                                                    fontWeight: 700,
                                                                    fontSize: '1.1rem',
                                                                    color: hasRegionalPrice ? '#2563eb' : '#64748b'
                                                                }}>
                                                                    {pricing.price.toLocaleString()} {getCurrencySymbol(pricing.currency)}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '0.7rem',
                                                                    color: '#94a3b8',
                                                                    fontFamily: 'monospace',
                                                                    marginTop: '0.25rem'
                                                                }}>
                                                                    {pricing.stripePriceId.length > 15
                                                                        ? pricing.stripePriceId.substring(0, 15) + '...'
                                                                        : pricing.stripePriceId
                                                                    }
                                                                </div>
                                                                {hasRegionalPrice && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(row.planId, region.code, pricing.regionalPricingId!);
                                                                        }}
                                                                        style={{
                                                                            marginTop: '0.5rem',
                                                                            padding: '0.25rem 0.5rem',
                                                                            background: '#fee2e2',
                                                                            color: '#dc2626',
                                                                            border: 'none',
                                                                            borderRadius: '0.25rem',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.7rem',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.25rem',
                                                                            margin: '0.5rem auto 0'
                                                                        }}
                                                                    >
                                                                        <Trash2 size={12} />
                                                                        Supprimer
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                                                Utilise base<br />
                                                                <span style={{ fontSize: '0.75rem' }}>
                                                                    ({basePricing?.price} {getCurrencySymbol(basePricing?.currency || 'EUR')})
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info */}
            <div style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '0.75rem'
            }}>
                <h3 style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.75rem' }}>
                    <DollarSign size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Configuration Stripe
                </h3>
                <ul style={{ color: '#a16207', fontSize: '0.9rem', lineHeight: 1.6, margin: 0, paddingLeft: '1.5rem' }}>
                    <li>Créez les prix correspondants dans votre dashboard Stripe (ex: <code style={{ background: '#fef3c7', padding: '0.15rem 0.35rem', borderRadius: '0.25rem' }}>price_eur_medium</code>, <code style={{ background: '#fef3c7', padding: '0.15rem 0.35rem', borderRadius: '0.25rem' }}>price_xof_medium</code>)</li>
                    <li>Copiez l'ID Stripe (format <code style={{ background: '#fef3c7', padding: '0.15rem 0.35rem', borderRadius: '0.25rem' }}>price_xxx</code>) dans le champ correspondant</li>
                    <li>Les visiteurs verront automatiquement le prix de leur zone lors du checkout</li>
                </ul>
            </div>
        </div>
    );
}
