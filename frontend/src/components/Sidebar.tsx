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
    ChevronRight,
    Megaphone 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import './Sidebar.css';

// Centralized navigation configurations dictated by Role
type NavItem = { name: string, href?: string, icon?: any, isGroup?: boolean };

const RoleNavItems: Record<string, NavItem[]> = {
    ADMIN: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Projects', href: '/projects', icon: Briefcase },
        { name: 'Task Allocation', href: '/tasks', icon: CheckSquare },
        { name: 'EOD Reviews', href: '/eod/reviews', icon: FileText },
        { name: 'Attendance', href: '/attendance', icon: CalendarDays },
        { name: 'Employee Management', href: '/employees', icon: UserPlus },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Announcements', href: '/broadcast', icon: Megaphone },
        { name: 'Leave Approvals', href: '/leaves/approvals', icon: CalendarDays },
        { name: 'Rule Book', href: '/rulebook', icon: BookOpen },
    ],
    MANAGER: [
        { name: 'Team Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Projects', href: '/projects', icon: Briefcase },
        { name: 'Team Tasks', href: '/tasks', icon: CheckSquare },
        { name: 'Apply Leave', href: '/leaves', icon: CalendarDays },
        { name: 'Work Logs', href: '/logs', icon: Clock },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Announcements', href: '/broadcast', icon: Megaphone },
    ],
    EMPLOYEE: [
        { name: 'My Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Projects', href: '/projects', icon: Briefcase },
        { name: 'My Tasks', href: '/tasks', icon: CheckSquare },
        { name: 'Submit EOD', href: '/eod', icon: FileText },
        { name: 'Messaging', href: '/messaging', icon: MessageSquare },
        { name: 'Announcements', href: '/broadcast', icon: Megaphone },
        { name: 'Work Log', href: '/logs', icon: Clock },
        { name: 'Attendance', href: '/attendance', icon: CalendarDays },
        { name: 'Company Rulebook', href: '/rulebook', icon: BookOpen },
        { name: 'Apply Leave', href: '/leaves', icon: CalendarDays },
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

    // Real-time unread message count
    useEffect(() => {
        if (!employee?.id) return;

        const fetchUnread = async () => {
            try {
                const count = await api.getUnreadCount(String(employee.id));
                setUnreadCount(count);
            } catch { /* silent */ }
        };

        fetchUnread();

        // 1. Listen for local read events (from the same user on this device)
        const handleLocalRead = () => fetchUnread();
        window.addEventListener('messagesMarkedRead', handleLocalRead);

        // 2. Poll every 10s as a robust fallback
        const interval = setInterval(fetchUnread, 10000);

        // 3. Subscribe to message changes (new messages or status updates from others)
        const channel = supabase
            .channel('sidebar-unread-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                },
                () => {
                    fetchUnread();
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('messagesMarkedRead', handleLocalRead);
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [employee?.id]);

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        signOut();
    };

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
                                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                                    <span className="logo-text" style={{ fontSize: '1.4rem' }}>TripleS <span className="logo-os">OS</span></span>
                                    <span style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Internal Agency Software</span>
                                </div>
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
                                const isActive = item.href === '/messaging'
                                    ? pathname === '/messaging'
                                    : item.href === '/dashboard'
                                        ? pathname === '/dashboard'
                                        : pathname?.startsWith(item.href || '');

                            return (
                                    <li key={item.name}>
                                        <Link href={item.href || '#'} prefetch={false} scroll={false} className={`nav-link ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
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
                            <div className="avatar">
                                {employee.profilePhoto ? (
                                    <img src={employee.profilePhoto} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                                ) : (
                                    firstInitial
                                )}
                            </div>
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
                            <div className="avatar"></div>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}