'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Clock,
    FileText,
    Menu,
    X,
    LogOut,
    Users,
    UserPlus, // Added for Employee Management
    Briefcase,
    Wallet,
    CreditCard,
    RefreshCcw,
    RefreshCw,
    UserCircle,
    Settings,
    CheckSquare,
    ShieldAlert,
    MessageSquare,
    CalendarDays,
    TrendingUp,
    BookOpen,
    ChevronLeft, // Added for collapse
    ChevronRight // Added for expand
} from 'lucide-react';
import { getUserFromToken, clearAuthToken } from '@/lib/auth';
import './Sidebar.css';

// Centralized navigation configurations dictated by Role
type NavItem = { name: string, href?: string, icon?: any, isGroup?: boolean };

const RoleNavItems: Record<string, NavItem[]> = {
    ADMIN: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Task Allocation', href: '/tasks', icon: CheckSquare },
        { name: 'Employee Management', href: '/employees', icon: UserPlus },
        { name: 'Leave Approvals', href: '/leaves/approvals', icon: CalendarDays },
        { name: 'EOD Reviews', href: '/eod/reviews', icon: FileText },
        { name: 'System Logs', href: '/logs/system', icon: Clock },
        { name: 'Permissions', href: '/permissions', icon: ShieldAlert },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Announcements', href: '/messaging/broadcast', icon: MessageSquare },
        { name: 'Rule Book', href: '/wiki', icon: BookOpen },
    ],
    MANAGER: [
        { name: 'Team Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Team Tasks', href: '/tasks', icon: CheckSquare },
        { name: 'Leave Review', href: '/leaves', icon: ShieldAlert },
        { name: 'Work Logs', href: '/logs', icon: Clock },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Project Notes', href: '/notes', icon: FileText },
    ],
    EMPLOYEE: [
        { name: 'My Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'My Tasks', href: '/tasks', icon: CheckSquare },
        { name: 'Submit EOD', href: '/eod', icon: FileText },
        { name: 'Work Log', href: '/logs', icon: Clock },
        { name: 'Apply Leave', href: '/leaves', icon: CalendarDays },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Company Rulebook', href: '/rulebook', icon: BookOpen },
    ]
};

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false); // New state for desktop collapse
    const [user, setUser] = useState<{ employeeId?: string, roleId?: string, firstName?: string, lastName?: string } | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const decoded = getUserFromToken();
        if (decoded) {
            // Support both standard JWT Claims and custom DTO formats
            let rawRole = decoded.role || decoded.roleId || '';
            rawRole = rawRole.toUpperCase();

            // Fallback for concatenated role bugs
            if (rawRole.includes('ADMIN')) rawRole = 'ADMIN';
            else if (rawRole.includes('MANAGER')) rawRole = 'MANAGER';

            setUser({
                employeeId: decoded.sub || decoded.employeeId,
                roleId: rawRole,
                firstName: decoded.firstName,
                lastName: decoded.lastName
            });
        }
    }, [pathname]); // Re-check when route changes

    const handleLogout = () => {
        clearAuthToken();
        router.push('/login');
    };

    useEffect(() => {
        // Sync the sidebar width to CSS root for layout padding transitions
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '80px' : '280px');
        }
    }, [isCollapsed]);

    if (pathname === '/login') return null; // Don't show sidebar on login

    return (
        <>
            {/* Mobile Hamburger Button */}
            <button className="mobile-menu-btn" onClick={() => setIsOpen(true)}>
                <Menu size={24} />
            </button>

            {/* Mobile Overlay */}
            {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}

            <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        {/* Desktop Collapse Toggle */}
                        <button className="collapse-toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
                            <Menu size={20} />
                        </button>
                        {!isCollapsed && <span className="logo-icon"></span>}
                        {!isCollapsed && <span className="logo-text">TripleS <span className="logo-os">OS</span></span>}
                    </div>
                    {/* Mobile Close Button */}
                    <button className="mobile-close-btn" onClick={() => setIsOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <ul>
                        {!isMounted ? (
                            // Skeleton loaders while mounting
                            [1, 2, 3, 4, 5, 6].map((i) => (
                                <li key={`skeleton-${i}`} style={{ padding: '8px 16px' }}>
                                    <div className="skeleton-pulse" style={{ height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}></div>
                                </li>
                            ))
                        ) : (
                            (user?.roleId && RoleNavItems[user.roleId] ? RoleNavItems[user.roleId] : RoleNavItems.EMPLOYEE).map((item, index) => {
                                if (item.isGroup) {
                                    return (
                                        !isCollapsed && <div key={`group-${index}`} className="nav-group">
                                            {item.name}
                                        </div>
                                    );
                                }

                                const Icon = item.icon;
                                // Dashboard is exact match, others are prefix match to keep active state when viewing details
                                const isActive = item.href === '/dashboard'
                                    ? pathname === '/dashboard'
                                    : pathname?.startsWith(item.href || '');

                                return (
                                    <li key={item.name}>
                                        <Link href={item.href || '#'} className={`nav-link ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)} title={isCollapsed ? item.name : undefined}>
                                            {Icon && <Icon className="nav-icon" size={20} />}
                                            {!isCollapsed && <span>{item.name}</span>}
                                        </Link>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    {user ? (
                        <div className={`user-profile ${isCollapsed ? 'collapsed-profile' : ''}`}>
                            <div className="avatar">{user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}</div>
                            {!isCollapsed && (
                                <>
                                    <div className="user-info">
                                        <div className="user-name">{user.firstName} {user.lastName}</div>
                                        <div className="user-role">{user.roleId || 'Role'}</div>
                                    </div>
                                    <button className="logout-btn" onClick={handleLogout} title="Logout">
                                        <LogOut size={18} />
                                    </button>
                                </>
                            )}
                            {isCollapsed && (
                                <button className="logout-btn collapsed-logout" onClick={handleLogout} title="Logout">
                                    <LogOut size={16} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className={`user-profile skeleton-pulse ${isCollapsed ? 'collapsed-profile' : ''}`}>
                            <div className="avatar">...</div>
                            {!isCollapsed && (
                                <div className="user-info">
                                    <div className="user-name">Loading...</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
