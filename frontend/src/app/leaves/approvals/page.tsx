'use client';

import { useState, useEffect } from 'react';
import { Check, X, Calendar, Clock, Search, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import '../Leaves.css';

interface LeaveWithEmployee {
    id: string;
    employeeId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: string;
    appliedAt: string;
    employee?: {
        id: string;
        firstName: string;
        lastName: string;
        department: string | null;
        roleId: string;
    };
}

const STATUS_COLOR: Record<string, { color: string; bg: string; border: string }> = {
    PENDING: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
    APPROVED: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
    REJECTED: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
    CANCELLED: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
};

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function LeaveApprovalsPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const router = useRouter();
    const [leaves, setLeaves] = useState<LeaveWithEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const fetchLeaves = async () => {
        if (!authEmployee) {
            if (!authLoading) setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await api.getLeaves();
            const normalizedData = Array.isArray(data) ? data : [];
            // Sort pending first, then by date applied
            (normalizedData as LeaveWithEmployee[]).sort((a, b) => {
                if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
                if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
                return new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime();
            });
            setLeaves(normalizedData as LeaveWithEmployee[]);
        } catch (err) {
            console.error('Failed to load leaves:', err);
            setLeaves([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (!authEmployee || !['ADMIN', 'MANAGER'].includes(authEmployee.roleId || '')) {
                router.push('/dashboard');
                setLoading(false);
                return;
            }
            fetchLeaves();
        }
    }, [authLoading, authEmployee, router]);

    const handleAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        setProcessingId(id);
        try {
            await api.approveLeave(id, status);
            await fetchLeaves();
        } catch (err) {
            console.error(`Failed to ${status.toLowerCase()} leave:`, err);
            alert(`Failed to ${status.toLowerCase()} leave request.`);
        } finally {
            setProcessingId(null);
        }
    };

    const getDayCount = (start: string, end: string) => {
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    };

    const filtered = leaves.filter(l => {
        const empName = l.employee ? `${l.employee.firstName} ${l.employee.lastName}`.toLowerCase() : l.employeeId.toLowerCase();
        const dept = l.employee?.department?.toLowerCase() || '';
        const q = search.toLowerCase();
        const matchSearch = empName.includes(q) || dept.includes(q) || l.leaveType.toLowerCase().includes(q);
        const matchStatus = !filterStatus || l.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const pendingCount = leaves.filter(l => l.status === 'PENDING').length;

    return (
        <div className="main-content fade-in" style={{ padding: '24px 24px 40px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={26} style={{ color: 'var(--purple-main)' }} /> Leave Approvals
                        {pendingCount > 0 && (
                            <span style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '3px 12px', fontSize: '0.8rem', color: '#F59E0B', fontWeight: 600 }}>
                                {pendingCount} pending
                            </span>
                        )}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.9rem' }}>
                        Review and manage employee time-off requests.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '9px 14px 9px 36px', color: 'white', outline: 'none', width: '200px', fontSize: '0.85rem' }}
                        />
                    </div>
                    <select
                        value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                    >
                        <option value="" style={{ color: 'black' }}>All Status</option>
                        <option value="PENDING" style={{ color: 'black' }}>Pending</option>
                        <option value="APPROVED" style={{ color: 'black' }}>Approved</option>
                        <option value="REJECTED" style={{ color: 'black' }}>Rejected</option>
                    </select>
                    <button onClick={fetchLeaves} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', color: 'var(--purple-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 500 }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton-pulse" style={{ height: '100px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)' }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <GlassCard style={{ padding: '64px', textAlign: 'center' }}>
                    <Calendar size={48} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '16px' }} />
                    <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>No Leave Requests Found</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {search || filterStatus ? 'No results matching your filters.' : 'No employees have submitted leave requests yet.'}
                    </p>
                </GlassCard>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filtered.map(leave => {
                        const empName = leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : leave.employeeId;
                        const empDept = leave.employee?.department || 'No Department';
                        const empRole = leave.employee?.roleId?.replace(/_/g, ' ') || '';
                        const statusCfg = STATUS_COLOR[leave.status] || STATUS_COLOR.PENDING;
                        const days = getDayCount(leave.startDate, leave.endDate);
                        const isProcessing = processingId === leave.id;

                        return (
                            <GlassCard key={leave.id} style={{ padding: '18px 22px', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    {/* Left: Employee info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1rem', fontWeight: 700, color: 'var(--purple-main)'
                                            }}>
                                                {empName.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>{empName}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                    {empDept} · {empRole}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                                                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                                                color: '#A78BFA', marginLeft: '4px'
                                            }}>
                                                {leave.leaveType}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                <Calendar size={14} />
                                                {new Date(leave.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(leave.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                                {days} day{days !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', margin: '0 0 4px', lineHeight: '1.5' }}>
                                            &ldquo;{leave.reason}&rdquo;
                                        </p>

                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
                                            Applied {new Date(leave.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>

                                    {/* Right: Status + Actions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', minWidth: '140px' }}>
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 700, padding: '4px 14px', borderRadius: '12px',
                                            background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
                                            textTransform: 'uppercase', letterSpacing: '0.04em'
                                        }}>
                                            {leave.status}
                                        </span>

                                        {leave.status === 'PENDING' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleAction(leave.id, 'APPROVED')}
                                                    disabled={isProcessing}
                                                    style={{
                                                        background: '#10B981', border: 'none', color: 'white',
                                                        padding: '7px 14px', borderRadius: '8px',
                                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '5px',
                                                        fontSize: '0.78rem', fontWeight: 600,
                                                        opacity: isProcessing ? 0.6 : 1, transition: 'opacity 0.2s'
                                                    }}
                                                >
                                                    <Check size={14} /> Approve
                                                </button>
                                                <button
                                                    onClick={() => handleAction(leave.id, 'REJECTED')}
                                                    disabled={isProcessing}
                                                    style={{
                                                        background: '#EF4444', border: 'none', color: 'white',
                                                        padding: '7px 14px', borderRadius: '8px',
                                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '5px',
                                                        fontSize: '0.78rem', fontWeight: 600,
                                                        opacity: isProcessing ? 0.6 : 1, transition: 'opacity 0.2s'
                                                    }}
                                                >
                                                    <X size={14} /> Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
