import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import {
    LayoutDashboard,
    Users,
    DollarSign,
    History,
    LogOut,
    ArrowLeft,
    Shield,
    ChevronLeft,
    ChevronRight,
    Clock,
    Settings,
    Key
} from 'lucide-react';

interface NavItem {
    icon: React.ReactNode;
    label: string;
    path: string;
}

export default function SuperAdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);

    const navItems: NavItem[] = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/superadmin' },
        { icon: <Users size={20} />, label: 'Clients', path: '/superadmin/tenants' },
        { icon: <DollarSign size={20} />, label: 'Revenus', path: '/superadmin/revenue' },
        { icon: <Clock size={20} />, label: 'Sessions', path: '/superadmin/sessions' },
        { icon: <History size={20} />, label: 'Journal', path: '/superadmin/logs' },
        { icon: <Settings size={20} />, label: 'Paramètres', path: '/superadmin/settings' },
        { icon: <Key size={20} />, label: 'Intégrations', path: '/superadmin/integrations' }
    ];

    useEffect(() => {
        // Check if SuperAdmin is logged in
        const token = localStorage.getItem('superadmin_token');
        if (!token) {
            navigate('/superadmin/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('superadmin_token');
        navigate('/superadmin/login');
    };

    const handleBackToSite = () => {
        // If we have a regular manager token, go back to dashboard
        const managerToken = localStorage.getItem('token');
        if (managerToken) {
            navigate('/dashboard');
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-100">
            {/* Sidebar - Dark Red Theme */}
            <aside
                className={clsx(
                    'fixed top-0 left-0 h-full bg-gradient-to-b from-slate-900 to-red-900 text-white transition-all duration-300 z-50',
                    collapsed ? 'w-16' : 'w-64'
                )}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-red-800/50">
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <Shield className="text-red-400" size={28} />
                            <span className="font-bold text-lg">SuperAdmin</span>
                        </div>
                    )}
                    {collapsed && <Shield className="text-red-400 mx-auto" size={24} />}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-1.5 hover:bg-red-800/50 rounded-lg transition"
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                                    isActive
                                        ? 'bg-red-700/50 text-white'
                                        : 'text-gray-300 hover:bg-red-800/30 hover:text-white'
                                )}
                            >
                                {item.icon}
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-red-800/50 space-y-1">
                    <button
                        onClick={handleBackToSite}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-800/30 hover:text-white transition"
                    >
                        <ArrowLeft size={20} />
                        {!collapsed && <span>Retour au site</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-800/30 hover:text-white transition"
                    >
                        <LogOut size={20} />
                        {!collapsed && <span>Déconnexion</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={clsx(
                'flex-1 transition-all duration-300',
                collapsed ? 'ml-16' : 'ml-64'
            )}>
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-40 flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                            <Shield size={14} />
                            GOD MODE
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900">
                            {navItems.find(item => item.path === location.pathname)?.label || 'SuperAdmin'}
                        </h1>
                    </div>
                    <span className="text-sm text-gray-500">
                        {new Date().toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </span>
                </header>

                {/* Page Content */}
                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
