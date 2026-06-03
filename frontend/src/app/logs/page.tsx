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
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!employee?.id) return;
        
        try {
            setLoading(true);
            // Fetch both EOD reports and Work Hour logs for maximum sync accuracy
            const [eodData, hourData] = await Promise.all([
                api.getMyEODs(employee.id),
                api.getRecentWorkHours(employee.id, 60) // Fetch last 2 months of logs
            ]);
            
            setReports(eodData || []);
            setWorkHourLogs(hourData || []);
        } catch (err) {
            logger.error('Error', 'Failed to load logs:', err);
        } finally {
            setLoading(false);
        }
    }, [employee?.id]);

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
