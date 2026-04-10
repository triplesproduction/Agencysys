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
        <div className="eod-page fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: 'none', paddingBottom: '0' }}>
                <div>
                    <h1 className="greeting">Daily Execution Summary</h1>
                    <p className="subtitle">Account for your productivity and log daily progress.</p>
                </div>
                <div style={{ textAlign: 'right', paddingBottom: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Current Streak</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--purple-light)' }}>{myReports.length} Days 🔥</div>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '2.4rem', alignItems: 'start' }}>
                {/* Submission Form Section */}
                <div className="form-container">
                    <GlassCard className="eod-card" style={{ padding: '2.5rem' }}>
                        <form onSubmit={handleSubmit} className="eod-form">
                            <div className="form-group">
                                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    Tasks Completed Today
                                    <span style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 400 }}>List one item per line</span>
                                </label>
                                <textarea
                                    className="glass-textarea"
                                    rows={5}
                                    placeholder="• Accomplished major feature A
• Debugged critical issue B
• Attended sync meeting..."
                                    value={formData.tasksCompleted}
                                    onChange={e => setFormData({ ...formData, tasksCompleted: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="input-label">Work Hours</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number"
                                            className="glass-textarea"
                                            style={{ height: '3.5rem', paddingLeft: '3rem' }}
                                            min="0" step="0.5" max="24"
                                            placeholder="Eg. 8.5"
                                            value={formData.workHours}
                                            onChange={e => setFormData({ ...formData, workHours: e.target.value })}
                                        />
                                        <Clock size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="input-label">Blockers (Optional)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            className="glass-textarea"
                                            style={{ height: '3.5rem', paddingLeft: '3rem' }}
                                            placeholder="Any impediments?"
                                            value={formData.blockers}
                                            onChange={e => setFormData({ ...formData, blockers: e.target.value })}
                                        />
                                        <AlertTriangle size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions" style={{ marginTop: '0.5rem' }}>
                                <Button type="submit" disabled={loading} className="submit-btn" size="lg" style={{ width: '100%', height: '4rem' }}>
                                    {loading ? 'Processing Protocol...' : 'Submit Execution Report'}
                                </Button>
                            </div>

                            {error && (
                                <div className="error-message p-4 rounded-xl mt-4 flex items-center gap-3 fade-in">
                                    <AlertTriangle size={18} />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="success-message p-4 rounded-xl mt-4 flex items-center gap-3 fade-in">
                                    <CheckCircle2 size={18} />
                                    EOD Report logged successfully. Your productivity has been recorded.
                                </div>
                            )}
                        </form>
                    </GlassCard>
                </div>

                {/* Submissions History Section */}
                <div className="history-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock size={16} className="text-purple-400" />
                            </div>
                            Recent Log
                        </h2>
                    </div>

                    {reportsLoading ? (
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="animate-pulse bg-white/5 h-24 rounded-2xl" />
                            ))}
                        </div>
                    ) : myReports.length === 0 ? (
                        <div style={{ 
                            padding: '4rem 2rem', textAlign: 'center', borderRadius: '24px',
                            background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <Calendar size={40} style={{ opacity: 0.1, marginBottom: '16px' }} />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No telemetry data found for your account.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            {myReports.map(report => {
                                const isExpanded = expandedId === report.id;
                                const completedItems = getCompletedItems(report);
                                const reportDate = new Date(report.reportDate);
                                const isToday = new Date().toDateString() === reportDate.toDateString();

                                return (
                                    <div key={report.id} 
                                        className={`report-card-container overflow-hidden rounded-2xl transition-all duration-300 ${isExpanded ? 'active-report' : 'inactive-report'}`}
                                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                                    >
                                        <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ 
                                                    width: '46px', height: '46px', borderRadius: '14px', 
                                                    background: isToday ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.1))' : 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <Calendar size={20} style={{ color: isToday ? 'var(--purple-light)' : 'rgba(255,255,255,0.3)' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {reportDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                        {isToday && <span className="today-badge">TODAY</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px', fontWeight: 500 }}>
                                                        {completedItems.length} Key Assignments
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {report.sentiment && (
                                                    <div className="sentiment-dot" style={{ background: sentimentColor[report.sentiment] }}></div>
                                                )}
                                                <ChevronDown size={18} style={{ opacity: 0.3, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="fade-in" style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
                                                <div style={{ paddingTop: '1.25rem' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <CheckSquare size={12} /> Execution Log
                                                    </div>
                                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {completedItems.map((item, i) => (
                                                            <li key={i} style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>{item}</li>
                                                        ))}
                                                    </ul>
                                                    
                                                    {report.blockers && (
                                                        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(248,113,113,0.05)', borderRadius: '12px', border: '1px solid rgba(248,113,113,0.1)' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <AlertTriangle size={12} /> Critical Impediments
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', color: '#fca5a5' }}>{report.blockers}</div>
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
                </div>
            </div>
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
