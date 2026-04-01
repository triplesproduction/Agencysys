'use client';

import { useState, useEffect } from 'react';
import { FileText, User, Calendar, CheckSquare, Clock, AlertTriangle, Smile, Meh, Frown, Search, RefreshCw } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { useNotifications } from '@/components/notifications/NotificationProvider';

interface EODReport {
    id: string;
    reportDate: string;
    blockers: string | null;
    sentiment: string;
    completedText: string | null;
    inProgressText: string | null;
    createdAt: string;
    employee: { id: string; firstName: string; lastName: string; department: string | null; roleId: string } | null;
    tasksCompleted: { id: string; title: string }[];
    tasksInProgress: { id: string; title: string }[];
}

const SentimentIcon = ({ sentiment }: { sentiment: string }) => {
    if (sentiment === 'GREAT') return <Smile size={16} style={{ color: '#10B981' }} />;
    if (sentiment === 'GOOD') return <Smile size={16} style={{ color: '#3B82F6' }} />;
    if (sentiment === 'OKAY') return <Meh size={16} style={{ color: '#F59E0B' }} />;
    return <Frown size={16} style={{ color: sentiment === 'BAD' ? '#EF4444' : '#991B1B' }} />;
};

const sentimentColor: Record<string, string> = {
    GREAT: '#10B981', GOOD: '#3B82F6', OKAY: '#F59E0B', BAD: '#EF4444', TERRIBLE: '#991B1B'
};

export default function EODReviewsPage() {
    const { addNotification } = useNotifications();
    const [reports, setReports] = useState<EODReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [ratingMenuOpen, setRatingMenuOpen] = useState<string | null>(null);

    const fetchReports = async () => {
        try {
            setIsLoading(true);
            const data = await api.getAllEODs();
            setReports(data);
        } catch (err: any) {
            addNotification({ type: 'ERROR', title: 'Load Failed', message: err.message || 'Could not fetch EOD reports.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
        
        // Close dropdown on outside click
        const handleOutsideClick = () => setRatingMenuOpen(null);
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    const filtered = reports.filter(r => {
        const name = r.employee ? `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase() : '';
        const dept = r.employee?.department?.toLowerCase() || '';
        const q = search.toLowerCase();
        return name.includes(q) || dept.includes(q);
    });

    // Group by date
    const grouped = filtered.reduce((acc, r) => {
        const date = new Date(r.reportDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(r);
        return acc;
    }, {} as Record<string, EODReport[]>);

    return (
        <div className="main-content fade-in" style={{ padding: '24px 24px 40px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={26} style={{ color: 'var(--purple-main)' }} /> EOD Report Reviews
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.9rem' }}>
                        Review all daily end-of-day reports submitted by your team. {reports.length > 0 && <span style={{ color: 'var(--purple-main)', fontWeight: 600 }}>{reports.length} total submissions</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search by name or dept..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '9px 14px 9px 36px', color: 'white', outline: 'none', width: '240px', fontSize: '0.875rem' }}
                        />
                    </div>
                    <button onClick={fetchReports} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '9px 16px', color: 'var(--purple-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 500 }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton-pulse" style={{ height: '120px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)' }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <GlassCard style={{ padding: '64px', textAlign: 'center' }}>
                    <FileText size={48} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '16px' }} />
                    <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>No EOD Reports Found</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {search ? `No results matching "${search}".` : 'No employees have submitted EOD reports yet.'}
                    </p>
                </GlassCard>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {Object.entries(grouped).map(([date, dayReports]) => (
                        <div key={date}>
                            {/* Date Group Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{date}</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(139,92,246,0.1)', padding: '2px 10px', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.2)' }}>
                                    {dayReports.length} report{dayReports.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Report Cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {dayReports.map(report => {
                                    const isExpanded = expandedId === report.id;
                                    const empName = report.employee ? `${report.employee.firstName} ${report.employee.lastName}` : 'Unknown Employee';
                                    return (
                                        <GlassCard key={report.id}
                                            style={{ padding: '0', overflow: (ratingMenuOpen === report.id || isExpanded) ? 'visible' : 'hidden', border: isExpanded ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease', cursor: 'pointer', position: 'relative', zIndex: ratingMenuOpen === report.id ? 100 : 1 }}
                                            onClick={() => setExpandedId(isExpanded ? null : report.id)}
                                        >
                                            {/* Card Header */}
                                            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: 'var(--purple-main)' }}>
                                                        {empName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>{empName}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                            {report.employee?.department || 'No Department'} · {report.employee?.roleId || ''}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    {/* Tasks count */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <CheckSquare size={14} style={{ color: '#10B981' }} />
                                                        <span>{(() => { const parsed = report.completedText ? JSON.parse(report.completedText) : []; return Math.max(report.tasksCompleted.length, parsed.length); })()} completed</span>
                                                    </div>
                                                    {report.tasksInProgress.length > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                            <Clock size={14} style={{ color: '#F59E0B' }} />
                                                            <span>{report.tasksInProgress.length} in progress</span>
                                                        </div>
                                                    )}
                                                    {/* Sentiment Rating Dropdown */}
                                                    <div style={{ position: 'relative' }}>
                                                        <div 
                                                            style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '5px', 
                                                                fontSize: '0.75rem', 
                                                                fontWeight: 600, 
                                                                padding: '6px 14px', 
                                                                borderRadius: '20px', 
                                                                background: `${sentimentColor[report.sentiment] || '#6B7280'}15`, 
                                                                border: `1px solid ${sentimentColor[report.sentiment] || '#6B7280'}40`, 
                                                                color: sentimentColor[report.sentiment] || '#6B7280',
                                                                cursor: 'pointer',
                                                                userSelect: 'none',
                                                                transition: 'all 0.2s',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRatingMenuOpen(ratingMenuOpen === report.id ? null : report.id);
                                                            }}
                                                            className="hoverable"
                                                        >
                                                            <SentimentIcon sentiment={report.sentiment} />
                                                            {report.sentiment}
                                                            <span style={{ fontSize: '0.7rem', marginLeft: '6px', opacity: 0.7 }}>▼</span>
                                                        </div>

                                                        {ratingMenuOpen === report.id && (
                                                            <div 
                                                                style={{ 
                                                                    position: 'absolute', 
                                                                    top: '110%', 
                                                                    right: 0, 
                                                                    zIndex: 50, 
                                                                    width: '140px', 
                                                                    background: 'rgba(23, 23, 23, 0.95)', 
                                                                    backdropFilter: 'blur(16px)', 
                                                                    borderRadius: '12px', 
                                                                    border: '1px solid var(--glass-border)', 
                                                                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                                                                    overflow: 'hidden',
                                                                    animation: 'slideUp 0.2s ease-out'
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {['GREAT', 'GOOD', 'OKAY', 'BAD', 'TERRIBLE'].map(s => (
                                                                    <div 
                                                                        key={s}
                                                                        onClick={() => {
                                                                            api.updateEODSentiment(report.id, s)
                                                                                .then(() => {
                                                                                    setReports(prev => prev.map(r => r.id === report.id ? { ...r, sentiment: s } : r));
                                                                                    addNotification({ type: 'SUCCESS', title: 'Rating Updated', message: `Report for ${empName} rated as ${s}.` });
                                                                                    setRatingMenuOpen(null);
                                                                                })
                                                                                .catch(err => addNotification({ type: 'ERROR', title: 'Update Failed', message: err.message }));
                                                                        }}
                                                                        style={{ 
                                                                            padding: '10px 16px', 
                                                                            fontSize: '0.8rem', 
                                                                            fontWeight: 600, 
                                                                            color: report.sentiment === s ? sentimentColor[s] : 'rgba(255,255,255,0.7)',
                                                                            background: report.sentiment === s ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '10px',
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.background = report.sentiment === s ? 'rgba(255,255,255,0.05)' : 'transparent'}
                                                                    >
                                                                        <SentimentIcon sentiment={s} />
                                                                        {s}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Expand chevron */}
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div style={{ borderTop: '1px solid var(--glass-border)', padding: '20px', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <CheckSquare size={13} style={{ color: '#10B981' }} /> Tasks Completed
                                                        </div>
                                                        {(() => {
                                                            // Show matched task records first
                                                            if (report.tasksCompleted.length > 0) {
                                                                return (
                                                                    <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        {report.tasksCompleted.map(t => (
                                                                            <li key={t.id} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', lineHeight: '1.5' }}>{t.title}</li>
                                                                        ))}
                                                                    </ul>
                                                                );
                                                            }
                                                            // Fallback: show raw text entries
                                                            let rawItems: string[] = [];
                                                            try { rawItems = report.completedText ? JSON.parse(report.completedText) : []; } catch { /* ignore */ }
                                                            if (rawItems.length > 0) {
                                                                return (
                                                                    <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        {rawItems.map((item, i) => (
                                                                            <li key={i} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', lineHeight: '1.5' }}>{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                );
                                                            }
                                                            return <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>None listed</p>;
                                                        })()}
                                                    </div>
                                                    <div>
                                                        {(() => {
                                                            let rawInProgress: string[] = [];
                                                            try { rawInProgress = report.inProgressText ? JSON.parse(report.inProgressText) : []; } catch { /* ignore */ }
                                                            const items = report.tasksInProgress.length > 0 ? report.tasksInProgress : rawInProgress.map((text, i) => ({ id: String(i), title: text }));
                                                            if (items.length === 0) return null;
                                                            return (
                                                                <>
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <Clock size={13} style={{ color: '#F59E0B' }} /> In Progress
                                                                    </div>
                                                                    <ul style={{ margin: '0 0 16px 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        {items.map(t => (
                                                                            <li key={t.id} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>{t.title}</li>
                                                                        ))}
                                                                    </ul>
                                                                </>
                                                            );
                                                        })()}
                                                        {report.blockers && (
                                                            <>
                                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <AlertTriangle size={13} style={{ color: '#EF4444' }} /> Blockers
                                                                </div>
                                                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', lineHeight: '1.6', margin: 0, background: 'rgba(239,68,68,0.05)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                                                    {report.blockers}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
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
