'use client';

import { PageHeader } from '@/components/common/PageHeader';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { EODSubmissionDTO, WorkHourLogDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import { Clock, Calendar, TrendingUp, History, CheckCircle2, Filter, ChevronDown } from 'lucide-react';
import './Logs.css';

export default function LogsPage() {
    const { employee } = useAuth();
    const [reports, setReports] = useState<EODSubmissionDTO[]>([]);
    const [workHourLogs, setWorkHourLogs] = useState<WorkHourLogDTO[]>([]);
    const [adminEods, setAdminEods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();
    const [selectedMonthNum, setSelectedMonthNum] = useState(now.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear]         = useState(now.getFullYear());
    
    // Custom dropdown states
    const [isMonthOpen, setIsMonthOpen] = useState(false);
    const [isYearOpen, setIsYearOpen] = useState(false);
    const filterContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterContainerRef.current && !filterContainerRef.current.contains(event.target as Node)) {
                setIsMonthOpen(false);
                setIsYearOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Derived: 'YYYY-MM' string used for API calls and labels
    const selectedMonth = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`;

    const isAdmin = String(employee?.roleId || '').toUpperCase().includes('ADMIN');

    const loadData = useCallback(async () => {
        if (!employee?.id) return;

        try {
            setLoading(true);
            const promises: Promise<any>[] = [
                api.getMyEODs(employee.id),
                api.getRecentWorkHours(employee.id, 60)
            ];

            if (isAdmin) {
                const [year, month] = selectedMonth.split('-');
                const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0];
                const endOfMonth = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
                promises.push(api.getAllEODs({ startDate: startOfMonth, endDate: endOfMonth, limit: 2000 }));
            }

            const results = await Promise.all(promises);
            const rawReports = results[0] || [];
            const approvedReports = rawReports.filter((r: any) => r.status === 'APPROVED');
            setReports(approvedReports);
            setWorkHourLogs(results[1] || []);
            if (isAdmin && results[2]) {
                const rawAdminEods = results[2] || [];
                const approvedAdminEods = rawAdminEods.filter((r: any) => r.status === 'APPROVED');
                setAdminEods(approvedAdminEods);
            }
        } catch (err) {
            logger.error('Error', 'Failed to load logs:', err);
        } finally {
            setLoading(false);
        }
    }, [employee?.id, isAdmin, selectedMonth]);

    useEffect(() => {
        if (employee?.id) {
            loadData();
        }
    }, [employee?.id, loadData]);

    // Helper to get synced hours for a specific date/report
    const getSyncedHours = useCallback((reportDate: string) => {
        const targetDate = new Date(reportDate).toDateString();
        const report = reports.find(r => new Date(r.reportDate).toDateString() === targetDate);
        const reportHours = report?.workHours || (report as any)?.work_hours;
        if (reportHours && reportHours > 0) return reportHours;
        const matchingLog = workHourLogs.find(l => new Date(l.date).toDateString() === targetDate);
        return matchingLog?.hoursLogged || (matchingLog as any)?.hours_logged || 0;
    }, [reports, workHourLogs]);

    const stats = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const weeklyTotal = reports
            .filter(r => new Date(r.reportDate) >= startOfWeek)
            .reduce((acc, r) => acc + getSyncedHours(r.reportDate), 0);

        const monthlyTotal = reports
            .filter(r => {
                const rDate = new Date(r.reportDate);
                return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
            })
            .reduce((acc, r) => acc + getSyncedHours(r.reportDate), 0);

        return { weeklyTotal, monthlyTotal };
    }, [reports, getSyncedHours]);

    const adminStats = useMemo(() => {
        if (!isAdmin) return null;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        let totalMonth = 0;
        let totalWeek = 0;
        let totalToday = 0;
        const uniqueDays = new Set<string>();

        const employeeTotals: Record<string, { name: string, hours: number, avatar: string | null }> = {};

        adminEods.forEach(r => {
            const h = r.workHours || r.work_hours || 0;
            if (h <= 0) return;

            const rDate = new Date(r.reportDate);
            totalMonth += h;
            if (rDate >= startOfWeek) totalWeek += h;
            if (r.reportDate.startsWith(todayStr)) totalToday += h;
            uniqueDays.add(r.reportDate);

            const empId = r.employeeId || r.employee_id;
            const empName = r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unknown Employee';
            const empAvatar = r.employee?.profilePhoto || null;

            if (!employeeTotals[empId]) {
                employeeTotals[empId] = { name: empName, hours: 0, avatar: empAvatar };
            }
            employeeTotals[empId].hours += h;
        });

        const avgDaily = uniqueDays.size > 0 ? totalMonth / uniqueDays.size : 0;
        const contributors = Object.values(employeeTotals).sort((a, b) => b.hours - a.hours);
        return { totalMonth, totalWeek, totalToday, avgDaily, contributors };
    }, [adminEods, isAdmin]);

    // Derive human-readable month label for the selected month
    const selectedMonthLabel = useMemo(() => {
        return new Date(selectedYear, selectedMonthNum - 1, 1)
            .toLocaleString('default', { month: 'long', year: 'numeric' });
    }, [selectedYear, selectedMonthNum]);

    if (loading && reports.length === 0 && adminEods.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="logs-page page-root fade-in">
            <PageHeader
                title="Work Ledger"
                subtitle={
                    isAdmin ? (
                        <div className="stats-inline">
                            <span><TrendingUp size={16} /> Agency-wide hours view</span>
                        </div>
                    ) : (
                        <div className="stats-inline">
                            <span><Clock size={16} /> {stats.weeklyTotal.toFixed(1)} hrs This Week</span>
                            <span className="highlight"><History size={16} /> {stats.monthlyTotal.toFixed(1)} hrs This Month</span>
                        </div>
                    )
                }
                actions={
                    isAdmin ? (
                        <div className="toolbar-actions" ref={filterContainerRef}>
                            <div 
                                className="filter-pill" 
                                style={{ position: 'relative', cursor: 'pointer', minWidth: '140px', display: 'flex', justifyContent: 'space-between' }}
                                onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Calendar size={16} color="rgba(255,255,255,0.6)" />
                                    <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {['January','February','March','April','May','June','July','August','September','October','November','December'][selectedMonthNum - 1]}
                                    </span>
                                </div>
                                <ChevronDown size={14} color="rgba(255,255,255,0.5)" />
                                
                                {isMonthOpen && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, 
                                        background: '#121218', border: '1px solid rgba(255,255,255,0.1)', 
                                        borderRadius: '12px', padding: '8px 0', zIndex: 100, 
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '100%',
                                        maxHeight: '300px', overflowY: 'auto'
                                    }}>
                                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                                            <div 
                                                key={i+1}
                                                onClick={(e) => { e.stopPropagation(); setSelectedMonthNum(i+1); setIsMonthOpen(false); }}
                                                style={{ 
                                                    padding: '10px 16px', fontSize: '0.85rem', color: selectedMonthNum === i+1 ? 'var(--purple-main)' : 'white',
                                                    background: selectedMonthNum === i+1 ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                                                    cursor: 'pointer', transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (selectedMonthNum !== i+1) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                                                onMouseLeave={(e) => { if (selectedMonthNum !== i+1) e.currentTarget.style.background = 'transparent' }}
                                            >
                                                {m}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div 
                                className="filter-pill" 
                                style={{ position: 'relative', cursor: 'pointer', minWidth: '100px', display: 'flex', justifyContent: 'space-between' }}
                                onClick={() => { setIsYearOpen(!isYearOpen); setIsMonthOpen(false); }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Filter size={16} color="rgba(255,255,255,0.6)" />
                                    <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {selectedYear}
                                    </span>
                                </div>
                                <ChevronDown size={14} color="rgba(255,255,255,0.5)" />

                                {isYearOpen && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, 
                                        background: '#121218', border: '1px solid rgba(255,255,255,0.1)', 
                                        borderRadius: '12px', padding: '8px 0', zIndex: 100, 
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '100%',
                                        maxHeight: '300px', overflowY: 'auto'
                                    }}>
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                            <div 
                                                key={y}
                                                onClick={(e) => { e.stopPropagation(); setSelectedYear(y); setIsYearOpen(false); }}
                                                style={{ 
                                                    padding: '10px 16px', fontSize: '0.85rem', color: selectedYear === y ? 'var(--purple-main)' : 'white',
                                                    background: selectedYear === y ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                                                    cursor: 'pointer', transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (selectedYear !== y) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                                                onMouseLeave={(e) => { if (selectedYear !== y) e.currentTarget.style.background = 'transparent' }}
                                            >
                                                {y}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="header-badge">
                            <CheckCircle2 size={16} />
                            <span>Synced with EOD Submissions</span>
                        </div>
                    )
                }
            />


            {/* Employee Personal Cards */}
            {!isAdmin && (
                <div className="summary-cards">
                    <GlassCard className="summary-card">
                        <History className="card-icon-bg" size={120} />
                        <div className="card-content">
                            <div className="card-label">
                                <Clock size={14} /> Weekly Progress
                            </div>
                            <div className="card-value">
                                {stats.weeklyTotal.toFixed(1)} <span className="card-unit">hrs</span>
                            </div>
                            <div className="card-footer">
                                <span className="trend-neu">This Week's Activity</span>
                                <span className={stats.weeklyTotal >= 40 ? 'trend-pos' : ''}>
                                    {Math.min(100, Math.round((stats.weeklyTotal / 45) * 100))}% Capacity
                                </span>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="summary-card">
                        <TrendingUp className="card-icon-bg" size={120} />
                        <div className="card-content">
                            <div className="card-label">
                                <Calendar size={14} /> Monthly Utilization
                            </div>
                            <div className="card-value">
                                {stats.monthlyTotal.toFixed(1)} <span className="card-unit">hrs</span>
                            </div>
                            <div className="card-footer">
                                <span className="trend-neu">Total Hours in {new Date().toLocaleString('default', { month: 'long' })}</span>
                                <span className="trend-pos">Active Cycle</span>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Admin Agency Overview */}
            {isAdmin && (
                <div className="admin-overview">

                    <div className="admin-stat-cards">
                        <GlassCard className="admin-stat-card admin-stat-card--accent">
                            <div className="admin-stat-label">Total Month Hours</div>
                            <div className="admin-stat-value">
                                {adminStats?.totalMonth.toFixed(1) ?? '—'}
                                <span className="admin-stat-unit">hrs</span>
                            </div>
                        </GlassCard>
                        <GlassCard className="admin-stat-card">
                            <div className="admin-stat-label">This Week</div>
                            <div className="admin-stat-value">
                                {adminStats?.totalWeek.toFixed(1) ?? '—'}
                                <span className="admin-stat-unit">hrs</span>
                            </div>
                        </GlassCard>
                        <GlassCard className="admin-stat-card">
                            <div className="admin-stat-label">Today</div>
                            <div className="admin-stat-value">
                                {adminStats?.totalToday.toFixed(1) ?? '—'}
                                <span className="admin-stat-unit">hrs</span>
                            </div>
                        </GlassCard>
                        <GlassCard className="admin-stat-card">
                            <div className="admin-stat-label">Average Daily</div>
                            <div className="admin-stat-value">
                                {adminStats?.avgDaily.toFixed(1) ?? '—'}
                                <span className="admin-stat-unit">hrs</span>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Contribution Breakdown */}
                    <GlassCard className="contribution-card">
                        <h3 className="contribution-title">Contribution Breakdown</h3>
                        {(!adminStats || adminStats.contributors.length === 0) ? (
                            <div className="contribution-empty">
                                <Clock size={32} style={{ opacity: 0.2 }} />
                                <p className="contribution-empty-text">No EOD data for {selectedMonthLabel}.</p>
                                <p className="contribution-empty-sub">Try selecting a different month using the filter above.</p>
                            </div>
                        ) : (
                            <div className="contribution-list">
                                {adminStats.contributors.map((c, i) => {
                                    const percentage = adminStats.totalMonth > 0
                                        ? (c.hours / adminStats.totalMonth) * 100
                                        : 0;
                                    return (
                                        <div key={i} className="contribution-row">
                                            <div className="contribution-avatar">
                                                {c.avatar
                                                    ? <img src={c.avatar} alt={c.name} />
                                                    : c.name.charAt(0)}
                                            </div>
                                            <div className="contribution-info">
                                                <div className="contribution-meta">
                                                    <span className="contribution-name">{c.name}</span>
                                                    <div className="contribution-nums">
                                                        <span className="contribution-pct">{percentage.toFixed(1)}%</span>
                                                        <span className="contribution-hrs">{c.hours.toFixed(1)} hrs</span>
                                                    </div>
                                                </div>
                                                <div className="contribution-bar-bg">
                                                    <div
                                                        className="contribution-bar-fill"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>
                </div>
            )}

            {/* Employee Timeline — not shown for admin */}
            {!isAdmin && (
                <div className="timeline-container">
                    {reports.length === 0 ? (
                        <div className="empty-state">
                            <Clock className="empty-icon" />
                            <p>No EOD activity detected for this cycle.</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Hours will appear here after you submit your daily EOD report.</p>
                        </div>
                    ) : (
                        reports.map((report, index) => {
                            const tasks = Array.isArray(report.tasksCompleted) ? report.tasksCompleted : [];
                            const status = (report.status || 'SUBMITTED').toLowerCase();
                            const syncedHours = getSyncedHours(report.reportDate);

                            if (syncedHours === 0 && tasks.length === 0) return null;

                            return (
                                <div
                                    key={report.id}
                                    className="timeline-item"
                                    style={{ animationDelay: `${index * 0.1}s` }}
                                >
                                    <div className="timeline-node" />
                                    <div className="timeline-card">
                                        <div className="timeline-card-header">
                                            <div className="timeline-date">
                                                <span className="date-text">
                                                    {new Date(report.reportDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                <span className="time-text">
                                                    {report.submittedAt ? `Report Filed ${new Date(report.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Daily Status'}
                                                </span>
                                            </div>
                                            <div className={`timeline-status ${status}`}>
                                                {status}
                                            </div>
                                        </div>
                                        <div className="timeline-card-body">
                                            <div className="timeline-tasks">
                                                {tasks.length > 0 ? (
                                                    <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', margin: 0 }}>
                                                        {tasks.map((task, i) => (
                                                            <li key={i}>{task}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p style={{ margin: 0, opacity: 0.6 }}>Daily operational tasks.</p>
                                                )}
                                            </div>
                                            <div className="timeline-hours">
                                                <span className="hours-value">{syncedHours.toFixed(1)}</span>
                                                <span className="hours-label">Hours Logged</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
