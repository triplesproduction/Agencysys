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
import { useAuth } from '@/hooks/useAuth';
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
    const { employee, signOut } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleLogout = () => {
        signOut();
    };

    useEffect(() => {
        // Sync the sidebar width to CSS root for layout padding transitions
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '80px' : '280px');
        }
    }, [isCollapsed]);

    if (!isMounted) return null;
    if (pathname === '/login') return null;

    const displayRole = (employee?.roleId || 'EMPLOYEE').toUpperCase();
    const fullName = employee ? `${employee.firstName} ${employee.lastName}` : 'User';
    const firstInitial = employee?.firstName?.charAt(0).toUpperCase() || 'U';

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
                        {(employee?.roleId && RoleNavItems[employee.roleId.toUpperCase()] ? RoleNavItems[employee.roleId.toUpperCase()] : RoleNavItems.EMPLOYEE).map((item, index) => {
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
                                    <Link href={item.href || '#'} className={`nav-link ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)} title={isCollapsed ? item.name : undefined}>
                                        {Icon && <Icon className="nav-icon" size={20} />}
                                        {!isCollapsed && <span>{item.name}</span>}
                                    </Link>
                                </li>
                            );
                        })}
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
                                        <div className="user-role">{displayRole}</div>
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
                                    <div className="user-name">Loading Profile...</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
