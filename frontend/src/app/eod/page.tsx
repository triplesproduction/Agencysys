'use client';

import { useState, useEffect, useCallback } from 'react';
import GlassCard from '@/components/GlassCard';
import Button from '@/components/Button';
import { api } from '@/lib/api';
import { CheckSquare, AlertTriangle, Calendar, Clock, ChevronDown, Smile, Meh, Frown } from 'lucide-react';
import './EOD.css';

const SentimentIcon = ({ sentiment }: { sentiment: string }) => {
    if (sentiment === 'GREAT') return <Smile size={14} style={{ color: '#10B981' }} />;
    if (sentiment === 'GOOD') return <Smile size={14} style={{ color: '#3B82F6' }} />;
    if (sentiment === 'OKAY') return <Meh size={14} style={{ color: '#F59E0B' }} />;
    return <Frown size={14} style={{ color: sentiment === 'BAD' ? '#EF4444' : '#991B1B' }} />;
};

const sentimentColor: Record<string, string> = {
    GREAT: '#10B981', GOOD: '#3B82F6', OKAY: '#F59E0B', BAD: '#EF4444', TERRIBLE: '#991B1B'
};

import { EODSubmissionDTO } from '@/types/dto';
import { useAuth } from '@/hooks/useAuth';

export default function EODPage() {
    const { employee: authEmployee, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        tasksCompleted: '',
        blockers: '',
        workHours: '',
    });

    // My past submissions
    const [myReports, setMyReports] = useState<EODSubmissionDTO[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchMyReports = useCallback(async () => {
        if (!authEmployee) {
            if (!authLoading) setReportsLoading(false);
            return;
        }

        try {
            setReportsLoading(true);
            const data = await api.getMyEODs();
            setMyReports(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load my EODs:', err);
            setMyReports([]);
        } finally {
            setReportsLoading(false);
        }
    }, [authEmployee, authLoading]);

    useEffect(() => {
        if (!authLoading) {
            fetchMyReports();
        }
    }, [authLoading, fetchMyReports]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!authEmployee) {
            setError('System is still re-verifying your session. Please wait a moment.');
            return;
        }

        if (!formData.tasksCompleted.trim()) {
            setError('Please list at least one completed task before submitting.');
            return;
        }

        setLoading(true);
        try {
            const empId = authEmployee.id;

            await api.submitEOD({
                employeeId: empId,
                reportDate: new Date().toISOString().split('T')[0],
                tasksCompleted: formData.tasksCompleted.split('\n').filter(t => t && t.trim() !== ''),
                tasksInProgress: [],
                blockers: formData.blockers,
                sentiment: 'GOOD',
            });

            // If work hours were provided, log them via the dedicated endpoint
            const hours = parseFloat(formData.workHours);
            if (!isNaN(hours) && hours > 0) {
                await api.logWorkHours({
                    employeeId: empId,
                    date: new Date().toISOString().split('T')[0],
                    hoursLogged: hours,
                    description: 'EOD Daily Submission',
                });
            }

            setSuccess(true);
            setFormData({ tasksCompleted: '', blockers: '', workHours: '' });
            setTimeout(() => setSuccess(false), 4000);

            // Refresh submissions list immediately
            fetchMyReports();
        } catch (err: any) {
            setError(err.message || 'Submission failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Parse raw text entries from completedText / inProgressText JSON
    const parseRawText = (raw: string | null): string[] => {
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
    };

    const getCompletedItems = (report: EODSubmissionDTO): string[] => {
        if ((report.tasksCompleted as any)?.length > 0 && typeof (report.tasksCompleted as any)[0] === 'object') {
            return (report.tasksCompleted as any).map((t: any) => t.title);
        }
        return Array.isArray(report.tasksCompleted) ? report.tasksCompleted as string[] : parseRawText(report.completedText || null);
    };

    const getInProgressItems = (report: EODSubmissionDTO): string[] => {
        if ((report.tasksInProgress as any)?.length > 0 && typeof (report.tasksInProgress as any)[0] === 'object') {
            return (report.tasksInProgress as any).map((t: any) => t.title);
        }
        return Array.isArray(report.tasksInProgress) ? report.tasksInProgress as string[] : parseRawText(report.inProgressText || null);
    };

    return (
        <div className="eod-page fade-in" style={{ maxWidth: '900px' }}>
            <header className="page-header">
                <div>
                    <h1 className="greeting">End of Day Log</h1>
                    <p className="subtitle">Submit your daily execution summary.</p>
                </div>
            </header>

            {/* ─── Submission Form ─── */}
            <div className="form-container">
                <GlassCard className="eod-card">
                    <form onSubmit={handleSubmit} className="eod-form">

                        <div className="form-group">
                            <label className="input-label">Tasks Completed</label>
                            <textarea
                                className="glass-textarea"
                                rows={4}
                                placeholder="List what you accomplished today (one per line)..."
                                value={formData.tasksCompleted}
                                onChange={e => setFormData({ ...formData, tasksCompleted: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Any Blockers?</label>
                            <textarea
                                className="glass-textarea"
                                rows={3}
                                placeholder="List any impediments to your work..."
                                value={formData.blockers}
                                onChange={e => setFormData({ ...formData, blockers: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Total Work Hours Logged</label>
                            <input
                                type="number"
                                className="glass-textarea"
                                style={{ padding: '0.75rem 1rem', height: 'auto', minHeight: 'unsized' }}
                                min="0" step="0.5" max="24"
                                placeholder="Eg. 8.5"
                                value={formData.workHours}
                                onChange={e => setFormData({ ...formData, workHours: e.target.value })}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>These hours will be billed dynamically to your timesheet record.</p>
                        </div>

                        <div className="form-actions">
                            <Button type="submit" disabled={loading} className="submit-btn" size="lg">
                                {loading ? 'Submitting...' : 'Submit EOD'}
                            </Button>
                        </div>

                        {error && (
                            <div className="error-message" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 69, 58, 0.1)', color: '#ff453a', borderRadius: 'var(--radius-sm)' }}>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="success-message">
                                ✅ EOD Report submitted successfully!
                            </div>
                        )}
                    </form>
                </GlassCard>
            </div>

            {/* ─── My Past Submissions ─── */}
            <div style={{ marginTop: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={20} style={{ color: 'var(--purple-main)' }} />
                        My Submissions
                        {myReports.length > 0 && (
                            <span style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', color: '#A78BFA', fontWeight: 600 }}>
                                {myReports.length}
                            </span>
                        )}
                    </h2>
                </div>

                {reportsLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[1, 2].map(i => (
                            <div key={i} className="skeleton-pulse" style={{ height: '80px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)' }} />
                        ))}
                    </div>
                ) : myReports.length === 0 ? (
                    <GlassCard style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                            No submissions yet. Submit your first EOD report above!
                        </p>
                    </GlassCard>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {myReports.map(report => {
                            const isExpanded = expandedId === report.id;
                            const completedItems = getCompletedItems(report);
                            const inProgressItems = getInProgressItems(report);
                            const reportDate = new Date(report.reportDate);
                            const isToday = new Date().toDateString() === reportDate.toDateString();
                            const submittedTime = new Date(report.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                            return (
                                <GlassCard key={report.id}
                                    style={{
                                        padding: 0, overflow: 'hidden', cursor: 'pointer',
                                        border: isExpanded ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                                >
                                    {/* Summary Row */}
                                    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '38px', height: '38px', borderRadius: '10px',
                                                background: isToday ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                                                border: isToday ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Calendar size={16} style={{ color: isToday ? 'var(--purple-main)' : 'var(--text-secondary)' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>
                                                    {isToday ? 'Today' : reportDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    Submitted at {submittedTime}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#10B981' }}>
                                                <CheckSquare size={13} /> {completedItems.length} done
                                            </div>
                                            {report.blockers && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#F59E0B' }}>
                                                    <AlertTriangle size={13} /> Blockers
                                                </div>
                                            )}
                                            {report.sentiment && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                    fontSize: '0.7rem', fontWeight: 700,
                                                    padding: '3px 10px', borderRadius: '12px',
                                                    background: `${sentimentColor[report.sentiment] || '#6B7280'}15`,
                                                    border: `1px solid ${sentimentColor[report.sentiment] || '#6B7280'}35`,
                                                    color: sentimentColor[report.sentiment] || '#6B7280'
                                                }}>
                                                    <SentimentIcon sentiment={report.sentiment} />
                                                    {report.sentiment}
                                                </div>
                                            )}
                                            <ChevronDown size={16} style={{
                                                color: 'var(--text-secondary)',
                                                transition: 'transform 0.2s ease',
                                                transform: isExpanded ? 'rotate(180deg)' : 'none'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div style={{
                                            borderTop: '1px solid rgba(255,255,255,0.06)',
                                            padding: '18px 20px',
                                            background: 'rgba(0,0,0,0.15)',
                                            display: 'flex', flexDirection: 'column', gap: '16px'
                                        }}>
                                            {/* Admin Rating Info */}
                                            {report.sentiment && (
                                                <div style={{ marginBottom: '4px' }}>
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Rating (Review)</div>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: `${sentimentColor[report.sentiment]}10`, border: `1px solid ${sentimentColor[report.sentiment]}25`, borderRadius: '8px', color: sentimentColor[report.sentiment], fontSize: '0.85rem', fontWeight: 600 }}>
                                                        <SentimentIcon sentiment={report.sentiment} />
                                                        {report.sentiment}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Completed Tasks */}
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <CheckSquare size={12} style={{ color: '#10B981' }} /> Tasks Completed
                                                </div>
                                                {completedItems.length > 0 ? (
                                                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {completedItems.map((item, i) => (
                                                            <li key={i} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', lineHeight: '1.6' }}>{item}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>None listed</p>
                                                )}
                                            </div>

                                            {/* In Progress */}
                                            {inProgressItems.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Clock size={12} style={{ color: '#F59E0B' }} /> In Progress
                                                    </div>
                                                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {inProgressItems.map((item, i) => (
                                                            <li key={i} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Blockers */}
                                            {report.blockers && (
                                                <div>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <AlertTriangle size={12} style={{ color: '#EF4444' }} /> Blockers
                                                    </div>
                                                    <p style={{
                                                        color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0,
                                                        background: 'rgba(239,68,68,0.06)', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                                                        border: '1px solid rgba(239,68,68,0.12)'
                                                    }}>
                                                        {report.blockers}
                                                    </p>
                                                </div>
                                            )}
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
