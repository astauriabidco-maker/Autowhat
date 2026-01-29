import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import clsx from 'clsx';
import axios from 'axios';
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
    ChevronRight,
    AlertTriangle,
    X,
    Shield
} from 'lucide-react';
import SiteSelector from './components/SiteSelector';
import TrialBanner from './components/TrialBanner';
import NotificationBell from './components/NotificationBell';
import LanguageSwitcher from './components/LanguageSwitcher';

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
    const [tenantInfo, setTenantInfo] = useState<{ plan?: string; trialEndsAt?: string | null; maxEmployees?: number } | null>(null);

    // Support Mode - SuperAdmin Impersonation
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedTenant, setImpersonatedTenant] = useState<string | null>(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
        // Fetch tenant info for trial banner
        const fetchTenantInfo = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('/api/tenant/info', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTenantInfo(res.data);
            } catch (e) {
                console.log('Could not fetch tenant info');
            }
        };
        fetchTenantInfo();
    }, []);

    // Check for impersonation mode on mount and route changes
    useEffect(() => {
        const checkImpersonation = () => {
            const originalToken = sessionStorage.getItem('superadmin_original_token');
            const tenantName = sessionStorage.getItem('impersonated_tenant_name');
            console.log('🔍 Checking impersonation:', { originalToken: !!originalToken, tenantName });
            if (originalToken && tenantName) {
                setIsImpersonating(true);
                setImpersonatedTenant(tenantName);
            } else {
                setIsImpersonating(false);
                setImpersonatedTenant(null);
            }
        };

        // Check immediately
        checkImpersonation();

        // Listen for storage changes (in case another tab modifies it)
        window.addEventListener('storage', checkImpersonation);

        return () => {
            window.removeEventListener('storage', checkImpersonation);
        };
    }, [location.pathname]);

    const handleExitSupportMode = () => {
        const originalToken = sessionStorage.getItem('superadmin_original_token');
        if (originalToken) {
            // Restore SuperAdmin token
            localStorage.setItem('superadmin_token', originalToken);
            localStorage.removeItem('token');
            sessionStorage.removeItem('superadmin_original_token');
            sessionStorage.removeItem('impersonated_tenant_name');

            // Redirect to SuperAdmin dashboard
            navigate('/superadmin/tenants');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Also clear impersonation data
        sessionStorage.removeItem('superadmin_original_token');
        sessionStorage.removeItem('impersonated_tenant_name');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* SUPPORT MODE BANNER - Red fixed bar at top */}
            {isImpersonating && (
                <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-4">
                    <AlertTriangle size={18} />
                    <span className="font-medium">
                        ⚠️ MODE SUPPORT : Vous agissez au nom de <strong>{impersonatedTenant}</strong>
                    </span>
                    <button
                        onClick={handleExitSupportMode}
                        className="ml-4 px-3 py-1 bg-white text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition flex items-center gap-1"
                    >
                        <X size={14} />
                        Quitter le mode support
                    </button>
                </div>
            )}

            <div className={clsx("flex-1 flex", isImpersonating && "mt-10")}>
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

                    {/* God Mode Link - Only for SuperAdmins */}
                    {localStorage.getItem('superadmin_token') && (
                        <div className="border-t border-gray-200 p-2">
                            <Link
                                to="/superadmin"
                                className={clsx(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-amber-600 hover:bg-amber-50 transition',
                                    collapsed && 'justify-center'
                                )}
                                title={collapsed ? 'God Mode' : undefined}
                            >
                                <Shield size={20} />
                                {!collapsed && <span className="text-sm font-medium">God Mode</span>}
                            </Link>
                        </div>
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
                    'flex-1 transition-all duration-300 flex flex-col',
                    collapsed ? 'ml-16' : 'ml-64'
                )}>
                    {/* Trial Banner - Above TopBar */}
                    {tenantInfo && (
                        <TrialBanner
                            plan={tenantInfo.plan}
                            trialEndsAt={tenantInfo.trialEndsAt}
                        />
                    )}

                    {/* Top Bar */}
                    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">
                                {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Notification Bell */}
                            <NotificationBell />

                            {/* Language Switcher */}
                            <LanguageSwitcher />

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
        </div>
    );
}

