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
    const [workHourLogs, setWorkHourLogs] = useState<any[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // One-time daily submission state
    const [todayReport, setTodayReport] = useState<EODSubmissionDTO | null>(null);
    const [isReviewed, setIsReviewed] = useState(false);

    const fetchMyReports = useCallback(async () => {
        if (!authEmployee) {
            if (!authLoading) setReportsLoading(false);
            return;
        }

        try {
            setReportsLoading(true);
            const [eodData, hourData]: [any, any] = await Promise.all([
                api.getMyEODs(authEmployee.id),
                api.getRecentWorkHours(authEmployee.id, 30)
            ]);
            
            setMyReports(Array.isArray(eodData) ? eodData : []);
            setWorkHourLogs(Array.isArray(hourData) ? hourData : []);
        } catch (err) {
            console.error('Failed to load my EOD data:', err);
            setMyReports([]);
            setWorkHourLogs([]);
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

    // Sync today's data into the form if it exists
    useEffect(() => {
        if (!reportsLoading && myReports.length > 0) {
            const today = new Date().toLocaleDateString('en-CA');
            const existing = myReports.find(r => r.reportDate === today);
            
            if (existing) {
                const reviewed = existing.status === 'APPROVED' || existing.status === 'REVIEWED';

                setFormData({
                    tasksCompleted: (existing.tasksCompleted as string[]).join('\n') || (existing as any).completedText || '',
                    blockers: existing.blockers || '',
                    workHours: (existing.workHours || (existing as any).work_hours || '').toString(),
                });
                
                setTodayReport(existing);
                setIsReviewed(reviewed);
            } else {
                setTodayReport(null);
                setIsReviewed(false);
            }
        }
    }, [myReports, reportsLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (isReviewed) {
            setError('This report has already been reviewed by admin and cannot be modified.');
            return;
        }

        if (!authEmployee) {
            setError('System is still re-verifying your session. Please wait a moment.');
            return;
        }

        if (!formData.tasksCompleted.trim()) {
            setError('Please list your tasks accomplished today.');
            return;
        }

        const hours = parseFloat(formData.workHours);
        if (isNaN(hours) || hours <= 0 || hours > 24) {
            setError('Please enter valid work hours (0.5 - 24).');
            return;
        }

        if (!formData.blockers.trim()) {
            setError('Please enter your blockers (enter "None" if there are none).');
            return;
        }

        console.log('[EOD] Starting submission sequence...');
        setLoading(true);
        
        try {
            const empId = authEmployee.id;
            const completedList = formData.tasksCompleted.split('\n').filter(t => t && t.trim() !== '');
            const todayDate = new Date().toLocaleDateString('en-CA');

            const payload: any = {
                employeeId: empId,
                reportDate: todayDate,
                tasksCompleted: completedList,
                completedText: formData.tasksCompleted, // Fallback for long-form
                tasksInProgress: [],
                blockers: formData.blockers,
                sentiment: 'GOOD',
                workHours: hours
            };

            let result;
            if (todayReport) {
                console.log('[EOD] Updating existing report...', todayReport.id);
                result = await api.updateEOD(todayReport.id, payload);
            } else {
                console.log('[EOD] Submitting new report...', payload);
                result = await api.submitEOD(payload);
            }

            console.log('[EOD] Report saved successfully:', result?.id);

            // Sync/Update work hours log
            try {
                console.log('[EOD] Syncing work hours...');
                await api.reviewEOD(result.id, {
                        employeeId: empId,
                        date: todayDate,
                        workHours: hours,
                        adminNote: 'Updated by employee during EOD submission',
                        status: 'PENDING'
                });
            } catch (hourError: any) {
                console.warn('[EOD] Work hour sync warning (non-fatal):', hourError?.message);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);

            // Refresh submissions list
            fetchMyReports();
        } catch (err: any) {
            console.error('[EOD] CRITICAL ERROR during submission:', err);
            setError(err.message || 'Submission failed. Your entry might be too large or there is a connection issue.');
        } finally {
            console.log('[EOD] Submission process ended.');
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="eod-root fade-in">
            <header className="attendance-hero">
                <div className="hero-text">
                    <h1 className="greeting">Daily Status Report</h1>
                    <p className="subtitle">Log your daily achievements and identify blockers.</p>
                </div>
                <div className="hero-controls">
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--purple-light)', lineHeight: 1 }}>{myReports.length} Days 🔥</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800, marginTop: '8px' }}>Submission Streak</div>
                    </div>
                </div>
            </header>

            {/* Submission Form Area */}
            <section className="form-section" style={{ marginBottom: '4rem' }}>
                <GlassCard className="submission-card" style={{ padding: '2rem', opacity: todayReport ? 0.9 : 1 }}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', marginBottom: '2rem' }}>
                            {/* Left Column: Tasks */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label className="input-label">
                                        Tasks Accomplished Today <span style={{ color: '#F87171' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        {isReviewed && <span className="status-pill status-reviewed">REVIEWED BY ADMIN</span>}
                                        <span style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 600 }}>{formData.tasksCompleted.length} characters</span>
                                    </div>
                                </div>
                                <textarea
                                    className="glass-textarea custom-scrollbar"
                                    rows={12}
                                    disabled={isReviewed}
                                    style={{ cursor: isReviewed ? 'not-allowed' : 'text', minHeight: '320px' }}
                                    placeholder="• Implemented authentication middleware&#10;• Refactored API client for better performance&#10;• Fixed CSS layout bugs on mobile"
                                    value={formData.tasksCompleted}
                                    onChange={e => setFormData({ ...formData, tasksCompleted: e.target.value })}
                                />
                            </div>

                            {/* Right Column: Blockers */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label className="input-label">
                                        Blockers / Impediments <span style={{ color: '#F87171' }}>*</span>
                                    </label>
                                    <span style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 600 }}>{formData.blockers.length} characters</span>
                                </div>
                                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <textarea
                                        disabled={isReviewed}
                                        className="glass-textarea custom-scrollbar"
                                        rows={12}
                                        style={{ paddingLeft: '3rem', cursor: isReviewed ? 'not-allowed' : 'text', minHeight: '320px' }}
                                        placeholder="Any obstacles or issues today? Enter 'None' if clear."
                                        value={formData.blockers}
                                        onChange={e => setFormData({ ...formData, blockers: e.target.value })}
                                    />
                                    <AlertTriangle size={18} style={{ position: 'absolute', left: '1.25rem', top: '1.5rem', opacity: 0.2, color: 'var(--purple-light)' }} />
                                </div>
                            </div>
                        </div>

                        {/* Bottom Area: Hours & Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ flexShrink: 0, width: '220px' }}>
                                <label className="input-label" style={{ marginBottom: '10px' }}>
                                    Office Hours <span style={{ color: '#F87171' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number"
                                        disabled={!!todayReport}
                                        className="glass-textarea"
                                        style={{ height: '3.5rem', paddingLeft: '3rem', fontSize: '1rem', cursor: todayReport ? 'not-allowed' : 'text', fontWeight: 800 }}
                                        min="0" step="0.5" max="24"
                                        placeholder="8.5"
                                        value={formData.workHours}
                                        onChange={e => setFormData({ ...formData, workHours: e.target.value })}
                                    />
                                    <Clock size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                </div>
                            </div>
                            
                            <div style={{ flex: 1 }}>
                                <Button
                                    type="submit"
                                    disabled={loading || isReviewed}
                                    className="submit-btn"
                                    style={{ 
                                        width: '100%', 
                                        height: '3.5rem', 
                                        fontSize: '0.9rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        background: isReviewed ? 'rgba(255,255,255,0.05)' : todayReport ? 'var(--purple-main)' : undefined,
                                        color: isReviewed ? 'rgba(255,255,255,0.3)' : undefined,
                                        border: isReviewed ? '1px solid rgba(255,255,255,0.05)' : undefined,
                                        borderRadius: '18px'
                                     }}
                                >
                                    {loading ? 'Processing Protocol...' : isReviewed ? 'Report Locked' : todayReport ? 'Update Today\'s Entry' : 'Publish Daily EOD'}
                                </Button>
                            </div>
                        </div>

                        {error && (
                            <div className="error-message fade-in" style={{ marginTop: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#FCA5A5', padding: '1rem 1.5rem', borderRadius: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <AlertTriangle size={18} /> {error}
                            </div>
                        )}

                        {success && (
                            <div className="success-message fade-in" style={{ marginTop: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', color: '#6EE7B7', padding: '1rem 1.5rem', borderRadius: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <CheckCircle2 size={18} /> Daily transmission successful. Great work today!
                            </div>
                        )}
                    </form>
                </GlassCard>
            </section>

            {/* Past Submissions Area */}
            <section className="history-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', padding: '0 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em' }}>Activity Logs</h2>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '6px' }}>Archives</span>
                    </div>
                </div>

                {reportsLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse" style={{ height: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px' }} />
                        ))}
                    </div>
                ) : myReports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'rgba(255,255,255,0.01)', borderRadius: '32px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                             <Calendar size={28} style={{ opacity: 0.1 }} />
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', fontWeight: 500 }}>No historical activity recorded in this sector.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {myReports.map(report => {
                            const isExpanded = expandedId === report.id;
                            const completedItems = getCompletedItems(report);
                            const reportDate = new Date(report.reportDate);
                            const isToday = new Date().toDateString() === reportDate.toDateString();
                            const status = report.status || 'PENDING';

                            return (
                                <div
                                    key={report.id}
                                    className={`report-log-item ${isExpanded ? 'active' : ''}`}
                                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                                >
                                    <div style={{ padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                            <div style={{ textAlign: 'center', minWidth: '60px' }}>
                                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>
                                                    {reportDate.toLocaleDateString('en-GB', { month: 'short' })}
                                                </div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>
                                                    {reportDate.getDate()}
                                                </div>
                                            </div>

                                            <div style={{ height: '32px', width: '1px', background: 'rgba(255,255,255,0.06)' }} />

                                            <div>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {isToday ? 'Today\'s Transmission' : reportDate.toLocaleDateString('en-GB', { weekday: 'long' })}
                                                    <span className={`status-pill ${status === 'APPROVED' || status === 'REVIEWED' ? 'status-reviewed' : 'status-pending'}`}>
                                                        {status}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckSquare size={12} style={{ color: 'var(--purple-light)' }} /> {completedItems.length} Tasks</span>
                                                    <span style={{ opacity: 0.2 }}>|</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {report.workHours || 0} Hours</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            {report.sentiment && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <SentimentIcon sentiment={report.sentiment} />
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{report.sentiment}</span>
                                                </div>
                                            )}
                                            <ChevronDown size={16} style={{ opacity: 0.2, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ padding: '0 2rem 2rem 6.5rem' }} className="fade-in">
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                                                <div style={{ marginBottom: '1.5rem' }}>
                                                    <div className="input-label" style={{ opacity: 0.5, marginBottom: '12px' }}>Achievements</div>
                                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {completedItems.map((item, i) => (
                                                            <li key={i} style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', position: 'relative', paddingLeft: '1.5rem' }}>
                                                                <span style={{ position: 'absolute', left: 0, color: 'var(--purple-main)', fontWeight: 900 }}>•</span>
                                                                {item}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                    <div style={{ background: 'rgba(139, 92, 246, 0.04)', padding: '1.25rem', borderRadius: '18px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                                                        <div className="input-label" style={{ opacity: 0.6, marginBottom: '8px' }}>Admin Feedback</div>
                                                        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500, fontStyle: report.adminNote ? 'italic' : 'normal' }}>
                                                            {report.adminNote ? `"${report.adminNote}"` : 'No formal feedback provided for this cycle.'}
                                                        </div>
                                                    </div>

                                                    <div style={{ background: 'rgba(248, 113, 113, 0.04)', padding: '1.25rem', borderRadius: '18px', border: '1px solid rgba(248, 113, 113, 0.1)' }}>
                                                        <div className="input-label" style={{ opacity: 0.6, marginBottom: '8px', color: '#F87171' }}>Blockers / Risks</div>
                                                        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                                                            {report.blockers || 'None reported.'}
                                                        </div>
                                                    </div>
                                                </div>
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


