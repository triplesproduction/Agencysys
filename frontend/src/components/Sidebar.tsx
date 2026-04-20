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
    UserPlus,
    Briefcase,
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
    ChevronLeft,
    ChevronRight 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import './Sidebar.css';

// Centralized navigation configurations dictated by Role
type NavItem = { name: string, href?: string, icon?: any, isGroup?: boolean };

const RoleNavItems: Record<string, NavItem[]> = {
    ADMIN: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Projects', href: '/projects', icon: Briefcase },
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
        { name: 'Projects', href: '/projects', icon: Briefcase },
        { name: 'Team Tasks', href: '/tasks', icon: CheckSquare },
        { name: 'Apply Leave', href: '/leaves', icon: CalendarDays },
        { name: 'Work Logs', href: '/logs', icon: Clock },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Project Notes', href: '/notes', icon: FileText },
    ],
    EMPLOYEE: [
        { name: 'My Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Projects', href: '/projects', icon: Briefcase },
        { name: 'My Tasks', href: '/tasks', icon: CheckSquare },
        { name: 'Submit EOD', href: '/eod', icon: FileText },
        { name: 'Work Log', href: '/logs', icon: Clock },
        { name: 'Apply Leave', href: '/leaves', icon: CalendarDays },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Company Rulebook', href: '/rulebook', icon: BookOpen },
    ]
};

export default function Sidebar() {
    const { employee, signOut } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Poll unread message count every 30s
    useEffect(() => {
        if (!employee?.id) return;
        const fetchUnread = async () => {
            try {
                const count = await api.getUnreadCount(String(employee.id));
                setUnreadCount(count);
            } catch { /* silent */ }
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [employee?.id]);

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        signOut();
    };

    // Auto-collapse sidebar on tasks page, expand on others
    useEffect(() => {
        if (pathname === '/tasks') {
            setIsCollapsed(true);
        } else {
            setIsCollapsed(false);
        }
    }, [pathname]);



    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '80px' : '280px');
        }
    }, [isCollapsed]);

    if (!isMounted) return null;
    if (pathname === '/login') return null;

    const fullName = employee ? `${employee.firstName} ${employee.lastName}` : 'User';
    const firstInitial = employee?.firstName?.charAt(0).toUpperCase() || 'U';

    return (
        <>
            <button className="mobile-menu-btn" onClick={() => setIsOpen(true)}>
                <Menu size={24} />
            </button>

            {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}

            <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <button className="collapse-toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
                            <Menu size={20} />
                        </button>
                        {!isCollapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <img src="/logo.png" alt="Logo" style={{ width: '44px', height: '44px', minWidth: '44px' }} />
                                <span className="logo-text" style={{ fontSize: '1.4rem' }}>TripleS <span className="logo-os">OS</span></span>
                            </div>
                        )}
                        {isCollapsed && (
                            <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', margin: '8px 0' }} />
                        )}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <ul>
                        {(() => {
                            let roleKey = (employee?.roleId || 'EMPLOYEE').toUpperCase();
                            if (roleKey.includes('ADMIN')) roleKey = 'ADMIN';
                            else if (roleKey.includes('MANAGER')) roleKey = 'MANAGER';
                            
                            const navItems = RoleNavItems[roleKey] || RoleNavItems.EMPLOYEE;
                            
                            return navItems.map((item, index) => {
                                if (item.isGroup) {
                                    return (
                                        !isCollapsed && <div key={`group-${index}`} className="nav-group">
                                            {item.name}
                                        </div>
                                    );
                                }

                                const Icon = item.icon;
                                const isActive = item.href === '/dashboard'
                                    ? pathname === '/dashboard'
                                    : pathname?.startsWith(item.href || '');

                            return (
                                    <li key={item.name}>
                                        <Link href={item.href || '#'} className={`nav-link ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
                                            {Icon && <Icon className="nav-icon" size={20} />}
                                            {!isCollapsed && <span>{item.name}</span>}
                                            {/* Unread messages badge */}
                                            {item.href === '/messaging' && unreadCount > 0 && (
                                                <span style={{
                                                    marginLeft: isCollapsed ? 0 : 'auto',
                                                    minWidth: '18px',
                                                    height: '18px',
                                                    background: 'var(--purple-main)',
                                                    borderRadius: '9px',
                                                    padding: '0 5px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 0 8px rgba(124,58,237,0.5)',
                                                    position: isCollapsed ? 'absolute' : 'relative',
                                                    top: isCollapsed ? '4px' : 'auto',
                                                    right: isCollapsed ? '4px' : 'auto',
                                                    animation: 'pulse 2s infinite',
                                                }}>
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            });
                        })()}
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    {employee ? (
                        <div className={`user-profile ${isCollapsed ? 'collapsed-profile' : ''}`}>
                            <div className="avatar">{firstInitial}</div>
                            {!isCollapsed && (
                                <>
                                    <div className="user-info">
                                        <div className="user-name">{fullName}</div>
                                        <div className="user-role">{(employee.roleId || 'Employee').toUpperCase()}</div>
                                    </div>
                                    <button className="logout-btn" onClick={handleLogout}>
                                        <LogOut size={18} />
                                    </button>
                                </>
                            )}
                            {isCollapsed && (
                                <button className="logout-btn collapsed-logout" onClick={handleLogout}>
                                    <LogOut size={16} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="user-profile skeleton-pulse">
                            <div className="avatar">...</div>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
