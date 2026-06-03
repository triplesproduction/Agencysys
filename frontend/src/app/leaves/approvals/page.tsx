'use client';

import { PageHeader } from '@/components/common/PageHeader';
import { useState, useEffect } from 'react';
import { Check, X, Calendar, Clock, Search, RefreshCw, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import DatePicker from '@/components/common/DatePicker';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
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

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LeaveApprovalsPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const router = useRouter();
    const [leaves, setLeaves] = useState<LeaveWithEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

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
            logger.error('Error', 'Failed to load leaves:', err);
            setLeaves([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (!authEmployee || !['ADMIN'].includes(authEmployee.roleId || '')) {
                router.push('/dashboard');
                setLoading(false);
                return;
            }
            fetchLeaves();
        }
    }, [authLoading, authEmployee, router]);

    const handleAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (!authEmployee) return;
        setProcessingId(id);
        try {
            await api.approveLeave(id, status, authEmployee.id);
            await fetchLeaves();
        } catch (err) {
            logger.error('Error', `Failed to ${status.toLowerCase()} leave:`, err);
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
        
        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate);
        const matchDate = (!startDate || lEnd >= new Date(startDate)) && 
                          (!endDate || lStart <= new Date(endDate));
                          
        return matchSearch && matchStatus && matchDate;
    });

    const pendingCount = leaves.filter(l => l.status === 'PENDING').length;

    if (authLoading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <div className="page-root fade-in">

            {/* Header Tier 1: Title & Refresh */}
            <PageHeader
                title="Leave Approvals"
                subtitle={<p className="subtitle">Review and manage team leave requests.</p>}
                actions={
                    pendingCount > 0 ? (
                        <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', borderRadius: '8px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 8px #F59E0B' }} />
                            {pendingCount} Pending
                        </div>
                    ) : null
                }
            />

            {/* Filter Toolbar */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'nowrap', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)', overflowX: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' }}>
                    <label className="input-label" style={{ margin: 0 }}>Search Employee</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px 10px 36px', color: 'white', outline: 'none', width: '100%', fontSize: '0.875rem', height: '42px' }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '140px' }}>
                    <label className="input-label" style={{ margin: 0 }}>Status Filter</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '10px 36px 10px 14px', color: 'white', outline: 'none', width: '100%', fontSize: '0.875rem', height: '42px', cursor: 'pointer', appearance: 'none' }}
                        >
                            <option value="">All Statuses</option>
                            <option value="PENDING">Pending Only</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                        <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}><DatePicker label="From Date" value={startDate} onChange={setStartDate} /></div>
                <div style={{ flex: 1, minWidth: '130px' }}><DatePicker label="To Date" value={endDate} onChange={setEndDate} /></div>
                <button onClick={() => fetchLeaves()} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '0 16px', color: 'var(--purple-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 600, height: '42px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> Refresh
                </button>
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
                            <GlassCard key={leave.id} style={{ padding: '16px 20px', overflow: 'hidden' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(200px, 1.5fr) auto', gap: '24px', alignItems: 'center' }}>
                                    
                                    {/* Left: Name Layout (Intact) */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '50%',
                                            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1rem', fontWeight: 700, color: 'var(--purple-main)', flexShrink: 0
                                        }}>
                                            {empName.charAt(0)}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{empName}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {empDept} · {empRole}
                                            </div>
                                        </div>
                                        <span className={`status-badge submitted`} style={{ marginLeft: '4px', flexShrink: 0 }}>
                                            {leave.leaveType}
                                        </span>
                                    </div>

                                    {/* Middle: Details (Compact) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} />
                                                {new Date(leave.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(leave.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>{days} day{days !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            &ldquo;{leave.reason}&rdquo;
                                        </div>
                                    </div>

                                    {/* Right: Status & Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span className={`status-badge ${leave.status.toLowerCase()}`}>
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
