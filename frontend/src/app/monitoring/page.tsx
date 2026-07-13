'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Download } from 'lucide-react';
import './Monitoring.css';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    designation: string;
    status: string;
    monitoringPolicyId?: string;
    monitoring_policies?: {
        name: string;
        screenshotInterval: number;
    };
    heartbeats?: {
        status: string;
        timestamp: string;
        activityPercentage: number;
    }[];
    metrics?: {
        appsUsedCount: number;
        avgActivePercentage: number;
        checkInTimeStr: string;
        hoursWorkedStr: string;
        runtimeStatus: string;
        totalWorkedSeconds: number;
        appInstalled?: boolean;
    };
}

export default function MonitoringDashboard() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [showMacInstructions, setShowMacInstructions] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText('xattr -cr /Applications/TripleS\\ OS.app');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const fetchMonitoringData = async () => {
        try {
            // Fetch all active employees (including admins) with their monitoring policies
            const { data: emps, error } = await supabase
                .from('employees')
                .select('*, monitoring_policies(*)')
                .eq('status', 'ACTIVE');

            if (error) throw error;

            // Fetch device registrations to check if app is installed
            const { data: devices } = await supabase
                .from('device_registrations')
                .select('employeeId');

            const installedEmployeeIds = new Set((devices || []).map(d => d.employeeId));

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // Fetch metrics for each employee concurrently
            const empsWithMetrics = await Promise.all(
                (emps || []).map(async (emp) => {
                    // Fetch today's heartbeats
                    const { data: hbs } = await supabase
                        .from('employee_heartbeats')
                        .select('status, timestamp, activityPercentage')
                        .eq('employeeId', emp.id)
                        .gte('timestamp', startOfDay.toISOString())
                        .order('timestamp', { ascending: false });

                    // Fetch today's work sessions
                    const { data: sessions } = await supabase
                        .from('work_sessions')
                        .select('startTime, endTime, status')
                        .eq('employeeId', emp.id)
                        .gte('startTime', startOfDay.toISOString());

                    // Fetch today's unique apps used count
                    const { data: apps } = await supabase
                        .from('application_usage')
                        .select('appName')
                        .eq('employeeId', emp.id)
                        .gte('startTime', startOfDay.toISOString());

                    const uniqueApps = new Set((apps || []).map(a => a.appName));
                    const appsUsedCount = uniqueApps.size;

                    // Calculate average activity percentage today
                    let avgActivePercentage = 0;
                    if (hbs && hbs.length > 0) {
                        const sum = hbs.reduce((acc, h) => acc + (h.activityPercentage || 0), 0);
                        avgActivePercentage = Math.round(sum / hbs.length);
                    }

                    // Get status from the last heartbeat with a 5-minute offline timeout
                    let runtimeStatus = 'offline';
                    const lastHb = hbs?.[0];
                    if (lastHb) {
                        const hbTime = new Date(lastHb.timestamp).getTime();
                        const now = Date.now();
                        const diffMinutes = (now - hbTime) / 1000 / 60;
                        if (diffMinutes <= 5) {
                            const statusLower = lastHb.status.toLowerCase();
                            if (statusLower === 'idle') {
                                runtimeStatus = 'idle';
                            } else if (statusLower === 'paused') {
                                runtimeStatus = 'paused';
                            } else {
                                runtimeStatus = 'online';
                            }
                        }
                    }

                    // Get check-in time today (first session start or first heartbeat)
                    let checkInTimeStr = '00:00';
                    if (sessions && sessions.length > 0) {
                        const sortedSessions = [...sessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                        const firstSession = sortedSessions[0];
                        const dateObj = new Date(firstSession.startTime);
                        checkInTimeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
                    } else if (hbs && hbs.length > 0) {
                        const sortedHbs = [...hbs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        const dateObj = new Date(sortedHbs[0].timestamp);
                        checkInTimeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
                    }

                    // Calculate total hours worked today using the exact same heartbeat segment logic as the details page
                    let totalWorkedSeconds = 0;
                    if (hbs && hbs.length > 0) {
                        const sortedHbs = [...hbs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        const timelineSegments: { type: string; durationSeconds: number }[] = [];
                        let currentSegment: { startTime: Date; endTime: Date; type: string } | null = null;

                        for (let i = 0; i < sortedHbs.length; i++) {
                            const hb = sortedHbs[i];
                            const hbTime = new Date(hb.timestamp);
                            const isBreak = hb.status === 'PAUSED';
                            const hbType = isBreak ? 'BREAK' : 'WORKED';

                            if (!currentSegment) {
                                currentSegment = {
                                    startTime: hbTime,
                                    endTime: hbTime,
                                    type: hbType
                                };
                            } else {
                                const gapMs = hbTime.getTime() - currentSegment.endTime.getTime();
                                const gapMins = gapMs / 1000 / 60;
                                
                                if (currentSegment.type === hbType && gapMins <= 3) {
                                    currentSegment.endTime = hbTime;
                                } else {
                                    timelineSegments.push({
                                        type: currentSegment.type,
                                        durationSeconds: Math.max(60, Math.round((currentSegment.endTime.getTime() - currentSegment.startTime.getTime()) / 1000))
                                    });

                                    currentSegment = {
                                        startTime: hbTime,
                                        endTime: hbTime,
                                        type: hbType
                                    };
                                }
                            }
                        }

                        if (currentSegment) {
                            timelineSegments.push({
                                type: currentSegment.type,
                                durationSeconds: Math.max(60, Math.round((currentSegment.endTime.getTime() - currentSegment.startTime.getTime()) / 1000))
                            });
                        }

                        totalWorkedSeconds = timelineSegments
                            .filter(s => s.type === 'WORKED')
                            .reduce((acc, s) => acc + s.durationSeconds, 0);
                    }

                    const workedHours = Math.floor(totalWorkedSeconds / 3600);
                    const workedMinutes = Math.floor((totalWorkedSeconds % 3600) / 60);
                    const hoursWorkedStr = `${String(workedHours).padStart(2, '0')}h ${String(workedMinutes).padStart(2, '0')}m`;

                    return {
                        ...emp,
                        heartbeats: hbs || [],
                        metrics: {
                            appsUsedCount,
                            avgActivePercentage,
                            checkInTimeStr,
                            hoursWorkedStr,
                            runtimeStatus,
                            totalWorkedSeconds,
                            appInstalled: installedEmployeeIds.has(emp.id)
                        }
                    };
                })
            );

            setEmployees(empsWithMetrics);
        } catch (err) {
            console.error('Error loading monitoring data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonitoringData();

        // Subscribe to real-time changes across all monitoring tables
        const channel = supabase
            .channel('realtime-monitoring')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employee_heartbeats' }, () => fetchMonitoringData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions' }, () => fetchMonitoringData())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_usage' }, () => fetchMonitoringData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Calculate aggregated metrics
    const totalEmployees = employees.length;
    const activeCount = employees.filter(e => e.metrics?.runtimeStatus === 'online').length;
    const idleCount = employees.filter(e => e.metrics?.runtimeStatus === 'idle').length;
    const offlineCount = totalEmployees - activeCount - idleCount;

    return (
        <div className="monitoring-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '15px' }}>
                <h1 className="monitoring-title" style={{ margin: 0, alignSelf: 'center' }}>Employee Monitoring</h1>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <a 
                            href="/api/monitoring/download?platform=mac" 
                            download
                            className="download-badge-btn"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.84-.98 2.94.1.08.2.12.31.12.87 0 1.94-.55 2.5-1.45z" />
                            </svg>
                            Download Mac App (.dmg)
                        </a>
                        <a 
                            href="/api/monitoring/download?platform=windows" 
                            download
                            className="download-badge-btn"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M0 3.449L9.75 2.1v9.451H0V3.449zM0 12.45h9.75v9.451L0 20.551V12.45zM10.875 1.95L24 0v11.55H10.875V1.95zM10.875 12.45H24v11.55l-13.125-1.95V12.45z" />
                            </svg>
                            Download Windows App (.exe)
                        </a>
                    </div>
                    <button 
                        onClick={() => setShowMacInstructions(!showMacInstructions)}
                        className="mac-setup-toggle-btn"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s ease', transform: showMacInstructions ? 'rotate(180deg)' : 'rotate(0)' }}>
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        1-Click Automated Mac Installation (Fix "Damaged" Error)
                    </button>
                </div>
            </div>

            {showMacInstructions && (
                <div className="mac-instructions-card">
                    <div className="mac-instructions-header">
                        <div className="mac-instructions-badge">macOS Installer Guide</div>
                        <button className="mac-instructions-close" onClick={() => setShowMacInstructions(false)}>×</button>
                    </div>
                    <h3 className="mac-instructions-title">1-Click Automated Mac Installation</h3>
                    <p className="mac-instructions-text">
                        Run this automated installer in your Terminal to download the app, install it, and bypass the Apple "damaged" security errors in one step.
                    </p>
                    <div className="mac-instructions-steps">
                        <div className="mac-instructions-step">
                            <span className="step-num">1</span>
                            <span className="step-desc">Open the <strong>Terminal</strong> app on your Mac (press <kbd>⌘ Space</kbd>, type <code>Terminal</code>, and press <kbd>Enter</kbd>).</span>
                        </div>
                        <div className="mac-instructions-step">
                            <span className="step-num">2</span>
                            <div className="step-desc">
                                Copy and run the installer command below in your Terminal:
                                <div className="mac-instructions-code-wrapper">
                                    <code className="mac-instructions-code">curl -sL https://triplesproduction.com/api/monitoring/install/mac | bash</code>
                                    <button onClick={() => {
                                        navigator.clipboard.writeText('curl -sL https://triplesproduction.com/api/monitoring/install/mac | bash');
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }} className="mac-instructions-copy-btn">
                                        {copied ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                                &nbsp;Copied!
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                </svg>
                                                &nbsp;Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mac-instructions-step">
                            <span className="step-num">3</span>
                            <span className="step-desc">Launch <strong>TripleS OS</strong> from your Applications folder. It will open instantly without errors!</span>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--purple-main) transparent var(--purple-main) transparent' }}></div>
                </div>
            ) : (
                <>
                    {/* Stats Summary cards */}
                    <div className="monitoring-stats-grid">
                        <div className="stat-card">
                            <div className="stat-label">Total Staff</div>
                            <div className="stat-value">{totalEmployees}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Currently Active</div>
                            <div className="stat-value" style={{ color: '#2ecc71' }}>{activeCount}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Idle (5m+)</div>
                            <div className="stat-value" style={{ color: '#f1c40f' }}>{idleCount}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Offline</div>
                            <div className="stat-value" style={{ color: '#a0aec0' }}>{offlineCount}</div>
                        </div>
                    </div>

                    <h2 style={{ fontSize: '1.4rem', marginBottom: '1.2rem', fontWeight: 700 }}>Real-Time Employee Activity</h2>

                    {/* Employee cards */}
                    <div className="employee-grid">
                        {employees.map((emp) => {
                            const metrics = emp.metrics || {
                                appsUsedCount: 0,
                                avgActivePercentage: 0,
                                checkInTimeStr: '00:00',
                                hoursWorkedStr: '00h 00m',
                                runtimeStatus: 'offline',
                                totalWorkedSeconds: 0,
                                appInstalled: true
                            };
                            const runtimeStatus = metrics.runtimeStatus;
                            const hasData = metrics.totalWorkedSeconds > 0 || metrics.appsUsedCount > 0;
                            const activePct = metrics.avgActivePercentage;
                            // ponytail: 12h cap — upgrade to configurable shift length if needed
                            const workedPct = Math.min((metrics.totalWorkedSeconds / 43200) * 100, 100);
                            
                            // Determine card status class for background coloring
                            let statusClass = '';
                            if (runtimeStatus === 'online') statusClass = 'status-active';
                            else if (runtimeStatus === 'idle') statusClass = 'status-idle';
                            else if (runtimeStatus === 'paused') statusClass = 'status-paused';

                            return (
                                <Link key={emp.id} href={`/monitoring/${emp.id}`} style={{ textDecoration: 'none' }}>
                                    <div className={`employee-card ${statusClass}`}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                            <div className="employee-info-header" style={{ marginBottom: 0 }}>
                                                <div className="employee-avatar">
                                                    {emp.firstName[0]}{emp.lastName[0]}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span className="employee-name">{emp.firstName} {emp.lastName}</span>
                                                    <span className="employee-worked-status">
                                                        {!metrics.appInstalled ? 'App Not Downloaded' : (hasData ? 'Worked today' : 'Yet to start work')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className={`active-time-text ${runtimeStatus === 'online' ? 'active' : 'inactive'}`}>
                                                    {activePct}%
                                                </span>
                                                <div className="active-time-label">Active Time</div>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '20px' }}>
                                            {!metrics.appInstalled ? (
                                                <span className="apps-used-badge no-data" style={{ color: '#F87171', backgroundColor: 'rgba(248, 113, 113, 0.1)' }}>
                                                    App Not Downloaded
                                                </span>
                                            ) : hasData ? (
                                                <span className="apps-used-badge">
                                                    {metrics.appsUsedCount} apps used
                                                </span>
                                            ) : (
                                                <span className="apps-used-badge no-data">
                                                    No data
                                                </span>
                                            )}
                                        </div>

                                        <div className="timeline-section">
                                            <div className="timeline-labels">
                                                <span className="timeline-checkin">{metrics.checkInTimeStr} Checked-in</span>
                                                <span className="timeline-hours">{metrics.hoursWorkedStr} Hours worked</span>
                                            </div>
                                            <div className="timeline-bar-container">
                                                <div className="timeline-bar-wrapper">
                                                    <div 
                                                        className="timeline-bar-progress" 
                                                        style={{ width: `${workedPct}%` }}
                                                    />
                                                </div>
                                                <div className="timeline-milestone-row">
                                                    <span className="timeline-milestone-tick" style={{ left: '16.67%' }}>2h</span>
                                                    <span className="timeline-milestone-tick" style={{ left: '33.33%' }}>4h</span>
                                                    <span className="timeline-milestone-tick" style={{ left: '50%' }}>6h</span>
                                                    <span className="timeline-milestone-tick" style={{ left: '66.67%' }}>8h</span>
                                                    <span className="timeline-milestone-tick" style={{ left: '83.33%' }}>10h</span>
                                                    <span className="timeline-milestone-tick" style={{ left: '100%', transform: 'translateX(-100%)' }}>12h</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
