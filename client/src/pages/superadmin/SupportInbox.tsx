import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Inbox,
    Send,
    Loader2,
    CheckCircle2,
    XCircle,
    Headphones
} from 'lucide-react';

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    tenant: { id: string; name: string };
    user: { id: string; name: string; phoneNumber: string };
    _count: { messages: number };
    messages: { content: string; createdAt: string }[];
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
}

interface Stats {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    total: number;
}

export default function SupportInbox() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [filter, setFilter] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const getToken = () => localStorage.getItem('superadmin_token');

    useEffect(() => {
        fetchTickets();
        fetchStats();
    }, [filter]);

    useEffect(() => {
        if (selectedTicket) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedTicket?.messages]);

    const fetchTickets = async () => {
        try {
            const params = filter ? { status: filter } : {};
            const res = await axios.get('/admin/tickets', {
                headers: { Authorization: `Bearer ${getToken()}` },
                params
            });
            setTickets(res.data);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get('/admin/tickets/stats', {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setStats(res.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchTicketDetail = async (id: string) => {
        try {
            const res = await axios.get(`/admin/tickets/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setSelectedTicket(res.data);
        } catch (error) {
            console.error('Error fetching ticket:', error);
        }
    };

    const handleReply = async (markResolved = false) => {
        if (!replyText.trim() || !selectedTicket) return;

        setSending(true);
        try {
            await axios.post(`/admin/tickets/${selectedTicket.id}/reply`, {
                message: replyText,
                markResolved
            }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setReplyText('');
            fetchTicketDetail(selectedTicket.id);
            fetchTickets();
            fetchStats();
        } catch (error) {
            console.error('Error replying:', error);
        } finally {
            setSending(false);
        }
    };

    const handleStatusChange = async (status: string) => {
        if (!selectedTicket) return;

        try {
            await axios.patch(`/admin/tickets/${selectedTicket.id}/status`, { status }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            fetchTicketDetail(selectedTicket.id);
            fetchTickets();
            fetchStats();
        } catch (error) {
            console.error('Error changing status:', error);
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
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || styles.OPEN}`}>
                {labels[status] || status}
            </span>
        );
    };

    const getPriorityBadge = (priority: string) => {
        if (priority === 'URGENT') {
            return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Urgent</span>;
        }
        return null;
    };

    const getTimeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `Il y a ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Il y a ${hours}h`;
        const days = Math.floor(hours / 24);
        return `Il y a ${days}j`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header with Stats */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Inbox Support</h1>
                        <p className="text-gray-500">Gérez les demandes de support client</p>
                    </div>
                    <div className="flex gap-2">
                        {stats && (
                            <>
                                <div className="px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                                    <span className="text-sm text-blue-700 font-medium">{stats.open} Ouverts</span>
                                </div>
                                <div className="px-3 py-1 bg-yellow-50 rounded-lg border border-yellow-100">
                                    <span className="text-sm text-yellow-700 font-medium">{stats.inProgress} En cours</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === status
                                ? 'bg-gray-900 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {status === '' ? 'Tous' :
                                status === 'OPEN' ? 'Ouverts' :
                                    status === 'IN_PROGRESS' ? 'En cours' :
                                        status === 'RESOLVED' ? 'Résolus' : 'Fermés'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Left: Ticket List */}
                <div className="w-80 border-r border-gray-200 flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        {tickets.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                <Inbox className="mx-auto mb-2 text-gray-300" size={32} />
                                Aucun ticket
                            </div>
                        ) : (
                            tickets.map(ticket => (
                                <div
                                    key={ticket.id}
                                    onClick={() => fetchTicketDetail(ticket.id)}
                                    className={`p-3 border-b border-gray-100 cursor-pointer transition hover:bg-gray-50 ${selectedTicket?.id === ticket.id ? 'bg-gray-100' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <span className="font-medium text-gray-900 text-sm truncate flex-1">
                                            {ticket.subject}
                                        </span>
                                        {getPriorityBadge(ticket.priority)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                        <span className="truncate">{ticket.tenant?.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {getStatusBadge(ticket.status)}
                                        <span className="text-xs text-gray-400">{getTimeAgo(ticket.updatedAt)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Conversation */}
                <div className="flex-1 flex flex-col">
                    {selectedTicket ? (
                        <>
                            {/* Ticket Header */}
                            <div className="p-4 border-b border-gray-200 bg-gray-50">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="font-semibold text-gray-900">{selectedTicket.subject}</h2>
                                        <p className="text-sm text-gray-500">
                                            {selectedTicket.tenant?.name} • {selectedTicket.user?.name || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedTicket.status)}
                                        {selectedTicket.status !== 'CLOSED' && (
                                            <select
                                                value={selectedTicket.status}
                                                onChange={e => handleStatusChange(e.target.value)}
                                                className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                                            >
                                                <option value="OPEN">Ouvrir</option>
                                                <option value="IN_PROGRESS">En cours</option>
                                                <option value="RESOLVED">Résolu</option>
                                                <option value="CLOSED">Fermer</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {selectedTicket.messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] rounded-lg p-3 ${msg.isAdmin
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 text-gray-900'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                {msg.isAdmin && <Headphones size={14} />}
                                                <span className={`text-xs ${msg.isAdmin ? 'text-blue-100' : 'text-gray-500'}`}>
                                                    {msg.isAdmin ? 'Support' : selectedTicket.user?.name || 'Client'}
                                                </span>
                                                <span className={`text-xs ${msg.isAdmin ? 'text-blue-100' : 'text-gray-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleString('fr-FR')}
                                                </span>
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Box */}
                            {selectedTicket.status !== 'CLOSED' && (
                                <div className="p-4 border-t border-gray-200 bg-white">
                                    <div className="flex gap-2 mb-2">
                                        <textarea
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            placeholder="Répondre au client..."
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex justify-between">
                                        <button
                                            onClick={() => handleStatusChange('CLOSED')}
                                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                        >
                                            <XCircle size={16} className="inline mr-1" />
                                            Fermer le ticket
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleReply(true)}
                                                disabled={!replyText.trim() || sending}
                                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={16} className="inline mr-1" />
                                                Répondre & Résoudre
                                            </button>
                                            <button
                                                onClick={() => handleReply(false)}
                                                disabled={!replyText.trim() || sending}
                                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                            >
                                                {sending ? <Loader2 className="animate-spin inline" size={16} /> : <Send size={16} className="inline mr-1" />}
                                                Répondre
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <Inbox size={48} className="mx-auto mb-3 text-gray-300" />
                                <p>Sélectionnez un ticket pour voir la conversation</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
