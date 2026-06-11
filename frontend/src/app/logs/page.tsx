'use client';

import { PageHeader } from '@/components/common/PageHeader';

import { useEffect, useState, useCallback, useMemo } from 'react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { EODSubmissionDTO, WorkHourLogDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import { Clock, Calendar, TrendingUp, History, Info, CheckCircle2 } from 'lucide-react';
import './Logs.css';

export default function LogsPage() {
    const { employee } = useAuth();
    const [reports, setReports] = useState<EODSubmissionDTO[]>([]);
    const [workHourLogs, setWorkHourLogs] = useState<WorkHourLogDTO[]>([]);
    const [adminEods, setAdminEods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().substring(0, 7));

    const isAdmin = String(employee?.roleId || '').toUpperCase().includes('ADMIN');

    const loadData = useCallback(async () => {
        if (!employee?.id) return;
        
        try {
            setLoading(true);
            // Fetch both EOD reports and Work Hour logs for maximum sync accuracy
            const promises: Promise<any>[] = [
                api.getMyEODs(employee.id),
                api.getRecentWorkHours(employee.id, 60) // Fetch last 2 months of logs
            ];

            if (isAdmin) {
                const [year, month] = selectedMonth.split('-');
                const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0];
                const endOfMonth = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
                promises.push(api.getAllEODs({ startDate: startOfMonth, endDate: endOfMonth, limit: 2000 }));
            }

            const results = await Promise.all(promises);
            
            setReports(results[0] || []);
            setWorkHourLogs(results[1] || []);
            if (isAdmin && results[2]) {
                setAdminEods(results[2]);
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
        
        // 1. Try to find the report for this date
        const report = reports.find(r => new Date(r.reportDate).toDateString() === targetDate);
        const reportHours = report?.workHours || (report as any)?.work_hours;
        
        if (reportHours && reportHours > 0) return reportHours;

        // 2. Fallback to work_hours table entries for this date
        const matchingLog = workHourLogs.find(l => new Date(l.date).toDateString() === targetDate);
        return matchingLog?.hoursLogged || (matchingLog as any)?.hours_logged || 0;
    }, [reports, workHourLogs]);

    const stats = useMemo(() => {
        const now = new Date();
        
        // Weekly Calculation (Current Week starting Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        // Map all unique EOD dates to their synced hours
        const weeklyTotal = reports
            .filter(r => new Date(r.reportDate) >= startOfWeek)
            .reduce((acc, r) => acc + getSyncedHours(r.reportDate), 0);

        // Monthly Calculation
        const monthlyTotal = reports
            .filter(r => {
                const rDate = new Date(r.reportDate);
                return rDate.getMonth() === new Date().getMonth() && rDate.getFullYear() === new Date().getFullYear();
            })
            .reduce((acc, r) => acc + getSyncedHours(r.reportDate), 0);

        return { weeklyTotal, monthlyTotal };
    }, [reports, getSyncedHours]);

    const adminStats = useMemo(() => {
        if (!adminEods.length) return null;
        
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        let totalMonth = 0;
        let totalWeek = 0;
        let totalToday = 0;
        
        const employeeTotals: Record<string, { name: string, hours: number, avatar: string }> = {};

        adminEods.forEach(r => {
            const h = r.workHours || r.work_hours || 0;
            if (h <= 0) return;

            const rDate = new Date(r.reportDate);
            
            totalMonth += h;
            if (rDate >= startOfWeek) totalWeek += h;
            if (r.reportDate.startsWith(todayStr)) totalToday += h;

            const empId = r.employeeId || r.employee_id;
            const empName = r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unknown Employee';
            const empAvatar = r.employee?.profilePhoto || null;

            if (!employeeTotals[empId]) {
                employeeTotals[empId] = { name: empName, hours: 0, avatar: empAvatar };
            }
            employeeTotals[empId].hours += h;
        });

        const contributors = Object.values(employeeTotals).sort((a, b) => b.hours - a.hours);

        return { totalMonth, totalWeek, totalToday, contributors };
    }, [adminEods]);

    if (loading && reports.length === 0) {
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
                    <div className="stats-inline">
                        <span><Clock size={16} /> {stats.weeklyTotal.toFixed(1)} hrs This Week</span>
                        <span className="highlight"><History size={16} /> {stats.monthlyTotal.toFixed(1)} hrs This Month</span>
                    </div>
                }
                actions={
                    <div className="header-badge">
                        <CheckCircle2 size={16} />
                        <span>Synced with EOD Submissions</span>
                    </div>
                }
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ 
                        padding: '10px 16px', 
                        borderRadius: '8px', 
                        background: 'rgba(255,255,255,0.05)', 
                        color: 'white', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        outline: 'none',
                        fontFamily: 'inherit',
                        cursor: 'pointer'
                    }}
                />
            </div>

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

            {isAdmin && adminStats && (
                <div style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--purple-main)' }}>
                        <TrendingUp size={20} /> Agency Overview (This Month)
                    </h2>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
                        <GlassCard style={{ flex: '1 1 200px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Total Month Hours</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{adminStats.totalMonth.toFixed(1)}<span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>hrs</span></div>
                        </GlassCard>
                        <GlassCard style={{ flex: '1 1 200px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>This Week</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{adminStats.totalWeek.toFixed(1)}<span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>hrs</span></div>
                        </GlassCard>
                        <GlassCard style={{ flex: '1 1 200px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Today</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{adminStats.totalToday.toFixed(1)}<span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>hrs</span></div>
                        </GlassCard>
                    </div>

                    <GlassCard style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px', color: 'white' }}>Contribution Breakdown</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {adminStats.contributors.map((c, i) => {
                                const percentage = adminStats.totalMonth > 0 ? (c.hours / adminStats.totalMonth) * 100 : 0;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(139,92,246,0.2)', color: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, overflow: 'hidden' }}>
                                            {c.avatar ? <img src={c.avatar} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.name.charAt(0)}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 600, color: 'white' }}>{c.name}</span>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{percentage.toFixed(1)}%</span>
                                                    <span style={{ color: 'var(--purple-main)', fontWeight: 800 }}>{c.hours.toFixed(1)} hrs</span>
                                                </div>
                                            </div>
                                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${percentage}%`, background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)', borderRadius: '4px' }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                </div>
            )}

            {isAdmin && (
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '40px 0 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--purple-main)' }}>
                    <History size={20} /> My Personal Work Ledger
                </h2>
            )}
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
                        
                        // Only show reports that actually have some time attached
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
        </div>
    );
}
