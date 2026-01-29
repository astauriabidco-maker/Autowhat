import { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertTriangle, MapPin, Clock, DollarSign, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';

interface Notification {
    id: string;
    type: 'LATE' | 'ABSENCE' | 'GEOFENCE' | 'EXPENSE';
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    employeeId?: string;
}

const typeConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
    LATE: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    ABSENCE: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
    GEOFENCE: { icon: MapPin, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    EXPENSE: { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100' }
};

export default function NotificationBell() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get('/api/notifications', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setNotifications(response.data.notifications || []);
            setUnreadCount(response.data.unreadCount || 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    // Initial fetch + polling
    useEffect(() => {
        fetchNotifications();

        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Mark single notification as read
    const markAsRead = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`/api/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            await axios.patch('/api/notifications/read-all', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle notification click
    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            await markAsRead(notification.id);
        }

        // Navigate based on type
        switch (notification.type) {
            case 'LATE':
            case 'ABSENCE':
            case 'GEOFENCE':
                navigate('/dashboard/attendance');
                break;
            case 'EXPENSE':
                navigate('/dashboard/depenses');
                break;
        }

        setIsOpen(false);
    };

    // Format relative time
    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays < 7) return `Il y a ${diffDays}j`;
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    };

    const recentNotifications = notifications.slice(0, 5);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
                <Bell size={22} />

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                        <h3 className="font-bold">🔔 Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    disabled={loading}
                                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition flex items-center gap-1"
                                >
                                    <CheckCheck size={12} />
                                    Tout lire
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/20 rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-80 overflow-y-auto">
                        {recentNotifications.length === 0 ? (
                            <div className="py-8 text-center text-gray-500">
                                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Aucune notification</p>
                            </div>
                        ) : (
                            recentNotifications.map(notification => {
                                const config = typeConfig[notification.type] || typeConfig.LATE;
                                const Icon = config.icon;

                                return (
                                    <button
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={clsx(
                                            'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition flex items-start gap-3',
                                            !notification.isRead && 'bg-blue-50/50'
                                        )}
                                    >
                                        {/* Icon */}
                                        <div className={clsx('p-2 rounded-lg', config.bgColor)}>
                                            <Icon size={16} className={config.color} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={clsx(
                                                    'text-sm font-medium truncate',
                                                    !notification.isRead ? 'text-gray-900' : 'text-gray-600'
                                                )}>
                                                    {notification.title}
                                                </span>
                                                {!notification.isRead && (
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 truncate mt-0.5">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {formatRelativeTime(notification.createdAt)}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 5 && (
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/dashboard/notifications');
                                }}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Voir toutes les notifications →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
