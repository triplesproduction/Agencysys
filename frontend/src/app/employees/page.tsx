'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Download, Upload, MoreVertical, Trash2, Mail, Phone, UserX, UserCheck, Eye } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { EmployeeDTO } from '@/types/dto';
import { getUserFromToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import CreateEmployeeModal from '@/components/employees/CreateEmployeeModal';
import EmployeeProfileDrawer from '@/components/employees/EmployeeProfileDrawer';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import './Employees.css';

export default function EmployeesPage() {
    const router = useRouter();
    const { addNotification } = useNotifications();
    const { employee: authEmployee, loading: authLoading } = useAuth();

    // Data State
    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ... (Filter & Pagination State) ...
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const limit = 50; // Optimized limit for faster rendering

    // Modals & Panels State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDTO | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search only
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    // Single clean fetch effect
    useEffect(() => {
        if (authLoading) return; // Wait for auth initialization
        
        if (!authEmployee) {
            setLoading(false);
            return;
        }

        if (!authEmployee.roleId?.toUpperCase().includes('ADMIN')) {
            router.push('/dashboard');
            setLoading(false);
            return;
        }

        let cancelled = false;
        const doFetch = async () => {
            setLoading(true);
            try {
                const res = await api.getEmployees({
                    page,
                    limit,
                    search: debouncedSearch || undefined,
                    roleId: roleFilter || undefined,
                    department: deptFilter || undefined,
                    status: statusFilter || undefined,
                });
                if (cancelled) return;
                const employeeData = res?.data || (Array.isArray(res) ? res : []);
                setEmployees(employeeData || []);
                setTotal(res?.total ?? (employeeData?.length || 0));
                setError('');
            } catch (err: any) {
                if (!cancelled) setError(err.message || 'Error fetching employees');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [page, debouncedSearch, roleFilter, deptFilter, statusFilter, refreshKey, authEmployee, authLoading, router]);

    useEffect(() => {
        const handleProfileUpdate = (e: any) => {
            const { employeeId, profilePhoto } = e.detail;
            setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, profilePhoto } : emp));
        };
        window.addEventListener('app:profile-updated', handleProfileUpdate);
        return () => window.removeEventListener('app:profile-updated', handleProfileUpdate);
    }, []);

    const handleViewProfile = async (emp: EmployeeDTO) => {
        // Fetch full employee details including documents, tasks, etc.
        try {
            const fullEmp = await api.getEmployeeById(emp.id);
            setSelectedEmployee(fullEmp);
        } catch (err) {
            console.error('Failed to fetch full employee profile:', err);
            setSelectedEmployee(emp); // Fallback to partial data from the list
        }
        setIsDrawerOpen(true);
    };

    const handleToggleStatus = async (emp: EmployeeDTO, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        const newStatus = emp.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        const label = newStatus === 'ACTIVE' ? 'Activated' : 'Suspended';
        try {
            // Optimistic update
            setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e));
            await api.updateEmployeeStatus(emp.id, newStatus);
            addNotification({ title: 'Status Updated', message: `${emp.firstName} is now ${newStatus.toLowerCase()}.`, type: 'SUCCESS', metadata: null });
        } catch (err: any) {
            // Revert on failure
            setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: emp.status } : e));
            addNotification({ title: 'Update Failed', message: err.message || 'Could not update status.', type: 'ERROR', metadata: null });
        }
    };

    const handleDeleteEmployee = async (emp: EmployeeDTO, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        if (!confirm(`Permanently delete ${emp.firstName} ${emp.lastName}? This will remove their login account and all associated data (Tasks, EODs, etc.) across the entire system. This cannot be undone.`)) return;
        try {
            // Optimistic update
            setEmployees(prev => prev.filter(e => e.id !== emp.id));
            setTotal(prev => prev - 1);
            await api.deleteEmployee(emp.id);
            addNotification({ title: 'Account Deleted', message: `All records and the login account for ${emp.firstName} ${emp.lastName} have been permanently removed.`, type: 'SUCCESS', metadata: null });
        } catch (err: any) {
            // Revert: restore employee back into list
            setEmployees(prev => [emp, ...prev]);
            setTotal(prev => prev + 1);
            addNotification({ title: 'Deletion Blocked', message: err.message || 'System was unable to remove this record.', type: 'ERROR', metadata: null });
        }
    };

    return (
        <div className="main-content fade-in" style={{ padding: '0 24px 40px 24px' }}>
            <div className="emp-page-header-alt">
                <div className="emp-count-block">
                    <h1>{(total || 0)} Employees</h1>
                    <div className="emp-count-stats">
                        <span><div className="dot active"></div> Active {(employees || []).filter(e => e && e.status === 'ACTIVE').length}</span>
                        <span><div className="dot inactive"></div> Inactive {(employees || []).filter(e => e && e.status !== 'ACTIVE').length}</span>
                    </div>
                </div>
                <div className="emp-actions-group">
                    <button className="secondary-button hoverable" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Upload size={16} /> Import
                    </button>
                    <button className="secondary-button hoverable" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={16} /> Export
                    </button>
                    <button
                        className="primary-button hoverable"
                        onClick={() => setIsCreateModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--purple-main)' }}
                    >
                        <Plus size={16} /> Add Employee
                    </button>
                </div>
            </div>

            <GlassCard className="datagrid-container" style={{ padding: 0, overflow: 'visible' }}>
                {/* Advanced Filter Bar */}
                <div className="datagrid-toolbar" style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: 'var(--radius-sm)' }}>
                        <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '12px' }} />
                        <input
                            type="text"
                            placeholder="Search by Name, ID, or Email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                        />
                    </div>

                    <select className="filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
                        <option value="">All Roles</option>
                        <option value="ADMIN">Administrator</option>
                        <option value="MANAGER">Manager</option>
                        <option value="WEBSITE_DEVELOPER">Web Developer</option>
                        <option value="GRAPHIC_DESIGNER">Graphic Designer</option>
                        <option value="VIDEO_EDITOR">Video Editor</option>
                    </select>

                    <select className="filter-select" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}>
                        <option value="">All Departments</option>
                        <option value="Development">Development</option>
                        <option value="Creative">Creative</option>
                        <option value="Operations">Operations</option>
                    </select>

                    <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                        <option value="">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="ON_LEAVE">On Leave</option>
                        <option value="TERMINATED">Terminated</option>
                    </select>
                </div>

                <div style={{ padding: '24px' }}>
                    {/* Data Grid */}
                    {loading && (!employees || employees.length === 0) ? (
                        <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                            Loading Enterprise Directory...
                        </div>
                    ) : error ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: '#EF4444' }}>{error}</div>
                    ) : !employees || employees.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>No personnel matching query vectors found.</div>
                    ) : (
                        <div className="emp-card-grid">
                            {(employees || []).map((emp) => (
                                <div
                                    key={emp.id}
                                    className="emp-card"
                                    onClick={() => handleViewProfile(emp)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && handleViewProfile(emp)}
                                    aria-label={`View profile: ${emp.firstName} ${emp.lastName}`}
                                >
                                    <div className="emp-card-header">
                                        <div className="emp-card-profile">
                                            <div className="emp-card-avatar">
                                                {emp.profilePhoto ? <img src={emp.profilePhoto} alt="pic" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : emp.firstName.charAt(0)}
                                                <div className={`emp-card-status ${emp.status === 'ACTIVE' ? 'active' : emp.status === 'ON_LEAVE' ? 'leave' : 'inactive'}`}></div>
                                            </div>
                                            <div>
                                                <h3 className="emp-card-name">{emp.firstName} {emp.lastName}</h3>
                                                <p className="emp-card-role">{emp.roleId.replace(/_/g, ' ')}</p>
                                            </div>
                                        </div>
                                        {/* ⋮ Action Menu */}
                                        <div ref={openMenuId === emp.id ? menuRef : undefined} style={{ position: 'relative', zIndex: 10 }}>
                                            <button
                                                className="emp-card-menu-btn"
                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === emp.id ? null : emp.id); }}
                                                title="Actions"
                                                aria-label="Employee actions menu"
                                            >
                                                <MoreVertical size={20} />
                                            </button>

                                            {openMenuId === emp.id && (
                                                <div style={{
                                                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                                                    background: 'rgba(18, 18, 22, 0.97)', border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '12px', padding: '6px', minWidth: '180px',
                                                    boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15)',
                                                    backdropFilter: 'blur(20px)', zIndex: 999,
                                                    animation: 'fadeIn 0.12s ease'
                                                }}>
                                                    {/* View Profile */}
                                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleViewProfile(emp); }} style={{ width: '100%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 500, transition: 'background 0.15s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                        <Eye size={15} style={{ color: '#3B82F6' }} /> View Profile
                                                    </button>

                                                    {/* Toggle Active/Inactive */}
                                                    <button onClick={(e) => handleToggleStatus(emp, e)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 500, transition: 'background 0.15s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                        {emp.status === 'ACTIVE'
                                                            ? <><UserX size={15} style={{ color: '#F59E0B' }} /> Set Inactive</>
                                                            : <><UserCheck size={15} style={{ color: '#10B981' }} /> Set Active</>}
                                                    </button>

                                                    {/* Divider */}
                                                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />

                                                    {/* Delete */}
                                                    <button onClick={(e) => handleDeleteEmployee(emp, e)} style={{ width: '100%', background: 'transparent', border: 'none', color: '#EF4444', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 500, transition: 'background 0.15s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                        <Trash2 size={15} /> Delete Employee
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="emp-card-body">
                                        <div>
                                            <div className="emp-card-meta-label">Department</div>
                                            <div className="emp-card-meta-value">{emp.department || 'General'}</div>
                                        </div>
                                        <div>
                                            <div className="emp-card-meta-label">Hired Date</div>
                                            <div className="emp-card-meta-value">{emp.joinedAt ? new Date(emp.joinedAt).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="emp-card-footer">
                                        <div className="emp-card-contact">
                                            <Mail size={16} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email}</span>
                                        </div>
                                        <div className="emp-card-contact">
                                            <Phone size={16} />
                                            <span>{emp.phone || 'N/A'}</span>
                                        </div>

                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </GlassCard>

            {/* Modals */}
            {isCreateModalOpen && <CreateEmployeeModal onClose={() => { setIsCreateModalOpen(false); setRefreshKey(k => k + 1); }} />}
            {isDrawerOpen && selectedEmployee && <EmployeeProfileDrawer employee={selectedEmployee} onClose={() => setIsDrawerOpen(false)} />}
        </div>
    );
}
