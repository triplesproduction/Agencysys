'use client';

import { useState, useEffect, useCallback } from 'react';
import GlassCard from '@/components/GlassCard';
import Button from '@/components/Button';
import { api } from '@/lib/api';
import { CheckSquare, AlertTriangle, Calendar, Clock, ChevronDown, Smile, Meh, Frown, CheckCircle2 } from 'lucide-react';
import './EOD.css';

const SentimentIcon = ({ sentiment }: { sentiment: string }) => {
    if (sentiment === 'GREAT') return <Smile size={16} style={{ color: '#34D399' }} />;
    if (sentiment === 'GOOD') return <Smile size={16} style={{ color: '#60A5FA' }} />;
    if (sentiment === 'OKAY') return <Meh size={16} style={{ color: '#FBBF24' }} />;
    return <Frown size={16} style={{ color: sentiment === 'BAD' ? '#F87171' : '#B91C1C' }} />;
};

const sentimentColor: Record<string, string> = {
    GREAT: '#34D399', GOOD: '#60A5FA', OKAY: '#FBBF24', BAD: '#F87171', TERRIBLE: '#B91C1C'
};

import { EODSubmissionDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';

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
            const data = await api.getMyEODs(authEmployee.id);
            // Only show reports belonging to this employee if filtering wasn't done on server
            const filtered = Array.isArray(data) 
                ? data.filter(r => r.employeeId === authEmployee.id)
                : [];
            setMyReports(filtered);
        } catch (err) {
            console.error('Failed to load my EODs:', err);
            setMyReports([]);
        } finally {
            setReportsLoading(false);
        }
    }, [authEmployee, authLoading]);

    useEffect(() => {
        if (!authLoading && authEmployee) {
            fetchMyReports();
        } else if (!authLoading && !authEmployee) {
            setReportsLoading(false);
        }
    }, [authLoading, authEmployee, fetchMyReports]);

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
            const completedList = formData.tasksCompleted.split('\n').filter(t => t && t.trim() !== '');

            await api.submitEOD({
                employeeId: empId,
                reportDate: new Date().toISOString(), // Full ISO for better backend parsing
                tasksCompleted: completedList,
                tasksInProgress: [],
                blockers: formData.blockers || undefined,
                sentiment: 'GOOD',
            });

            // Log work hours if provided (non-critical — silently skip on RLS errors)
            const hours = parseFloat(formData.workHours);
            if (!isNaN(hours) && hours > 0) {
                try {
                    await api.logWorkHours({
                        employeeId: empId,
                        date: new Date().toISOString().split('T')[0],
                        hoursLogged: hours,
                        description: 'EOD Daily Submission',
                    });
                } catch (hourError: any) {
                    // Non-critical: work hours logging / KPI trigger may fail due to RLS.
                    // EOD is already saved — don't alarm the user with a red error.
                    console.warn('[EOD] Work hour/KPI logging skipped (RLS or trigger):', hourError?.message);
                }
            }

            setSuccess(true);
            setFormData({ tasksCompleted: '', blockers: '', workHours: '' });
            setTimeout(() => setSuccess(false), 5000);

            // Refresh submissions list
            fetchMyReports();
        } catch (err: any) {
            console.error('[EOD TRACE] Submission Error:', err);
            const msg = err.message || 'Submission failed. Please check your data or try again.';
            setError(msg);
            
            if (msg.includes('row-level security')) {
                console.error('[CRITICAL] RLS Violation detected on submission path');
            }
        } finally {
            setLoading(false);
        }
    };

    const getCompletedItems = (report: EODSubmissionDTO): string[] => {
        if (Array.isArray(report.tasksCompleted)) return report.tasksCompleted;
        return [];
    };

    const getInProgressItems = (report: EODSubmissionDTO): string[] => {
        if (Array.isArray(report.tasksInProgress)) return report.tasksInProgress;
        return [];
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="eod-page fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px 80px' }}>
            <header className="page-header" style={{ marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="greeting" style={{ margin: 0, fontSize: '1.5rem' }}>Daily Status Report</h1>
                        <p className="subtitle" style={{ marginTop: '2px', fontSize: '0.9rem' }}>Log your daily achievements and identify blockers.</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple-light)', lineHeight: 1 }}>{myReports.length} Days 🔥</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginTop: '4px' }}>Submission Streak</div>
                    </div>
                </div>
            </header>

            {/* Submission Form Area */}
            <section className="form-section" style={{ marginBottom: '48px' }}>
                <GlassCard className="submission-card" style={{ padding: '24px 28px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15, 15, 20, 0.4)' }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <label className="input-label" style={{ margin: 0, fontSize: '0.7rem' }}>Tasks Accomplished Today</label>
                                <span style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 500 }}>Enter one task per line</span>
                            </div>
                            <textarea
                                className="glass-textarea"
                                rows={4}
                                style={{ fontSize: '0.9rem', lineHeight: '1.5', padding: '14px' }}
                                placeholder="• Developed user authentication flow&#10;• Integrated Stripe payment gateway..."
                                value={formData.tasksCompleted}
                                onChange={e => setFormData({ ...formData, tasksCompleted: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', marginBottom: '24px' }}>
                            <div>
                                <label className="input-label" style={{ marginBottom: '10px', fontSize: '0.7rem' }}>Office Hours</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number"
                                        className="glass-textarea"
                                        style={{ height: '2.8rem', paddingLeft: '2.8rem', fontSize: '0.9rem' }}
                                        min="0" step="0.5" max="24"
                                        placeholder="Eg. 8.5"
                                        value={formData.workHours}
                                        onChange={e => setFormData({ ...formData, workHours: e.target.value })}
                                    />
                                    <Clock size={14} style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                </div>
                            </div>
                            <div>
                                <label className="input-label" style={{ marginBottom: '10px', fontSize: '0.7rem' }}>Blockers / Impediments</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        className="glass-textarea"
                                        style={{ height: '2.8rem', paddingLeft: '2.8rem', fontSize: '0.9rem' }}
                                        placeholder="Anything slowing you down?"
                                        value={formData.blockers}
                                        onChange={e => setFormData({ ...formData, blockers: e.target.value })}
                                    />
                                    <AlertTriangle size={14} style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                </div>
                            </div>
                        </div>

                        <Button type="submit" disabled={loading} className="primary-button" style={{ width: '100%', height: '3.2rem', fontSize: '0.9rem', fontWeight: 600 }}>
                            {loading ? 'Submitting...' : 'Publish Daily EOD'}
                        </Button>

                        {error && (
                            <div className="error-message" style={{ marginTop: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}

                        {success && (
                            <div className="success-message" style={{ marginTop: '20px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={16} /> Report published successfully. Great job!
                            </div>
                        )}
                    </form>
                </GlassCard>
            </section>

            {/* Past Submissions Area */}
            <section className="history-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingLeft: '4px' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>Submission History</h2>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Recent Activity</div>
                </div>

                {reportsLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse" style={{ height: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }} />
                        ))}
                    </div>
                ) : myReports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.01)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No activity records found.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {myReports.map(report => {
                            const isExpanded = expandedId === report.id;
                            const completedItems = getCompletedItems(report);
                            const reportDate = new Date(report.reportDate);
                            const isToday = new Date().toDateString() === reportDate.toDateString();

                            return (
                                <div 
                                    key={report.id} 
                                    className={`report-log-item ${isExpanded ? 'active' : ''}`}
                                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                                    style={{ 
                                        background: isExpanded ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                                        border: isExpanded ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(255,255,255,0.03)',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontFamily: 'monospace', width: '45px' }}>
                                                {reportDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                            </div>
                                            <div style={{ height: '16px', width: '1px', background: 'rgba(255,255,255,0.08)' }} />
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>
                                                    {isToday ? 'Today\'s Summary' : reportDate.toLocaleDateString('en-GB', { weekday: 'long' })}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: isToday ? 'var(--purple-light)' : 'rgba(255,255,255,0.3)', marginTop: '1px', fontWeight: 500 }}>
                                                    {completedItems.length} tasks completed
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {report.sentiment && (
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sentimentColor[report.sentiment] || '#666' }} />
                                            )}
                                            <ChevronDown size={12} style={{ opacity: 0.2, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s' }} />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ padding: '0 20px 20px 78px' }} className="fade-in">
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {completedItems.map((item, i) => (
                                                        <li key={i} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', position: 'relative', paddingLeft: '1.2rem' }}>
                                                            <span style={{ position: 'absolute', left: 0, color: 'var(--purple-main)', opacity: 0.5 }}>•</span>
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                                {report.blockers && (
                                                    <div style={{ marginTop: '16px', background: 'rgba(248,113,113,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.08)' }}>
                                                        <div style={{ fontSize: '0.6rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Blockers</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{report.blockers}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

const getCompletedItems = (report: EODSubmissionDTO): string[] => {
    if (Array.isArray(report.tasksCompleted)) return report.tasksCompleted;
    if (typeof report.tasksCompleted === 'string') {
        try {
            const parsed = JSON.parse(report.tasksCompleted);
            return Array.isArray(parsed) ? parsed : [report.tasksCompleted];
        } catch {
            return [report.tasksCompleted];
        }
    }
    return [];
};

const getInProgressItems = (report: EODSubmissionDTO): string[] => {
    if (Array.isArray(report.tasksInProgress)) return report.tasksInProgress;
    if (typeof report.tasksInProgress === 'string') {
        try {
            const parsed = JSON.parse(report.tasksInProgress);
            return Array.isArray(parsed) ? parsed : [report.tasksInProgress];
        } catch {
            return [report.tasksInProgress];
        }
    }
    return [];
};
