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
            <header className="page-header">
                <div>
                    <h1 className="greeting">Execution Summary</h1>
                    <p className="subtitle">Account for your productivity and log daily progress.</p>
                </div>
            </header>

            {/* Submission Form Section */}
            <div className="form-container">
                <GlassCard className="eod-card">
                    <form onSubmit={handleSubmit} className="eod-form">
                        <div className="form-group">
                            <label className="input-label">Tasks Completed Today</label>
                            <textarea
                                className="glass-textarea"
                                rows={4}
                                placeholder="List your accomplishments (one per line)..."
                                value={formData.tasksCompleted}
                                onChange={e => setFormData({ ...formData, tasksCompleted: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label className="input-label">Work Hours</label>
                                <input
                                    type="number"
                                    className="glass-textarea"
                                    style={{ height: '3.5rem', minHeight: 'unset' }}
                                    min="0" step="0.5" max="24"
                                    placeholder="Eg. 8.5"
                                    value={formData.workHours}
                                    onChange={e => setFormData({ ...formData, workHours: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="input-label">Blockers (Optional)</label>
                                <input
                                    type="text"
                                    className="glass-textarea"
                                    style={{ height: '3.5rem', minHeight: 'unset' }}
                                    placeholder="Any impediments?"
                                    value={formData.blockers}
                                    onChange={e => setFormData({ ...formData, blockers: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-actions" style={{ marginTop: '0.5rem' }}>
                            <Button type="submit" disabled={loading} className="submit-btn" size="lg">
                                {loading ? 'Processing...' : 'Submit Report'}
                            </Button>
                        </div>

                        {error && (
                            <div className="error-message p-4 rounded-xl mt-4 flex items-center gap-3">
                                <AlertTriangle size={18} />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="success-message p-4 rounded-xl mt-4 flex items-center gap-3">
                                <CheckCircle2 size={18} />
                                EOD Report logged successfully. Your activity has been saved.
                            </div>
                        )}
                    </form>
                </GlassCard>
            </div>

            {/* Submissions History Section */}
            <div className="history-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Clock size={20} className="text-purple-400" />
                        Submission Log
                    </h2>
                </div>

                {reportsLoading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2].map(i => (
                            <div key={i} className="animate-pulse bg-white/5 h-20 rounded-2xl" />
                        ))}
                    </div>
                ) : myReports.length === 0 ? (
                    <div style={{ 
                        padding: '3rem', textAlign: 'center', borderRadius: '20px',
                        background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No entries found for your account.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {myReports.map(report => {
                            const isExpanded = expandedId === report.id;
                            const completedItems = getCompletedItems(report);
                            const inProgressItems = getInProgressItems(report);
                            const reportDate = new Date(report.reportDate);
                            const isToday = new Date().toDateString() === reportDate.toDateString();

                            return (
                                <div key={report.id} 
                                    className={`report-card-container overflow-hidden rounded-2xl transition-all duration-300 ${isExpanded ? 'bg-white/[0.05] ring-1 ring-white/10' : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'}`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                                >
                                    <div className="p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div style={{
                                                width: '42px', height: '42px', borderRadius: '12px',
                                                background: isToday ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Calendar size={18} style={{ color: isToday ? 'var(--purple-main)' : 'rgba(255,255,255,0.4)' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'rgba(255,255,255,0.95)' }}>
                                                    {reportDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    {isToday && <span style={{ marginLeft: '10px', fontSize: '0.65rem', fontWeight: 800, background: 'var(--purple-main)', padding: '3px 8px', borderRadius: '5px', verticalAlign: 'middle', letterSpacing: '0.05em' }}>TODAY</span>}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                                                    {completedItems.length} {completedItems.length === 1 ? 'task' : 'tasks'} recorded
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            {report.sentiment && (
                                                <div className="sentiment-badge rounded-lg flex items-center gap-2 border-[1.5px]" 
                                                    style={{ 
                                                        borderColor: `${sentimentColor[report.sentiment]}40`,
                                                        background: `${sentimentColor[report.sentiment]}15`,
                                                        color: sentimentColor[report.sentiment],
                                                        fontWeight: 700
                                                    }}>
                                                    <SentimentIcon sentiment={report.sentiment} />
                                                    {report.sentiment}
                                                </div>
                                            )}
                                            <ChevronDown size={20} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-6 pt-0 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                            <div className="grid gap-6 mt-6">
                                                <div>
                                                    <h4 className="text-[0.7rem] uppercase tracking-widest text-white/30 font-bold mb-3 flex items-center gap-2">
                                                        <CheckSquare size={12} className="text-green-500" /> Major Accomplishments
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {completedItems.map((item, i) => (
                                                            <li key={i} className="text-white/80 text-sm pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-green-500/40 before:rounded-full">
                                                                {item}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {report.blockers && (
                                                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                                                        <h4 className="text-[0.7rem] uppercase tracking-widest text-red-400 font-bold mb-2 flex items-center gap-2">
                                                            <AlertTriangle size={12} /> Blockers & Impediments
                                                        </h4>
                                                        <p className="text-white/70 text-sm">{report.blockers}</p>
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
    );
}
