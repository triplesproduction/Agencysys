'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Download, Upload, MoreVertical, Trash2, Mail, Phone, UserX, UserCheck, Eye, CreditCard, Users, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { EmployeeDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import CreateEmployeeModal from '@/components/employees/CreateEmployeeModal';
import EmployeeProfileDrawer from '@/components/employees/EmployeeProfileDrawer';
import PayrollHub from '@/components/employees/PayrollHub';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import './Employees.css';

export default function EmployeesPage() {
    const router = useRouter();
    const { addNotification } = useNotifications();
    const { employee: authEmployee, loading: authLoading } = useAuth();

    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const limit = 50;

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDTO | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'DIRECTORY' | 'PAYROLL'>('DIRECTORY');
    const menuRef = useRef<HTMLDivElement>(null);

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
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        if (authLoading) return;
        if (!authEmployee) { setLoading(false); return; }
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
                    page, limit,
                    search: debouncedSearch || undefined,
                    roleId: roleFilter || undefined,
                    department: deptFilter || undefined,
                    status: statusFilter || undefined,
                    excludeAdmin: true,
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
        try {
            const fullEmp = await api.getEmployeeById(emp.id);
            setSelectedEmployee(fullEmp);
        } catch {
            setSelectedEmployee(emp);
        }
        setIsDrawerOpen(true);
    };

    const handleToggleStatus = async (emp: EmployeeDTO, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        const newStatus = emp.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        try {
            setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e));
            await api.updateEmployeeStatus(emp.id, newStatus);
            addNotification({ title: 'Status Updated', message: `${emp.firstName} is now ${newStatus.toLowerCase()}.`, type: 'SUCCESS', metadata: null });
        } catch (err: any) {
            setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: emp.status } : e));
            addNotification({ title: 'Update Failed', message: err.message || 'Could not update status.', type: 'ERROR', metadata: null });
        }
    };

    const handleDeleteEmployee = async (emp: EmployeeDTO, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        if (!confirm(`Permanently delete ${emp.firstName} ${emp.lastName}? This cannot be undone.`)) return;
        try {
            setEmployees(prev => prev.filter(e => e.id !== emp.id));
            setTotal(prev => prev - 1);
            await api.deleteEmployee(emp.id);
            addNotification({ title: 'Account Deleted', message: `${emp.firstName} ${emp.lastName} removed.`, type: 'SUCCESS', metadata: null });
        } catch (err: any) {
            setEmployees(prev => [emp, ...prev]);
            setTotal(prev => prev + 1);
            addNotification({ title: 'Deletion Blocked', message: err.message || 'Could not remove this record.', type: 'ERROR', metadata: null });
        }
    };

    const handleExportCSV = () => {
        if (employees.length === 0) return;
        const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Department', 'Status', 'Joined Date'];
        const csvContent = [
            headers.join(','),
            ...employees.map(emp => [
                emp.firstName, emp.lastName || '', emp.email, emp.phone || '',
                emp.roleId, emp.department || 'General', emp.status,
                emp.joinedAt ? new Date(emp.joinedAt).toLocaleDateString() : ''
            ].map(v => `"${v}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `TripleS_Employees_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification({ title: 'Export Complete', message: 'Employee directory exported to CSV.', type: 'SUCCESS' });
    };

    const activeCount = employees.filter(e => e.status === 'ACTIVE').length;

    const statusClass = (status: string) => {
        if (status === 'ACTIVE') return 'approved';
        if (status === 'ON_LEAVE') return 'pending';
        return 'rejected';
    };

    return (
        <div className="emp-page-root fade-in">

            {/* ── PAGE HEADER ── */}
            <div className="emp-header">
                <div>
                    <h1 className="emp-title">Enterprise Personnel</h1>
                    <div className="emp-stats-inline">
                        <span><Users size={13} /> {total} Total</span>
                        <span className="active"><CheckCircle size={13} /> {activeCount} Active</span>
                    </div>
                </div>
                <div className="emp-header-actions">
                    <button className="emp-action-btn" onClick={handleExportCSV}>
                        <Download size={16} /> Export
                    </button>
                    <button className="emp-action-btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                        <Plus size={16} /> Add Employee
                    </button>
                </div>
            </div>

            {/* ── TOP TABS ── */}
            <div className="emp-tabs">
                <button
                    className={`emp-tab ${activeView === 'DIRECTORY' ? 'active' : ''}`}
                    onClick={() => setActiveView('DIRECTORY')}
                >
                    <Users size={16} /> Personnel Directory
                </button>
                <button
                    className={`emp-tab ${activeView === 'PAYROLL' ? 'active' : ''}`}
                    onClick={() => setActiveView('PAYROLL')}
                >
                    <CreditCard size={16} /> Integrated Payroll
                </button>
            </div>

            {/* ── CONTENT ── */}
            {activeView === 'DIRECTORY' ? (
                <div className="emp-directory fade-in">
                    {/* Search & Filters row */}
                    <div className="emp-toolbar">
                        <div className="emp-search">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, email..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="emp-filters">
                            <select className="filter-select" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
                                <option value="">All Roles</option>
                                <option value="MANAGER">Manager</option>
                                <option value="WEBSITE_DEVELOPER">Web Developer</option>
                                <option value="GRAPHIC_DESIGNER">Graphic Designer</option>
                                <option value="VIDEO_EDITOR">Video Editor</option>
                            </select>
                            <select className="filter-select" value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
                                <option value="">All Departments</option>
                                <option value="Development">Development</option>
                                <option value="Creative">Creative</option>
                                <option value="Operations">Operations</option>
                                <option value="Human Resources">Human Resources</option>
                            </select>
                            <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                                <option value="">All Statuses</option>
                                <option value="ACTIVE">Active</option>
                                <option value="SUSPENDED">Suspended</option>
                                <option value="ON_LEAVE">On Leave</option>
                                <option value="TERMINATED">Terminated</option>
                            </select>
                        </div>
                    </div>

                    {/* Employee List */}
                    <div className="emp-list-container custom-scrollbar">
                        {loading && employees.length === 0 ? (
                            <div className="emp-state-msg">
                                <div className="spinner" />
                                <span>Loading personnel...</span>
                            </div>
                        ) : error ? (
                            <div className="emp-state-msg error">{error}</div>
                        ) : employees.length === 0 ? (
                            <div className="emp-state-msg">No employees match your search.</div>
                        ) : (
                            <table className="emp-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Role</th>
                                        <th>Department</th>
                                        <th>Contact</th>
                                        <th>Joined</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => (
                                        <tr
                                            key={emp.id}
                                            className="emp-row"
                                            onClick={() => handleViewProfile(emp)}
                                        >
                                            {/* Avatar + Name */}
                                            <td>
                                                <div className="emp-row-identity">
                                                    <div className="emp-row-avatar">
                                                        {emp.profilePhoto
                                                            ? <img src={emp.profilePhoto} alt="" />
                                                            : emp.firstName.charAt(0)
                                                        }
                                                        <span className={`emp-dot ${emp.status === 'ACTIVE' ? 'active' : emp.status === 'ON_LEAVE' ? 'leave' : 'inactive'}`} />
                                                    </div>
                                                    <div>
                                                        <div className="emp-row-name">{emp.firstName} {emp.lastName}</div>
                                                        <div className="emp-row-id">#{emp.id?.slice(0, 8)}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role */}
                                            <td>
                                                <span className="emp-role-chip">{emp.roleId.replace(/_/g, ' ')}</span>
                                            </td>

                                            {/* Department */}
                                            <td className="emp-dept">{emp.department || 'General'}</td>

                                            {/* Contact */}
                                            <td>
                                                <div className="emp-contact-col">
                                                    <span><Mail size={12} /> {emp.email}</span>
                                                    {emp.phone && <span><Phone size={12} /> {emp.phone}</span>}
                                                </div>
                                            </td>

                                            {/* Joined */}
                                            <td className="emp-joined">
                                                {emp.joinedAt ? new Date(emp.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                            </td>

                                            {/* Status */}
                                            <td>
                                                <span className={`status-badge ${statusClass(emp.status)}`}>
                                                    {emp.status.replace('_', ' ')}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td onClick={e => e.stopPropagation()}>
                                                <div ref={openMenuId === emp.id ? menuRef : undefined} className="emp-menu-wrap">
                                                    <button
                                                        className="emp-menu-btn"
                                                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === emp.id ? null : emp.id); }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {openMenuId === emp.id && (
                                                        <div className="emp-dropdown">
                                                            <button onClick={e => { e.stopPropagation(); setOpenMenuId(null); handleViewProfile(emp); }}>
                                                                <Eye size={14} /> View Profile
                                                            </button>
                                                            <button onClick={e => handleToggleStatus(emp, e)}>
                                                                {emp.status === 'ACTIVE'
                                                                    ? <><UserX size={14} /> Set Inactive</>
                                                                    : <><UserCheck size={14} /> Set Active</>}
                                                            </button>
                                                            <div className="emp-dropdown-divider" />
                                                            <button className="danger" onClick={e => handleDeleteEmployee(emp, e)}>
                                                                <Trash2 size={14} /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : (
                <div className="fade-in" style={{ flex: 1, minHeight: 0, marginTop: '8px', display: 'flex', flexDirection: 'column' }}>
                    <PayrollHub employees={employees} />
                </div>
            )}

            {isCreateModalOpen && (
                <CreateEmployeeModal
                    isOpen={true}
                    addNotification={addNotification}
                    onClose={() => { setIsCreateModalOpen(false); setRefreshKey(k => k + 1); }}
                />
            )}
            {isDrawerOpen && selectedEmployee && (
                <EmployeeProfileDrawer
                    employee={selectedEmployee}
                    onClose={() => setIsDrawerOpen(false)}
                    onRefresh={() => setRefreshKey(k => k + 1)}
                />
            )}
        </div>
    );
}
