'use client';

import { PageHeader } from '@/components/common/PageHeader';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, User, Calendar, CheckSquare, Clock, AlertTriangle, Smile, Meh, Frown, Search, RefreshCw, ChevronDown } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import DatePicker from '@/components/common/DatePicker';
import { api } from '@/lib/api';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import '../EOD.css';

interface EODReport {
    id: string;
    reportDate: string;
    blockers: string | null;
    sentiment: string;
    completedText: string | null;
    inProgressText: string | null;
    createdAt: string;
    employee: { id: string; firstName: string; lastName: string; department: string | null; roleId: string } | null;
    tasksCompleted: any;
    tasksInProgress: any;
    workHours: number | null;
    adminNote: string | null;
    status: string | null;
}

// SAFE PARSING UTILITY
const safeParseArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : (v?.title || v?.text || JSON.stringify(v))).filter(v => v);
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map(v => typeof v === 'string' ? v : (v?.title || v?.text || JSON.stringify(v))).filter(v => v);
                return [val];
            } catch {
                return [val];
            }
        }
        return [val];
    }
    return [];
};

const SentimentIcon = ({ sentiment }: { sentiment: string }) => {
    if (sentiment === 'GREAT') return <Smile size={16} style={{ color: '#10B981' }} />;
    if (sentiment === 'GOOD') return <Smile size={16} style={{ color: '#3B82F6' }} />;
    if (sentiment === 'OKAY') return <Meh size={16} style={{ color: '#F59E0B' }} />;
    return <Frown size={16} style={{ color: sentiment === 'BAD' ? '#EF4444' : '#991B1B' }} />;
};

const sentimentColor: Record<string, string> = {
    GREAT: '#10B981', GOOD: '#3B82F6', OKAY: '#F59E0B', BAD: '#EF4444', TERRIBLE: '#991B1B'
};

function EODReviewsContent() {
    const { addNotification } = useNotifications();
    const searchParams = useSearchParams();
    const [reports, setReports] = useState<EODReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const y = firstDay.getFullYear();
        const m = String(firstDay.getMonth() + 1).padStart(2, '0');
        const day = String(firstDay.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const y = lastDay.getFullYear();
        const m = String(lastDay.getMonth() + 1).padStart(2, '0');
        const day = String(lastDay.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [ratingMenuOpen, setRatingMenuOpen] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [editHours, setEditHours] = useState<string>('');
    const [editNote, setEditNote] = useState<string>('');
    const [workLogMap, setWorkLogMap] = useState<Record<string, any>>({});
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [employees, setEmployees] = useState<any[]>([]);

    const fetchReports = useCallback(async () => {
        try {
            setIsLoading(true);
            // Fetch EODs within the selected date range
            const data = await api.getAllEODs({ 
                startDate, 
                endDate, 
                employeeId: selectedEmployeeId || undefined,
                limit: 500 
            });
            setReports(data);

            if (data.length > 0) {
                // Optimize: Fetch all work hours for the date range in one go
                const allWorkHours = await api.getWorkHoursInRange(startDate, endDate, selectedEmployeeId || undefined);
                
                const newLogMap: Record<string, any> = {};
                
                // Map work hours to EOD reports by employeeId and date
                data.forEach((report: any) => {
                    if (!report.employee) return;
                    const reportDateStr = new Date(report.reportDate).toISOString().split('T')[0];
                    const matchingLog = allWorkHours.find(log => 
                        log.employeeId === report.employee.id && 
                        log.date === reportDateStr
                    );
                    if (matchingLog) {
                        newLogMap[report.id] = matchingLog;
                    }
                });
                
                setWorkLogMap(newLogMap);
            } else {
                setWorkLogMap({});
            }
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Load Failed', message: err.message || 'Could not fetch EOD reports.' });
        } finally {
            setIsLoading(false);
        }
    }, [addNotification, startDate, endDate, selectedEmployeeId]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    useEffect(() => {
        api.getEmployees({ limit: 1000, status: 'ACTIVE' }).then(res => setEmployees(res.data || []));
        const handleOutsideClick = () => setRatingMenuOpen(null);
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    useEffect(() => {
        if (expandedId) {
            const report = reports.find(r => r.id === expandedId);
            if (report) {
                const log = workLogMap[report.id];
                if (log) {
                    setEditHours(String(log.hoursLogged || log.hours_logged || ''));
                    const desc = log.description || '';
                    const noteMatch = desc.match(/\[Review Note: (.*?)\]/);
                    setEditNote(noteMatch ? noteMatch[1] : (desc.includes('Admin reviewed') ? desc.split('Note: ')[1] || '' : ''));
                } else {
                    setEditHours(String(report.workHours || ''));
                    setEditNote('');
                }
            }
        }
    }, [expandedId, reports, workLogMap]);

    const handleReviewUpdate = async (reportId: string, status: string) => {
        try {
            setIsUpdating(reportId);
            const report = reports.find(r => r.id === reportId);
            if (!report || !report.employee) throw new Error('Report data missing.');

            const hours = parseFloat(editHours);
            if (isNaN(hours)) throw new Error('Please enter a valid number for hours.');

            const reportDateStr = report.reportDate.includes('T') ? report.reportDate.split('T')[0] : report.reportDate;

            await api.reviewEOD(reportId, {
                employeeId: report.employee.id,
                date: reportDateStr,
                workHours: hours,
                adminNote: editNote,
                status: status
            });

            addNotification({ type: 'SUCCESS', title: 'Review Saved', message: `Report marked as ${status}.` });
            setExpandedId(null);
            setRatingMenuOpen(null);
            fetchReports();
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Update Failed', message: err.message });
        } finally {
            setIsUpdating(null);
        }
    };

    const filtered = reports.filter(r => {
        const name = r.employee ? `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase() : '';
        const dept = r.employee?.department?.toLowerCase() || '';
        const q = search.toLowerCase();
        
        // Date and Employee filtering is now handled by the API call, 
        // but we keep the name/dept search filtering on the client for responsiveness
        return name.includes(q) || dept.includes(q);
    });

    const grouped = filtered.reduce((acc, r) => {
        const date = new Date(r.reportDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(r);
        return acc;
    }, {} as Record<string, EODReport[]>);

    return (
        <div className="page-root fade-in">
            <PageHeader
                title="EOD Report Reviews"
                subtitle={<p className="subtitle">Review all daily end-of-day reports submitted by your team.</p>}
            />

            {/* Filter Toolbar */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'nowrap', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)', overflowX: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' }}>
                    <label className="input-label" style={{ margin: 0 }}>Search</label>
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
                    <label className="input-label" style={{ margin: 0 }}>Employee</label>
                    <div style={{ position: 'relative' }}>
                        <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <select
                            value={selectedEmployeeId}
                            onChange={e => setSelectedEmployeeId(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '10px 36px 10px 36px', color: 'white', outline: 'none', width: '100%', fontSize: '0.875rem', height: '42px', cursor: 'pointer', appearance: 'none' }}
                        >
                            <option value="">All Employees</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                        </select>
                        <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}><DatePicker label="From" value={startDate} onChange={setStartDate} /></div>
                <div style={{ flex: 1, minWidth: '130px' }}><DatePicker label="To" value={endDate} onChange={setEndDate} /></div>
                <button onClick={fetchReports} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '0 16px', color: 'var(--purple-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 600, height: '42px', whiteSpace: 'nowrap', flexShrink: 0 }}><RefreshCw size={14} /> Refresh</button>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{[1, 2, 3].map(i => <div key={i} className="skeleton-pulse" style={{ height: '120px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)' }} />)}</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {Object.entries(grouped).map(([date, dayReports]) => (
                        <div key={date}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{date}</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {dayReports.map(report => {
                                    const isExpanded = expandedId === report.id;
                                    const empName = report.employee ? `${report.employee.firstName} ${report.employee.lastName}` : 'Unknown';
                                    const completedTasks = safeParseArray(report.tasksCompleted);
                                    
                                    return (
                                        <GlassCard key={report.id} style={{ padding: '0', overflow: isExpanded ? 'visible' : 'hidden', border: isExpanded ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : report.id)}>
                                            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: 'var(--purple-main)' }}>{empName.charAt(0)}</div>
                                                    <div><div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>{empName}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{report.employee?.department || 'No Department'}</div></div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><CheckSquare size={14} style={{ color: '#10B981' }} /><span>{completedTasks.length} completed</span></div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: (report.status === 'APPROVED' ? '#10B981' : 'var(--text-secondary)') }}><Clock size={14} /><span style={{ fontWeight: 600 }}>{workLogMap[report.id]?.hoursLogged || report.workHours || 0}h logged</span></div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', background: `${sentimentColor[report.sentiment] || '#6B7280'}15`, border: `1px solid ${sentimentColor[report.sentiment] || '#6B7280'}40`, color: sentimentColor[report.sentiment] || '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}><SentimentIcon sentiment={report.sentiment} />{report.sentiment}</div>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div style={{ borderTop: '1px solid var(--glass-border)', padding: '20px', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Tasks Completed</div>
                                                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>{completedTasks.map((t, i) => <li key={i} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>{t}</li>)}</ul>
                                                    </div>
                                                    <div>
                                                        {report.blockers && <><div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Blockers</div><p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', background: 'rgba(239,68,68,0.05)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.15)' }}>{report.blockers}</p></>}
                                                    </div>
                                                    {report.status !== 'APPROVED' && (
                                                        <div style={{ gridColumn: 'span 2', marginTop: '12px', padding: '20px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.15)' }} onClick={e => e.stopPropagation()}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', marginBottom: '16px' }}>
                                                                <div><label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', display: 'block' }}>Adjusted Hours</label><input type="number" step="any" value={editHours} onChange={e => setEditHours(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: 'white' }} /></div>
                                                                <div><label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', display: 'block' }}>Admin Note</label><textarea rows={1} value={editNote} onChange={e => setEditNote(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: 'white', resize: 'none' }} /></div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                                                <button onClick={() => handleReviewUpdate(report.id, 'APPROVED')} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10B981', padding: '8px 16px', borderRadius: '10px', fontWeight: 600 }}>Approve</button>
                                                                <button onClick={() => handleReviewUpdate(report.id, 'APPROVED')} style={{ background: 'var(--purple-main)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '10px', fontWeight: 600 }}>Update Hours & Approve</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </GlassCard>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function EODReviewsPage() {
    return (
        <Suspense fallback={<div className="main-content"><p>Loading reviews...</p></div>}>
            <EODReviewsContent />
        </Suspense>
    );
}