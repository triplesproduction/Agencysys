'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import GlassCard from '@/components/GlassCard';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { api } from '@/lib/api';
import { LeaveApplicationDTO } from '@/types/dto';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import './Leaves.css';
import { useAuth } from '@/context/AuthContext';

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Clock }> = {
    PENDING: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: Clock },
    APPROVED: { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', icon: CheckCircle },
    REJECTED: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', icon: XCircle },
    CANCELLED: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)', icon: AlertCircle },
};

export default function LeavesPage() {
    const { user, loading: authLoading } = useAuth();
    const [leaves, setLeaves] = useState<LeaveApplicationDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form State
    const [leaveType, setLeaveType] = useState('CASUAL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const startDateRef = useRef<HTMLInputElement>(null);
    const endDateRef = useRef<HTMLInputElement>(null);

    const openDatePicker = (ref: React.RefObject<HTMLInputElement>) => {
        if (ref.current) {
            // @ts-ignore - showPicker is a newer standard, fallback to click()
            if (typeof ref.current.showPicker === 'function') {
                ref.current.showPicker();
            } else {
                ref.current.click();
            }
        }
    };

    const fetchLeaves = useCallback(async () => {
        if (!user) return;
        try {
            const data = await api.getMyLeaves(user.id);
            setLeaves(data);
        } catch (err) {
            console.error('Failed to load leaves:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading) {
            fetchLeaves();
        }
    }, [authLoading, fetchLeaves]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!startDate || !endDate || !reason.trim()) {
            setError('Please fill in all required fields.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError('End date cannot be before start date.');
            return;
        }

        setSubmitting(true);
        try {
            await api.applyForLeave({
                leaveType: leaveType as any,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                reason
            });
            // Reset form
            setStartDate('');
            setEndDate('');
            setReason('');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 4000);
            fetchLeaves();
        } catch (err: any) {
            setError(err.message || 'Failed to submit leave application.');
        } finally {
            setSubmitting(false);
        }
    };

    const getDayCount = (start: string, end: string) => {
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    };

    const pendingCount = leaves.filter(l => l.status === 'PENDING').length;
    const approvedCount = leaves.filter(l => l.status === 'APPROVED').length;

    if (authLoading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    return (
        <div className="leaves-page fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <header className="page-header">
                <div>
                    <h1 className="greeting">Leave Management</h1>
                    <p className="subtitle">Apply for time off and track your history.</p>
                </div>
            </header>

            {/* ─── Quick Stats ─── */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <GlassCard style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={18} style={{ color: '#F59E0B' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{pendingCount}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Pending</div>
                    </div>
                </GlassCard>
                <GlassCard style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={18} style={{ color: '#A78BFA' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{approvedCount}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Approved</div>
                    </div>
                </GlassCard>
                <GlassCard style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={18} style={{ color: '#A78BFA' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{leaves.length}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total</div>
                    </div>
                </GlassCard>
            </div>

            {/* ─── Leave Application Form ─── */}
            <GlassCard style={{ padding: '28px' }}>
                <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Apply for Leave</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Leave Type</label>
                        <div className="leave-type-grid">
                            {[
                                { id: 'CASUAL', label: 'Casual', icon: Calendar },
                                { id: 'SICK', label: 'Sick', icon: AlertCircle },
                                { id: 'UNPAID', label: 'Unpaid', icon: Clock },
                            ].map((type) => (
                                <div
                                    key={type.id}
                                    className={`leave-type-card ${leaveType === type.id ? 'active' : ''}`}
                                    onClick={() => !submitting && setLeaveType(type.id)}
                                >
                                    <div className="leave-card-icon">
                                        <type.icon size={20} />
                                    </div>
                                    <span className="leave-card-label">{type.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Start Date</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={submitting}
                                ref={startDateRef}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>End Date</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                disabled={submitting}
                                ref={endDateRef}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Reason</label>
                        <textarea
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', width: '100%', minHeight: '90px', resize: 'vertical', outline: 'none', fontSize: '0.9rem', fontFamily: 'inherit' }}
                            placeholder="Please provide a brief reason..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={submitting}
                        />
                    </div>

                    {error && (
                        <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', color: '#EF4444', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.15)' }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(167,139,250,0.08)', color: '#A78BFA', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', border: '1px solid rgba(167,139,250,0.15)' }}>
                            ✅ Leave request submitted successfully!
                        </div>
                    )}

                    <Button variant="primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
                        {submitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                </form>
            </GlassCard>

            {/* ─── Leave History ─── */}
            <div style={{ marginTop: '28px' }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={20} style={{ color: 'var(--purple-main)' }} />
                    My Leave History
                    {leaves.length > 0 && (
                        <span style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', color: '#A78BFA', fontWeight: 600 }}>
                            {leaves.length}
                        </span>
                    )}
                </h2>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[1, 2].map(i => (
                            <div key={i} className="skeleton-pulse" style={{ height: '72px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)' }} />
                        ))}
                    </div>
                ) : leaves.length === 0 ? (
                    <GlassCard style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏖️</div>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                            No leave applications yet. Submit your first request above!
                        </p>
                    </GlassCard>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {leaves.map(leave => {
                            const isExpanded = expandedId === leave.id;
                            const statusCfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.PENDING;
                            const StatusIcon = statusCfg.icon;
                            const days = getDayCount(leave.startDate, leave.endDate);

                            return (
                                <GlassCard key={leave.id}
                                    style={{
                                        padding: 0, overflow: 'hidden', cursor: 'pointer',
                                        border: isExpanded ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => setExpandedId(isExpanded ? null : leave.id)}
                                >
                                    {/* Summary Row */}
                                    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '38px', height: '38px', borderRadius: '10px',
                                                background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <StatusIcon size={16} style={{ color: statusCfg.color }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>
                                                    {leave.leaveType.charAt(0) + leave.leaveType.slice(1).toLowerCase()} Leave
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    {new Date(leave.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(leave.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {days} day{days !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{
                                                fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: '12px',
                                                background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
                                                textTransform: 'uppercase', letterSpacing: '0.04em'
                                            }}>
                                                {leave.status}
                                            </span>
                                            <ChevronDown size={16} style={{
                                                color: 'var(--text-secondary)',
                                                transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div style={{
                                            borderTop: '1px solid rgba(255,255,255,0.06)',
                                            padding: '16px 20px',
                                            background: 'rgba(0,0,0,0.15)',
                                            display: 'flex', flexDirection: 'column', gap: '10px'
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Start Date</div>
                                                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}>
                                                        {new Date(leave.startDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>End Date</div>
                                                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}>
                                                        {new Date(leave.endDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Reason</div>
                                                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0, background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    {leave.reason}
                                                </p>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                                                Applied on {new Date(leave.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(leave.appliedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                </GlassCard>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
