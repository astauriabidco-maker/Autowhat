import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    MessageSquare,
    Plus,
    Send,
    Loader2,
    AlertCircle,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowLeft
} from 'lucide-react';

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    _count?: { messages: number };
}

interface TicketMessage {
    id: string;
    content: string;
    senderId: string;
    isAdmin: boolean;
    createdAt: string;
}

interface TicketDetail extends Ticket {
    messages: TicketMessage[];
    user: { id: string; name: string };
}

export default function Support() {
    const [searchParams] = useSearchParams();
    const targetTicketId = searchParams.get('ticket') || searchParams.get('ticketId');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [sending, setSending] = useState(false);
    const [replyText, setReplyText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Form state
    const [form, setForm] = useState({
        subject: '',
        priority: 'NORMAL',
        message: ''
    });

    const getToken = () => localStorage.getItem('token');

    useEffect(() => {
        fetchTickets();
    }, []);

    useEffect(() => {
        if (loading || !targetTicketId) return;
        let cancelled = false;

        const fetchTargetTicket = async () => {
            try {
                const res = await axios.get(`/api/tickets/${targetTicketId}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (!cancelled) setSelectedTicket(res.data);
            } catch (error) {
                console.error('Error fetching ticket:', error);
            }
        };

        fetchTargetTicket();

        return () => {
            cancelled = true;
        };
    }, [loading, targetTicketId]);

    useEffect(() => {
        if (selectedTicket) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedTicket?.messages]);

    const fetchTickets = async () => {
        try {
            const res = await axios.get('/api/tickets', {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setTickets(res.data);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTicketDetail = async (id: string) => {
        try {
            const res = await axios.get(`/api/tickets/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setSelectedTicket(res.data);
        } catch (error) {
            console.error('Error fetching ticket:', error);
        }
    };

    const handleCreate = async () => {
        if (!form.subject || !form.message) return;

        setSending(true);
        try {
            await axios.post('/api/tickets', form, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setShowModal(false);
            setForm({ subject: '', priority: 'NORMAL', message: '' });
            fetchTickets();
        } catch (error) {
            console.error('Error creating ticket:', error);
        } finally {
            setSending(false);
        }
    };

    const handleReply = async () => {
        if (!replyText.trim() || !selectedTicket) return;

        setSending(true);
        try {
            await axios.post(`/api/tickets/${selectedTicket.id}/reply`, {
                message: replyText
            }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setReplyText('');
            fetchTicketDetail(selectedTicket.id);
            fetchTickets();
        } catch (error) {
            console.error('Error replying:', error);
        } finally {
            setSending(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'OPEN': 'bg-blue-100 text-blue-700',
            'IN_PROGRESS': 'bg-yellow-100 text-yellow-700',
            'RESOLVED': 'bg-green-100 text-green-700',
            'CLOSED': 'bg-gray-100 text-gray-700'
        };
        const labels: Record<string, string> = {
            'OPEN': 'Ouvert',
            'IN_PROGRESS': 'En cours',
            'RESOLVED': 'Résolu',
            'CLOSED': 'Fermé'
        };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.OPEN}`}>
                {labels[status] || status}
            </span>
        );
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'OPEN': return <AlertCircle className="text-blue-500" size={16} />;
            case 'IN_PROGRESS': return <Clock className="text-yellow-500" size={16} />;
            case 'RESOLVED': return <CheckCircle2 className="text-green-500" size={16} />;
            case 'CLOSED': return <XCircle className="text-gray-500" size={16} />;
            default: return <AlertCircle className="text-blue-500" size={16} />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    // Ticket Detail View
    if (selectedTicket) {
        return (
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 p-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedTicket(null)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-lg font-semibold text-gray-900">{selectedTicket.subject}</h1>
                            <p className="text-sm text-gray-500">Ticket #{selectedTicket.id.slice(0, 8)}</p>
                        </div>
                        {getStatusBadge(selectedTicket.status)}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {selectedTicket.messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}
                        >
                            <div className={`max-w-[70%] rounded-lg p-3 ${msg.isAdmin
                                    ? 'bg-blue-100 text-blue-900'
                                    : 'bg-white border border-gray-200 text-gray-900'
                                }`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {msg.isAdmin && (
                                        <span className="text-xs font-medium text-blue-700">🎧 Support</span>
                                    )}
                                    <span className="text-xs text-gray-500">
                                        {new Date(msg.createdAt).toLocaleString('fr-FR')}
                                    </span>
                                </div>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Reply Box */}
                {selectedTicket.status !== 'CLOSED' && (
                    <div className="bg-white border-t border-gray-200 p-4">
                        <div className="flex gap-2">
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Votre message..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                                rows={2}
                            />
                            <button
                                onClick={handleReply}
                                disabled={!replyText.trim() || sending}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Tickets List View
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Support</h1>
                    <p className="text-gray-500 mt-1">Besoin d'aide ? Contactez notre équipe</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                    <Plus size={18} />
                    Ouvrir un ticket
                </button>
            </div>

            {/* Tickets List */}
            {tickets.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <MessageSquare className="mx-auto text-gray-300 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun ticket</h3>
                    <p className="text-gray-500 mb-4">Vous n'avez pas encore ouvert de ticket de support</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                        Créer un ticket
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Sujet</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ID</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map(ticket => (
                                <tr
                                    key={ticket.id}
                                    id={`support-ticket-${ticket.id}`}
                                    onClick={() => fetchTicketDetail(ticket.id)}
                                    className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition ${targetTicketId === ticket.id ? 'bg-red-50 ring-2 ring-inset ring-red-300' : ''
                                        }`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(ticket.status)}
                                            <span className="font-medium text-gray-900">{ticket.subject}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                                        #{ticket.id.slice(0, 8)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-4 py-3">
                                        {getStatusBadge(ticket.status)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-lg mx-4">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">Nouveau Ticket</h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                                <input
                                    type="text"
                                    value={form.subject}
                                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                                    placeholder="Résumez votre problème"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                                <select
                                    value={form.priority}
                                    onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                >
                                    <option value="LOW">Basse</option>
                                    <option value="NORMAL">Normale</option>
                                    <option value="URGENT">Urgente</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    value={form.message}
                                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                                    placeholder="Décrivez votre problème en détail"
                                    rows={5}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!form.subject || !form.message || sending}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? <Loader2 className="animate-spin" size={18} /> : 'Envoyer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
