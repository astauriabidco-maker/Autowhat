import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import clsx from 'clsx';
import {
    LayoutDashboard,
    Users,
    Clock,
    Receipt,
    FolderOpen,
    Settings,
    LogOut,
    MessageCircle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import SiteSelector from './components/SiteSelector';

interface NavItem {
    icon: React.ReactNode;
    label: string;
    path: string;
}

const navItems: NavItem[] = [
    { icon: <LayoutDashboard size={20} />, label: 'Vue d\'ensemble', path: '/dashboard' },
    { icon: <Users size={20} />, label: 'Équipe', path: '/employees' },
    { icon: <Clock size={20} />, label: 'Présences', path: '/attendance' },
    { icon: <Receipt size={20} />, label: 'Note de Frais', path: '/expenses' },
    { icon: <FolderOpen size={20} />, label: 'Documents', path: '/documents' },
    { icon: <Settings size={20} />, label: 'Paramètres', path: '/settings' },
];

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [user, setUser] = useState<{ name: string; tenant: string } | null>(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside
                className={clsx(
                    'fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-50',
                    collapsed ? 'w-16' : 'w-64'
                )}
            >
                {/* Logo */}
                <div className={clsx(
                    'h-16 flex items-center border-b border-gray-200 px-4',
                    collapsed ? 'justify-center' : 'justify-between'
                )}>
                    <Link to="/dashboard" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <MessageCircle size={18} className="text-white" />
                        </div>
                        {!collapsed && (
                            <span className="font-bold text-gray-900 text-lg">WhatsPoint</span>
                        )}
                    </Link>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={clsx(
                            'p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition',
                            collapsed && 'hidden'
                        )}
                    >
                        <ChevronLeft size={18} />
                    </button>
                </div>

                {/* User Info */}
                {user && !collapsed && (
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.tenant}</p>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                                    collapsed && 'justify-center'
                                )}
                                title={collapsed ? item.label : undefined}
                            >
                                <span className={clsx(isActive && 'text-blue-600')}>
                                    {item.icon}
                                </span>
                                {!collapsed && (
                                    <span className="text-sm">{item.label}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Collapse Toggle (when collapsed) */}
                {collapsed && (
                    <button
                        onClick={() => setCollapsed(false)}
                        className="mx-auto mb-2 p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                        <ChevronRight size={18} />
                    </button>
                )}

                {/* Logout */}
                <div className="border-t border-gray-200 p-2">
                    <button
                        onClick={handleLogout}
                        className={clsx(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-gray-600 hover:bg-red-50 hover:text-red-600 transition',
                            collapsed && 'justify-center'
                        )}
                        title={collapsed ? 'Déconnexion' : undefined}
                    >
                        <LogOut size={20} />
                        {!collapsed && <span className="text-sm">Déconnexion</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={clsx(
                'flex-1 transition-all duration-300',
                collapsed ? 'ml-16' : 'ml-64'
            )}>
                {/* Top Bar */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">
                            {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Site Selector - Multi-sites */}
                        <SiteSelector />
                        <span className="text-sm text-gray-500">{new Date().toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</span>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
