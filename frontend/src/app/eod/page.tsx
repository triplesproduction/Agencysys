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
            const today = new Date().toDateString();
            const existing = myReports.find(r => new Date(r.reportDate).toDateString() === today);
            
            if (existing) {
                const completed = getCompletedItems(existing);
                const matchingLog = workHourLogs.find(l => new Date(l.date).toDateString() === today);
                const desc = matchingLog?.description || '';
                // Block if admin has reviewed or if there's a status marker
                const reviewed = desc.includes('Admin reviewed') || desc.includes('[Status:') || (existing as any).status === 'APPROVED' || (existing as any).status === 'REVIEWED';

                setFormData({
                    tasksCompleted: completed.join('\n'),
                    blockers: existing.blockers || '',
                    workHours: String(existing.workHours || matchingLog?.hoursLogged || ''),
                });
                
                setTodayReport(existing);
                setIsReviewed(reviewed);
            } else {
                setTodayReport(null);
                setIsReviewed(false);
            }
        }
    }, [myReports, workHourLogs, reportsLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (isReviewed) {
            setError('This report has already been reviewed by an admin and cannot be modified.');
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
        if (isNaN(hours) || hours <= 0) {
            setError('Please enter your total work hours for today.');
            return;
        }

        if (!formData.blockers.trim()) {
            setError('Please enter your blockers (enter "None" if there are none).');
            return;
        }

        setLoading(true);
        try {
            const empId = authEmployee.id;
            const completedList = formData.tasksCompleted.split('\n').filter(t => t && t.trim() !== '');

            const payload: Partial<EODSubmissionDTO> = {
                employeeId: empId,
                reportDate: todayReport ? todayReport.reportDate : new Date().toISOString(),
                tasksCompleted: completedList,
                tasksInProgress: [],
                blockers: formData.blockers || undefined,
                sentiment: 'GOOD',
                workHours: hours
            };

            if (todayReport) {
                await api.updateEOD(todayReport.id, payload);
            } else {
                await api.submitEOD(payload);
            }

            // Sync/Update work hours log
            try {
                const todayDate = new Date().toISOString().split('T')[0];
                const existingLog = workHourLogs.find(l => new Date(l.date).toDateString() === new Date().toDateString());
                
                if (existingLog) {
                    // Update existing log
                    await api.reviewEOD(todayReport?.id || '', { // api.reviewEOD is basically a "upsert work hour log" with review metadata
                         employeeId: empId,
                         date: todayDate,
                         workHours: hours,
                         adminNote: 'Updated by employee',
                         status: 'PENDING'
                    });
                } else {
                    await api.logWorkHours({
                        employeeId: empId,
                        date: todayDate,
                        hoursLogged: hours,
                        description: 'EOD Daily Submission',
                    });
                }
            } catch (hourError: any) {
                console.warn('[EOD] Work hour sync skipped:', hourError?.message);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);

            // Refresh submissions list
            fetchMyReports();
        } catch (err: any) {
            console.error('[EOD TRACE] Submission Error:', err);
            setError(err.message || 'Submission failed.');
        } finally {
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
        <div className="eod-page fade-in" style={{ width: '100%', maxWidth: '1400px', margin: '0', padding: '0 40px 80px' }}>
            <header className="page-header" style={{ marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', width: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 className="greeting" style={{ margin: 0, fontSize: '1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Daily Status Report</h1>
                        <p className="subtitle" style={{ marginTop: '4px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>Log your daily achievements and identify blockers.</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: '4px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple-light)', lineHeight: 1 }}>{myReports.length} Days 🔥</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginTop: '6px' }}>Submission Streak</div>
                    </div>
                </div>
            </header>

            {/* Submission Form Area */}
            <section className="form-section" style={{ marginBottom: '48px' }}>
                <GlassCard className="submission-card" style={{ padding: '24px 28px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15, 15, 20, 0.4)', opacity: isReviewed ? 0.8 : 1 }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <label className="input-label" style={{ margin: 0, fontSize: '0.7rem' }}>
                                    Tasks Accomplished Today <span style={{ color: '#F87171' }}>*</span>
                                </label>
                                {isReviewed ? (
                                    <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 800, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>REVIEWED BY ADMIN</span>
                                ) : (
                                    <span style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 500 }}>Enter one task per line</span>
                                )}
                            </div>
                            <textarea
                                className="glass-textarea"
                                rows={4}
                                disabled={isReviewed}
                                style={{ fontSize: '0.9rem', lineHeight: '1.5', padding: '14px', cursor: isReviewed ? 'not-allowed' : 'text' }}
                                placeholder="Write the tasks you completed today"
                                value={formData.tasksCompleted}
                                onChange={e => setFormData({ ...formData, tasksCompleted: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div>
                                <label className="input-label" style={{ marginBottom: '6px', fontSize: '0.65rem' }}>
                                    Office Hours <span style={{ color: '#F87171' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number"
                                        disabled={isReviewed}
                                        className="glass-textarea"
                                        style={{ height: '2.2rem', paddingLeft: '2.2rem', fontSize: '0.8rem', cursor: isReviewed ? 'not-allowed' : 'text' }}
                                        min="0" step="0.5" max="24"
                                        placeholder="8.5"
                                        value={formData.workHours}
                                        onChange={e => setFormData({ ...formData, workHours: e.target.value })}
                                    />
                                    <Clock size={11} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                </div>
                            </div>
                            <div>
                                <label className="input-label" style={{ marginBottom: '6px', fontSize: '0.65rem' }}>
                                    Blockers / Impediments <span style={{ color: '#F87171' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        disabled={isReviewed}
                                        className="glass-textarea"
                                        style={{ height: '2.2rem', paddingLeft: '2.2rem', fontSize: '0.8rem', cursor: isReviewed ? 'not-allowed' : 'text' }}
                                        placeholder="Anything slowing you down?"
                                        value={formData.blockers}
                                        onChange={e => setFormData({ ...formData, blockers: e.target.value })}
                                    />
                                    <AlertTriangle size={11} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || isReviewed}
                            className="submit-btn"
                            style={{ 
                                width: '100%', 
                                height: '3rem', 
                                fontSize: '0.9rem', 
                                background: isReviewed ? 'rgba(255,255,255,0.05)' : undefined,
                                color: isReviewed ? 'rgba(255,255,255,0.3)' : undefined,
                                border: isReviewed ? '1px solid rgba(255,255,255,0.05)' : undefined
                             }}
                        >
                            {loading ? 'Processing...' : isReviewed ? 'Submission Locked' : todayReport ? 'Update Daily EOD' : 'Publish Daily EOD'}
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
                                                <div style={{ fontSize: '0.7rem', color: isToday ? 'var(--purple-light)' : 'rgba(255,255,255,0.3)', marginTop: '1px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{completedItems.length} tasks completed</span>
                                                    {(report.workHours || workHourLogs.find(l => new Date(l.date).toDateString() === reportDate.toDateString())?.hoursLogged) && (
                                                        <>
                                                            <span style={{ opacity: 0.3 }}>•</span>
                                                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                                                                {report.workHours || workHourLogs.find(l => new Date(l.date).toDateString() === reportDate.toDateString())?.hoursLogged}h logged
                                                                {(() => {
                                                                    const status = report.status || (workHourLogs.find(l => new Date(l.date).toDateString() === reportDate.toDateString())?.description?.match(/Status: (.*?)\./)?.[1]) || (workHourLogs.find(l => new Date(l.date).toDateString() === reportDate.toDateString())?.description?.includes('APPROVED') ? 'APPROVED' : null) || (workHourLogs.find(l => new Date(l.date).toDateString() === reportDate.toDateString())?.description?.includes('ADJUSTED') ? 'ADJUSTED' : null);
                                                                    if (!status) return null;
                                                                    return (
                                                                        <span style={{ marginLeft: '8px', fontSize: '0.6rem', textTransform: 'uppercase', background: status === 'APPROVED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: status === 'APPROVED' ? '#10B981' : '#F59E0B', padding: '1px 6px', borderRadius: '4px', border: `1px solid ${status === 'APPROVED' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>{status}</span>
                                                                    );
                                                                })()}
                                                            </span>
                                                        </>
                                                    )}
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
                                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
                                                    {completedItems.map((item, i) => (
                                                        <li key={i} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', position: 'relative', paddingLeft: '1.2rem' }}>
                                                            <span style={{ position: 'absolute', left: 0, color: 'var(--purple-main)', opacity: 0.5 }}>•</span>
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                                                    {/* Office Hours Side */}
                                                    <div style={{ background: 'rgba(139, 92, 246, 0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Clock size={14} style={{ color: 'var(--purple-light)' }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--purple-light)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', opacity: 0.6 }}>Office Hours</div>
                                                            <div style={{ fontSize: '0.9rem', color: 'white', fontWeight: 700 }}>
                                                                {(() => {
                                                                    const formatDate = (d: any) => {
                                                                        try {
                                                                            return new Date(d).toISOString().split('T')[0];
                                                                        } catch (e) {
                                                                            return null;
                                                                        }
                                                                    };
                                                                    const reportDateStr = formatDate(report.reportDate);
                                                                    const matchingLog = workHourLogs.find(log => formatDate(log.date) === reportDateStr);
                                                                    const hours = report.workHours || report.work_hours || matchingLog?.hoursLogged || matchingLog?.hours_logged;
                                                                    return hours || '0.0';
                                                                })()}h
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Blockers Side */}
                                                    <div style={{ background: 'rgba(248,113,113,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(248,113,113,0.08)' }}>
                                                        <div style={{ fontSize: '0.6rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <AlertTriangle size={10} /> Blockers
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {report.blockers || 'None'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {(() => {
                                                    const formatDate = (d: any) => { try { return new Date(d).toISOString().split('T')[0]; } catch (e) { return null; } };
                                                    const reportDateStr = formatDate(report.reportDate);
                                                    const matchingLog = workHourLogs.find(log => formatDate(log.date) === reportDateStr);
                                                    const desc = matchingLog?.description || '';
                                                    const noteMatch = desc.match(/\[Review Note: (.*?)\]/);
                                                    const adminNote = report.adminNote || (noteMatch ? noteMatch[1] : (desc.includes('Admin reviewed') ? desc.split('Note: ')[1] || '' : ''));
                                                    
                                                    if (!adminNote) return null;
                                                    
                                                    return (
                                                        <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(139, 92, 246, 0.04)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--purple-light)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                Admin Feedback
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500, fontStyle: 'italic' }}>
                                                                "{adminNote}"
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
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


