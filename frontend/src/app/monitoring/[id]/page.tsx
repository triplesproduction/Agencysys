'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Download, Shield, Laptop, Activity, Battery, RefreshCw, FileSpreadsheet, FileText, ExternalLink, Trash2 } from 'lucide-react';
import '../Monitoring.css';

interface EmployeeDetail {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    designation: string;
    monitoringPolicyId?: string;
    monitoring_policies?: {
        id: string;
        name: string;
        screenshotInterval: number;
        screenshotQuality: number;
        idleTimeout: number;
        multiMonitorCapture: boolean;
        autoClockOut: boolean;
        manualPausePermission: boolean;
        weekendTracking: boolean;
    };
}

interface Screenshot {
    id: string;
    timestamp: string;
    driveFileId: string;
    activityPercentage: number;
    sha256Hash?: string;
}

interface AppUsage {
    id: string;
    appName: string;
    durationSeconds: number;
}

interface Policy {
    id: string;
    name: string;
}

interface DeviceReg {
    id: string;
    deviceId: string;
    deviceName: string;
    operatingSystem: string;
    version: string;
    lastSeen: string;
    deviceFingerprint?: string;
    isTrusted: boolean;
}

interface Heartbeat {
    id: string;
    timestamp: string;
    status: string;
    activityPercentage: number;
    batteryStatus: string;
    networkStatus: string;
    runningVersion: string;
}

export default function EmployeeMonitoringDetail() {
    const params = useParams();
    const router = useRouter();
    const employeeId = params?.id as string;

    const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [appUsages, setAppUsages] = useState<AppUsage[]>([]);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [selectedPolicy, setSelectedPolicy] = useState('');
    const [devices, setDevices] = useState<DeviceReg[]>([]);
    const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeScreenshot, setActiveScreenshot] = useState<Screenshot | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'screenshots' | 'apps'>('overview');
    
    // Screenshot Date Filtering
    const todayStr = new Date().toISOString().split('T')[0];
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'fifteen_days' | 'month' | 'last_month' | 'custom'>('today');
    const [customDate, setCustomDate] = useState<string>(todayStr);

    // Temporary date filter states for the Apply/Filter button
    const [tempDateFilter, setTempDateFilter] = useState<'today' | 'yesterday' | 'week' | 'fifteen_days' | 'month' | 'last_month' | 'custom'>('today');
    const [tempCustomDate, setTempCustomDate] = useState<string>(todayStr);

    // Delete screenshot state
    const [deleteTarget, setDeleteTarget] = useState<Screenshot | null>(null);
    const [deleteHourTarget, setDeleteHourTarget] = useState<{ label: string; screenshots: Screenshot[] } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadData = async () => {
        if (!employeeId) return;

        try {
            // 1. Fetch Employee
            const { data: emp, error: empErr } = await supabase
                .from('employees')
                .select('*, monitoring_policies(*)')
                .eq('id', employeeId)
                .single();

            if (empErr) throw empErr;
            setEmployee(emp);
            setSelectedPolicy(emp.monitoringPolicyId || '');

            // 2. Fetch Policies list
            const { data: pols } = await supabase
                .from('monitoring_policies')
                .select('*');
            setPolicies(pols || []);

            // 3. Date Filtering logic
            const targetDate = new Date();
            let endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            if (dateFilter === 'yesterday') {
                targetDate.setDate(targetDate.getDate() - 1);
                targetDate.setHours(0, 0, 0, 0);
                endOfDay = new Date(targetDate);
                endOfDay.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'week') {
                // Get Monday of current week
                const day = targetDate.getDay();
                const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
                targetDate.setDate(diff);
                targetDate.setHours(0, 0, 0, 0);
                // endOfDay is end of today
                endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'fifteen_days') {
                targetDate.setDate(targetDate.getDate() - 14); // 15 days total including today
                targetDate.setHours(0, 0, 0, 0);
                // endOfDay is end of today
                endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'month') {
                targetDate.setDate(1); // 1st of current month
                targetDate.setHours(0, 0, 0, 0);
                // endOfDay is end of today
                endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'last_month') {
                targetDate.setMonth(targetDate.getMonth() - 1);
                targetDate.setDate(1); // 1st of last month
                targetDate.setHours(0, 0, 0, 0);
                
                endOfDay = new Date(targetDate);
                endOfDay.setMonth(endOfDay.getMonth() + 1);
                endOfDay.setDate(0); // Last day of last month
                endOfDay.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'custom' && customDate) {
                const parts = customDate.split('-');
                if (parts.length === 3) {
                    targetDate.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                }
                targetDate.setHours(0, 0, 0, 0);
                endOfDay = new Date(targetDate);
                endOfDay.setHours(23, 59, 59, 999);
            } else {
                targetDate.setHours(0, 0, 0, 0);
                endOfDay = new Date(targetDate);
                endOfDay.setHours(23, 59, 59, 999);
            }

            const { data: scs } = await supabase
                .from('employee_screenshots')
                .select('*')
                .eq('employeeId', employeeId)
                .gte('timestamp', targetDate.toISOString())
                .lte('timestamp', endOfDay.toISOString())
                .order('timestamp', { ascending: false });

            setScreenshots(scs || []);

            // 4. Fetch App Usage logs
            const { data: apps } = await supabase
                .from('application_usage')
                .select('*')
                .eq('employeeId', employeeId)
                .gte('startTime', targetDate.toISOString())
                .lte('startTime', endOfDay.toISOString());

            const appMap: Record<string, number> = {};
            (apps || []).forEach((row) => {
                appMap[row.appName] = (appMap[row.appName] || 0) + row.durationSeconds;
            });

            const aggregatedApps = Object.entries(appMap).map(([name, duration]) => ({
                id: name,
                appName: name,
                durationSeconds: duration
            })).sort((a, b) => b.durationSeconds - a.durationSeconds);

            setAppUsages(aggregatedApps);

            // 5. Fetch Device Registrations
            const { data: devs } = await supabase
                .from('device_registrations')
                .select('*')
                .eq('employeeId', employeeId);
            setDevices(devs || []);

            // 6. Fetch all heartbeats today to run timeline segment algorithms
            const { data: hbs } = await supabase
                .from('employee_heartbeats')
                .select('*')
                .eq('employeeId', employeeId)
                .gte('timestamp', targetDate.toISOString())
                .lte('timestamp', endOfDay.toISOString())
                .order('timestamp', { ascending: false });
            setHeartbeats(hbs || []);

        } catch (err) {
            console.error('Error loading employee monitoring details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [employeeId, dateFilter, customDate]);

    const handlePolicyChange = async (policyId: string) => {
        setSelectedPolicy(policyId);
        try {
            const { error } = await supabase
                .from('employees')
                .update({ monitoringPolicyId: policyId || null })
                .eq('id', employeeId);

            if (error) throw error;
            loadData();
        } catch (err) {
            console.error('Failed to update monitoring policy:', err);
        }
    };

    const getScreenshotUrl = (driveId: string) => {
        if (driveId.startsWith('gdrive_fallback_')) {
            const path = driveId.replace('gdrive_fallback_', '');
            const { data } = supabase.storage.from('documents').getPublicUrl(path);
            return data.publicUrl;
        }
        return '/logo.png';
    };

    const formatDuration = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    // Client-side report generation (CSV / Excel format)
    const exportToCSV = () => {
        if (!employee) return;
        const headers = 'Timestamp,Activity Percentage,Drive File ID,SHA256 Hash\n';
        const rows = screenshots.map(sc => `"${sc.timestamp}",${sc.activityPercentage},"${sc.driveFileId}","${sc.sha256Hash || ''}"`).join('\n');
        
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `monitoring_report_${employee.firstName}_${employee.lastName}_${new Date().toISOString().substring(0,10)}.csv`);
        link.click();
    };

    const handleDeleteScreenshot = async (sc: Screenshot) => {
        setIsDeleting(true);
        try {
            // 1. Delete from storage bucket using the file path stored in driveFileId
            const { error: storageError } = await supabase
                .storage
                .from('documents')
                .remove([sc.driveFileId]);

            if (storageError) {
                console.warn('Storage delete warning (may already be gone):', storageError.message);
            }

            // 2. Delete the database record permanently
            const { error: dbError } = await supabase
                .from('employee_screenshots')
                .delete()
                .eq('id', sc.id);

            if (dbError) throw dbError;

            // 3. Update local state — remove from list and close any open modals
            setScreenshots(prev => prev.filter(s => s.id !== sc.id));
            setDeleteTarget(null);
            if (activeScreenshot?.id === sc.id) setActiveScreenshot(null);
        } catch (err: any) {
            alert('Failed to delete screenshot: ' + err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteHour = async (label: string, scs: Screenshot[]) => {
        setIsDeleting(true);
        try {
            const fileIds = scs.map(s => s.driveFileId);
            const dbIds = scs.map(s => s.id);

            // 1. Bulk delete from storage bucket
            const { error: storageError } = await supabase
                .storage
                .from('documents')
                .remove(fileIds);

            if (storageError) {
                console.warn('Storage bulk delete warning:', storageError.message);
            }

            // 2. Bulk delete from DB table
            const { error: dbError } = await supabase
                .from('employee_screenshots')
                .delete()
                .in('id', dbIds);

            if (dbError) throw dbError;

            // 3. Update local state
            setScreenshots(prev => prev.filter(s => !dbIds.includes(s.id)));
            setDeleteHourTarget(null);
        } catch (err: any) {
            alert('Failed to delete screenshots: ' + err.message);
        } finally {
            setIsDeleting(false);
        }
    };


    // --- TELEMETRY COMPUTATIONS ---
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Calculate worked sessions and interruptions
    const timelineSegments: {
        date: string;
        startTime: string;
        endTime: string;
        type: 'WORKED' | 'INTERRUPTED' | 'BREAK';
        durationSeconds: number;
    }[] = [];

    // Grouping heartbeats chronologically
    const sortedHbs = [...heartbeats].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let currentSegment: { startTime: Date; endTime: Date; duration: number; type: 'WORKED' | 'BREAK' } | null = null;

    for (let i = 0; i < sortedHbs.length; i++) {
        const hb = sortedHbs[i];
        const hbTime = new Date(hb.timestamp);
        const isBreak = hb.status === 'PAUSED';
        const hbType = isBreak ? 'BREAK' : 'WORKED';

        if (!currentSegment) {
            currentSegment = {
                startTime: hbTime,
                endTime: hbTime,
                duration: 60,
                type: hbType
            };
        } else {
            const gapMs = hbTime.getTime() - currentSegment.endTime.getTime();
            const gapMins = gapMs / 1000 / 60;
            
            // If it is the same type AND the gap is small (<= 3 mins), merge it
            if (currentSegment.type === hbType && gapMins <= 3) {
                currentSegment.endTime = hbTime;
                currentSegment.duration += 60;
            } else {
                // Save current segment
                timelineSegments.push({
                    date: currentSegment.startTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                    startTime: currentSegment.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                    endTime: currentSegment.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                    type: currentSegment.type,
                    durationSeconds: Math.max(60, Math.round((currentSegment.endTime.getTime() - currentSegment.startTime.getTime()) / 1000))
                });

                // If the gap is large (> 3 mins), insert an interruption segment
                if (gapMins > 3) {
                    timelineSegments.push({
                        date: currentSegment.startTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                        startTime: currentSegment.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                        endTime: hbTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                        type: 'INTERRUPTED',
                        durationSeconds: Math.round((hbTime.getTime() - currentSegment.endTime.getTime()) / 1000)
                    });
                }

                currentSegment = {
                    startTime: hbTime,
                    endTime: hbTime,
                    duration: 60,
                    type: hbType
                };
            }
        }
    }

    if (currentSegment) {
        timelineSegments.push({
            date: currentSegment.startTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            startTime: currentSegment.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
            endTime: currentSegment.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
            type: currentSegment.type,
            durationSeconds: Math.max(60, Math.round((currentSegment.endTime.getTime() - currentSegment.startTime.getTime()) / 1000))
        });
    }

    // Sort segments from latest to earliest so new activity shows first, matching the timeline layout
    const reversedSegments = [...timelineSegments].reverse();

    // 1. Total Worked Hours (Sum of WORKED segments duration)
    const workedSeconds = timelineSegments
        .filter(s => s.type === 'WORKED')
        .reduce((acc, s) => acc + s.durationSeconds, 0);
    const workedHrs = Math.floor(workedSeconds / 3600);
    const workedMins = Math.floor((workedSeconds % 3600) / 60);
    const totalWorkedHoursStr = `${workedHrs}h ${String(workedMins).padStart(2, '0')}m`;

    // 2. Active Time (Worked Hours scaled by average activity percentage)
    const avgActivityPct = heartbeats.length > 0
        ? Math.round(heartbeats.reduce((acc, h) => acc + (h.activityPercentage || 0), 0) / heartbeats.length)
        : 0;
    const activeSeconds = Math.round(workedSeconds * (avgActivityPct / 100));
    const activeHrs = Math.floor(activeSeconds / 3600);
    const activeMins = Math.floor((activeSeconds % 3600) / 60);
    const activeTimeStr = `${activeHrs}h ${String(activeMins).padStart(2, '0')}m`;

    // 3. Productive Apps %
    const productiveKeywords = ['antigravity', 'vscode', 'claude.ai', 'github', 'terminal', 'cursor', 'xcode', 'figma', 'intellij', 'sublime', 'postman', 'browser', 'docs', 'sheets', 'excel', 'word', 'powerpoint', 'notion', 'slack', 'teams', 'zoom', 'skype', 'outlook', 'mail', 'drive', 'trello', 'jira', 'confluence'];
    const totalAppDuration = appUsages.reduce((acc, a) => acc + a.durationSeconds, 0);
    const productiveAppDuration = appUsages
        .filter(a => productiveKeywords.some(keyword => a.appName.toLowerCase().includes(keyword)))
        .reduce((acc, a) => acc + a.durationSeconds, 0);
    const productiveAppsPct = totalAppDuration > 0 ? Math.round((productiveAppDuration / totalAppDuration) * 100) : 0;

    // 4. Idle Time Spent %
    const idleTimePct = heartbeats.length > 0
        ? Math.round(heartbeats.filter(hb => hb.status === 'IDLE').length / heartbeats.length * 100)
        : 0;

    // 5. Clock-in Time (earliest heartbeat)
    let clockInTimeStr = '--:--';
    if (heartbeats.length > 0) {
        const earliestHb = sortedHbs[0];
        const dateObj = new Date(earliestHb.timestamp);
        clockInTimeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // 6. Clock-out Time (latest heartbeat if offline, otherwise Active)
    let clockOutTimeStr = '--:--';
    if (heartbeats.length > 0) {
        const latestHb = sortedHbs[sortedHbs.length - 1];
        const dateObj = new Date(latestHb.timestamp);
        const diffMinutes = (Date.now() - dateObj.getTime()) / 1000 / 60;
        if (diffMinutes > 5) {
            clockOutTimeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } else {
            clockOutTimeStr = 'Active';
        }
    }

    // Clock In & Out Summary Row Duration Badges
    const getWorkedDurationStr = (sec: number) => {
        const totalSec = sec <= 0 ? 60 : sec;
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    };

    // SVG Doughnut Chart Calculation
    const CHART_COLORS = [
        '#A78BFA', // Violet
        '#60A5FA', // Blue
        '#34D399', // Green
        '#FBBF24', // Yellow
        '#F87171', // Red
        '#F472B6', // Pink
        '#2DD4BF', // Teal
        '#FB923C', // Orange
    ];

    const circumference = 2 * Math.PI * 40; // 251.327
    let cumulativePercent = 0;

    const chartSlices = appUsages.slice(0, 8).map((app, index) => {
        const percent = totalAppDuration > 0 ? (app.durationSeconds / totalAppDuration) * 100 : 0;
        const strokeLength = (percent / 100) * circumference;
        const strokeOffset = -(cumulativePercent / 100) * circumference;
        cumulativePercent += percent;

        return {
            appName: app.appName,
            percent,
            color: CHART_COLORS[index % CHART_COLORS.length],
            strokeDasharray: `${strokeLength} ${circumference}`,
            strokeDashoffset: strokeOffset
        };
    });

    // Group screenshots by hour for the Screenshots tab
    const screenshotsByHour: Record<string, Screenshot[]> = {};
    screenshots.forEach(sc => {
        const hour = new Date(sc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/:[0-9]{2} /, ' '); // Very rough grouping
        const hourKey = new Date(sc.timestamp).getHours(); // 0-23
        const hourLabel = `${hourKey === 0 ? 12 : (hourKey > 12 ? hourKey - 12 : hourKey)}:00 ${hourKey >= 12 ? 'PM' : 'AM'} - ${(hourKey + 1) === 24 ? 12 : ((hourKey + 1) > 12 ? (hourKey + 1) - 12 : (hourKey + 1))}:00 ${(hourKey + 1) >= 12 && (hourKey + 1) < 24 ? 'PM' : 'AM'}`;
        
        if (!screenshotsByHour[hourLabel]) {
            screenshotsByHour[hourLabel] = [];
        }
        screenshotsByHour[hourLabel].push(sc);
    });

    return (
        <div className="monitoring-container">


            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--purple-main) transparent var(--purple-main) transparent' }}></div>
                </div>
            ) : employee ? (
                <>
                    {/* Header profile section matching Image 3 layout */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '2.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                            <div className="employee-avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                                {employee.firstName[0]}{employee.lastName[0]}
                            </div>
                            <div>
                                <h1 className="monitoring-title" style={{ marginBottom: '0.25rem', fontSize: '2rem' }}>
                                    {employee.firstName} {employee.lastName}
                                </h1>
                                <p style={{ color: '#8A8F98', fontSize: '0.92rem', margin: 0 }}>
                                    {employee.email || `${employee.firstName.toLowerCase()}@triplesproduction.com`}
                                </p>
                            </div>
                        </div>

                        <Link 
                            href="/monitoring"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 18px',
                                borderRadius: '12px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'var(--transition-smooth)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            <ArrowLeft size={16} />
                            Back to Monitoring
                        </Link>
                    </div>

                    {/* Global Date Filter Bar */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(15, 15, 20, 0.75)', padding: '12px 16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.04)', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                style={{
                                    background: tempDateFilter === 'today' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    border: 'none',
                                    color: tempDateFilter === 'today' ? '#ffffff' : '#8A8F98',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => {
                                    setTempDateFilter('today');
                                    setDateFilter('today');
                                }}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: tempDateFilter === 'yesterday' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    border: 'none',
                                    color: tempDateFilter === 'yesterday' ? '#ffffff' : '#8A8F98',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => {
                                    setTempDateFilter('yesterday');
                                    setDateFilter('yesterday');
                                }}
                            >
                                Yesterday
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: tempDateFilter === 'week' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    border: 'none',
                                    color: tempDateFilter === 'week' ? '#ffffff' : '#8A8F98',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => {
                                    setTempDateFilter('week');
                                    setDateFilter('week');
                                }}
                            >
                                This Week
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: tempDateFilter === 'fifteen_days' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    border: 'none',
                                    color: tempDateFilter === 'fifteen_days' ? '#ffffff' : '#8A8F98',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => {
                                    setTempDateFilter('fifteen_days');
                                    setDateFilter('fifteen_days');
                                }}
                            >
                                Last 15 Days
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: tempDateFilter === 'month' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    border: 'none',
                                    color: tempDateFilter === 'month' ? '#ffffff' : '#8A8F98',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => {
                                    setTempDateFilter('month');
                                    setDateFilter('month');
                                }}
                            >
                                This Month
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: tempDateFilter === 'last_month' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    border: 'none',
                                    color: tempDateFilter === 'last_month' ? '#ffffff' : '#8A8F98',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => {
                                    setTempDateFilter('last_month');
                                    setDateFilter('last_month');
                                }}
                            >
                                Last Month
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: tempDateFilter === 'custom' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    border: 'none',
                                    color: tempDateFilter === 'custom' ? '#ffffff' : '#8A8F98',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => setTempDateFilter('custom')}
                            >
                                Custom Date
                            </button>
                        </div>
                        
                        {tempDateFilter === 'custom' && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input 
                                    type="date" 
                                    style={{ 
                                        minWidth: '150px', 
                                        margin: 0, 
                                        background: 'rgba(0,0,0,0.3)', 
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: '#ffffff',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        fontFamily: 'Inter, sans-serif',
                                        outline: 'none'
                                    }}
                                    value={tempCustomDate}
                                    onChange={e => setTempCustomDate(e.target.value)}
                                />
                                <button 
                                    className="control-btn clock-in" 
                                    style={{ 
                                        padding: '8px 24px', 
                                        fontSize: '0.88rem', 
                                        cursor: 'pointer', 
                                        fontWeight: 700,
                                        fontFamily: 'Inter, sans-serif',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        margin: 0
                                    }}
                                    onClick={() => {
                                        setDateFilter(tempDateFilter);
                                        setCustomDate(tempCustomDate);
                                    }}
                                >
                                    Filter
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Stats Summary cards matching Image 3 */}
                    <div className="details-stats-grid">
                        <div className="detail-stat-card">
                            <div className="stat-label">Total Worked Hours</div>
                            <div className="stat-value">{totalWorkedHoursStr}</div>
                            <div className="stat-sublabel">Clocked-in hours (excludes breaks & screen lock)</div>
                        </div>
                        <div className="detail-stat-card">
                            <div className="stat-label">Active Time</div>
                            <div className="stat-value">{activeTimeStr}</div>
                            <div className="stat-sublabel">Time spent actively engaging with the system</div>
                        </div>
                        <div className="detail-stat-card">
                            <div className="stat-label">Productive Apps %</div>
                            <div className="stat-value">{productiveAppsPct}%</div>
                            <div className="stat-sublabel">Of time spent in apps marked as productive by the Admin</div>
                        </div>
                        <div className="detail-stat-card">
                            <div className="stat-label">Idle Time Spent %</div>
                            <div className="stat-value">{idleTimePct}%</div>
                            <div className="stat-sublabel">No system activity (inactive period)</div>
                        </div>
                        <div className="detail-stat-card">
                            <div className="stat-label">Clock-in Time</div>
                            <div className="stat-value">{clockInTimeStr}</div>
                            <div className="stat-sublabel">Start time recorded for the selected day</div>
                        </div>
                        <div className="detail-stat-card">
                            <div className="stat-label">Clock-Out Time</div>
                            <div className="stat-value">{clockOutTimeStr}</div>
                            <div className="stat-sublabel">End time recorded for the selected day</div>
                        </div>
                    </div>


                    {/* Tab Navigation */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                        <button 
                            onClick={() => setActiveTab('overview')} 
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: activeTab === 'overview' ? '#bb6bd9' : '#8A8F98', 
                                fontWeight: activeTab === 'overview' ? 700 : 500,
                                fontSize: '1rem',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                borderBottom: activeTab === 'overview' ? '2px solid #bb6bd9' : '2px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Overview
                        </button>
                        <button 
                            onClick={() => setActiveTab('screenshots')} 
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: activeTab === 'screenshots' ? '#bb6bd9' : '#8A8F98', 
                                fontWeight: activeTab === 'screenshots' ? 700 : 500,
                                fontSize: '1rem',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                borderBottom: activeTab === 'screenshots' ? '2px solid #bb6bd9' : '2px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Screenshots
                        </button>
                        <button 
                            onClick={() => setActiveTab('apps')} 
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: activeTab === 'apps' ? '#bb6bd9' : '#8A8F98', 
                                fontWeight: activeTab === 'apps' ? 700 : 500,
                                fontSize: '1rem',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                borderBottom: activeTab === 'apps' ? '2px solid #bb6bd9' : '2px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Apps & Websites
                        </button>
                    </div>

                    {activeTab === 'overview' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                                {/* Clock In & Out Summary Table Panel matching Image 1 */}
                                <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem', color: '#ffffff' }}>Clock In & Out Summary</h2>
                                    {heartbeats.length === 0 ? (
                                        <div style={{ color: '#a0aec0', padding: '3rem', textAlign: 'center', margin: 'auto' }}>
                                            No clock sessions logged today.
                                        </div>
                                    ) : (
                                        <div className="summary-table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                            <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                        <th style={{ padding: '12px 10px', fontSize: '0.85rem', color: '#8A8F98', fontWeight: 600 }}>Date</th>
                                                        <th style={{ padding: '12px 10px', fontSize: '0.85rem', color: '#8A8F98', fontWeight: 600 }}>Start Time</th>
                                                        <th style={{ padding: '12px 10px', fontSize: '0.85rem', color: '#8A8F98', fontWeight: 600 }}>End Time</th>
                                                        <th style={{ padding: '12px 10px', fontSize: '0.85rem', color: '#8A8F98', fontWeight: 600 }}>Activity Duration</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reversedSegments.map((segment, index) => {
                                                        const isWorked = segment.type === 'WORKED';
                                                        const isBreak = segment.type === 'BREAK';
                                                        return (
                                                            <tr 
                                                                key={index} 
                                                                style={{ 
                                                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                                                    background: isWorked ? 'rgba(16, 185, 129, 0.04)' : isBreak ? 'rgba(139, 92, 246, 0.03)' : 'transparent'
                                                                }}
                                                            >
                                                                <td style={{ padding: '14px 10px', fontSize: '0.88rem', fontWeight: 500, color: '#ffffff' }}>
                                                                    {segment.date}
                                                                </td>
                                                                <td style={{ padding: '14px 10px', fontSize: '0.88rem', color: (isWorked || isBreak) ? '#ffffff' : '#8A8F98' }}>
                                                                    {segment.startTime}
                                                                </td>
                                                                <td style={{ padding: '14px 10px', fontSize: '0.88rem', color: (isWorked || isBreak) ? '#ffffff' : '#8A8F98' }}>
                                                                    {segment.endTime}
                                                                </td>
                                                                <td style={{ padding: '14px 10px', fontSize: '0.88rem' }}>
                                                                    {isWorked ? (
                                                                        <span className="duration-badge">
                                                                            Worked for {getWorkedDurationStr(segment.durationSeconds)}
                                                                        </span>
                                                                    ) : isBreak ? (
                                                                        <span className="duration-badge" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#A78BFA', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                                                            On Break for {getWorkedDurationStr(segment.durationSeconds)}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: '#ff6b6b', fontWeight: 600 }}>
                                                                            Internet interrupted
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Device Registrations with fingerprints */}
                                <div className="panel">
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Laptop size={18} /> Registered Devices
                                    </h2>
                                    {devices.length === 0 ? (
                                        <div style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                                            No devices registered.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {devices.map((dev) => (
                                                <div key={dev.id} style={{
                                                    padding: '12px',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255,255,255,0.04)'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dev.deviceName}</span>
                                                        <span className={`status-indicator-badge ${dev.isTrusted ? 'online' : 'offline'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                                            {dev.isTrusted ? 'Trusted' : 'Untrusted'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                                                        {dev.operatingSystem} &bull; v{dev.version}
                                                    </div>
                                                    {dev.deviceFingerprint && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--purple-light)', marginTop: '4px', fontFamily: 'monospace' }}>
                                                            Fingerprint: {dev.deviceFingerprint.substring(0, 16)}...
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.65rem', color: '#a0aec0', marginTop: '6px', opacity: 0.6 }}>
                                                        ID: {dev.deviceId.substring(0, 16)}...
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'apps' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                            {/* Used Apps and Websites Panel matching Image 2 */}
                            <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem', color: '#ffffff' }}>Used Apps and Websites</h2>
                                {appUsages.length === 0 ? (
                                    <div style={{ color: '#a0aec0', padding: '3rem', textAlign: 'center', margin: 'auto' }}>
                                        No app usage data recorded today.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', margin: 'auto 0' }}>
                                        
                                        {/* App Capsules List */}
                                        <div className="apps-list-container" style={{ flex: '1', minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {chartSlices.map((slice, i) => (
                                                <div 
                                                    key={i} 
                                                    className="app-pill-capsule"
                                                    style={{
                                                        borderColor: `${slice.color}40`,
                                                        background: `${slice.color}0d` // ~5% opacity
                                                    }}
                                                >
                                                    <span className="app-pill-name" style={{ color: slice.color, fontWeight: 600, fontSize: '0.88rem' }}>
                                                        {slice.appName}
                                                    </span>
                                                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#8A8F98', marginRight: '10px' }}>
                                                        {formatDuration((appUsages[i]?.durationSeconds || 0))} ({slice.percent.toFixed(1)}%)
                                                    </span>
                                                    <span 
                                                        className="app-rating-badge"
                                                        style={{
                                                            color: slice.color,
                                                            background: `${slice.color}20`,
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            textTransform: 'lowercase'
                                                        }}
                                                    >
                                                        {productiveKeywords.some(keyword => slice.appName.toLowerCase().includes(keyword)) ? 'productive' : 'neutral'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Doughnut SVG Chart */}
                                        <div className="doughnut-chart-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, padding: '20px' }}>
                                            <svg width="220" height="220" viewBox="0 0 120 120">
                                                <circle cx="60" cy="60" r="40" fill="transparent" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="16" />
                                                {chartSlices.map((slice, i) => (
                                                    <circle
                                                        key={i}
                                                        cx="60"
                                                        cy="60"
                                                        r="40"
                                                        fill="transparent"
                                                        stroke={slice.color}
                                                        strokeWidth="16"
                                                        strokeDasharray={slice.strokeDasharray}
                                                        strokeDashoffset={slice.strokeDashoffset}
                                                        transform="rotate(-90 60 60)"
                                                        strokeLinecap="round"
                                                        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                                                    />
                                                ))}
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'screenshots' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {Object.keys(screenshotsByHour).length === 0 ? (
                                <div className="panel" style={{ color: '#a0aec0', padding: '4rem', textAlign: 'center' }}>
                                    No screenshots captured today.
                                </div>
                            ) : (
                                Object.entries(screenshotsByHour)
                                    .sort((a, b) => {
                                        const timeA = new Date(a[1][0].timestamp).getTime();
                                        const timeB = new Date(b[1][0].timestamp).getTime();
                                        return timeB - timeA;
                                    })
                                    .map(([hourLabel, scs]) => (
                                    <div key={hourLabel} className="panel">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                                                {hourLabel}
                                            </h2>
                                            <button
                                                onClick={() => setDeleteHourTarget({ label: hourLabel, screenshots: scs })}
                                                className="control-btn"
                                                style={{
                                                    background: 'rgba(255,107,107,0.1)',
                                                    border: '1px solid rgba(255,107,107,0.3)',
                                                    color: '#ff6b6b',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer',
                                                    width: 'auto'
                                                }}
                                            >
                                                <Trash2 size={13} />
                                                Delete All in Hour
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                                            {scs.map((sc) => {
                                                const url = getScreenshotUrl(sc.driveFileId);
                                                return (
                                                    <div 
                                                        key={sc.id} 
                                                        className="screenshot-thumbnail-card" 
                                                        style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', transition: 'transform 0.2s', position: 'relative' }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                                    >
                                                        <div onClick={() => setActiveScreenshot(sc)} className="screenshot-img-wrapper" style={{ position: 'relative', aspectRatio: '16/9' }}>
                                                            <img src={url} alt="Screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                {sc.activityPercentage}%
                                                            </div>
                                                        </div>
                                                        <div className="screenshot-metadata" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', fontSize: '0.85rem' }}>
                                                            <span onClick={() => setActiveScreenshot(sc)}>{new Date(sc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                                <span onClick={() => setActiveScreenshot(sc)} style={{ color: '#bb6bd9', cursor: 'pointer' }}>View</span>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(sc); }}
                                                                    title="Delete permanently"
                                                                    style={{
                                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                                        color: '#ff6b6b', display: 'flex', alignItems: 'center',
                                                                        padding: '2px', borderRadius: '4px',
                                                                        transition: 'background 0.15s'
                                                                    }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.15)')}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Future Enterprise Links Box */}
                    <div className="panel" style={{ marginTop: '2rem', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(155, 81, 224, 0.05)', borderColor: 'rgba(155, 81, 224, 0.2)' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enterprise Integrations:</span>
                        <button className="control-btn logout-btn" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem', opacity: 0.5, cursor: 'not-allowed' }} disabled>
                            <ExternalLink size={12} style={{ marginRight: '4px' }} /> Verify EOD Submission (Phase 3)
                        </button>
                        <button className="control-btn logout-btn" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem', opacity: 0.5, cursor: 'not-allowed' }} disabled>
                            <ExternalLink size={12} style={{ marginRight: '4px' }} /> Payroll Reconciliation (Phase 3)
                        </button>
                    </div>

                    {/* Screenshot Viewer Modal */}
                    {activeScreenshot && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(10,8,20,0.95)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '40px',
                            boxSizing: 'border-box'
                        }} onClick={() => setActiveScreenshot(null)}>
                            <div style={{
                                width: '100%',
                                maxWidth: '1000px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px'
                            }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                                            Screenshot taken at {new Date(activeScreenshot.timestamp).toLocaleTimeString()}
                                        </h3>
                                        <p style={{ margin: '4px 0 0 0', color: '#a0aec0', fontSize: '0.85rem' }}>
                                            Activity: {activeScreenshot.activityPercentage}% &bull; SHA256: {activeScreenshot.sha256Hash || 'N/A'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <a href={getScreenshotUrl(activeScreenshot.driveFileId)} download target="_blank" rel="noreferrer" className="control-btn logout-btn" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                                            <Download size={16} /> Download
                                        </a>
                                        <button
                                            onClick={() => setDeleteTarget(activeScreenshot)}
                                            className="control-btn"
                                            style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                        <button onClick={() => setActiveScreenshot(null)} className="control-btn logout-btn" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                                            Close
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    background: '#000',
                                    maxHeight: '75vh',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img 
                                        src={getScreenshotUrl(activeScreenshot.driveFileId)} 
                                        alt="Fullscreen screenshot" 
                                        style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}
            </>
            ) : (
                <div style={{ color: '#a0aec0', padding: '3rem', textAlign: 'center' }}>
                    Employee not found.
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(24px) saturate(120%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(120%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2000
                    }}
                    onClick={() => !isDeleting && setDeleteTarget(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--glass-surface)',
                            backdropFilter: 'blur(24px) saturate(180%)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '36px',
                            maxWidth: '440px',
                            width: '90%',
                            boxShadow: '0 40px 120px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                            <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderRadius: '50%', padding: '12px', display: 'flex', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <Trash2 size={24} color="#ef4444" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Delete Screenshot?</h3>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Permanently remove file</span>
                            </div>
                        </div>
                        
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: 'var(--radius-md, 12px)', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Screenshot Timestamp</p>
                            <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                                {new Date(deleteTarget.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                        </div>

                        <p style={{ color: '#ff9f9f', fontSize: '0.82rem', marginBottom: '24px', background: 'rgba(239, 68, 68, 0.04)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.08)', lineHeight: '1.4' }}>
                            ⚠️ This action cannot be undone. The image file will be deleted from storage and metadata records will be cleared.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                style={{ 
                                    padding: '10px 20px', 
                                    fontSize: '0.88rem', 
                                    borderRadius: '10px',
                                    background: 'transparent',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    transition: 'var(--transition-smooth)'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteScreenshot(deleteTarget)}
                                disabled={isDeleting}
                                style={{
                                    padding: '10px 20px', 
                                    fontSize: '0.88rem',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: '#ffffff',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)',
                                    opacity: isDeleting ? 0.6 : 1,
                                    transition: 'var(--transition-smooth)'
                                }}
                            >
                                <Trash2 size={15} />
                                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Hour Group Confirmation Modal */}
            {deleteHourTarget && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(24px) saturate(120%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(120%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2000
                    }}
                    onClick={() => !isDeleting && setDeleteHourTarget(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--glass-surface)',
                            backdropFilter: 'blur(24px) saturate(180%)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '36px',
                            maxWidth: '440px',
                            width: '90%',
                            boxShadow: '0 40px 120px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                            <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderRadius: '50%', padding: '12px', display: 'flex', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <Trash2 size={24} color="#ef4444" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Delete Hour Group?</h3>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Bulk remove screenshots</span>
                            </div>
                        </div>
                        
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: 'var(--radius-md, 12px)', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Hour Group Segment</p>
                            <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
                                {deleteHourTarget.label}
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                                Total items to delete: <span style={{ color: '#ef4444', fontWeight: 700 }}>{deleteHourTarget.screenshots.length}</span>
                            </p>
                        </div>

                        <p style={{ color: '#ff9f9f', fontSize: '0.82rem', marginBottom: '24px', background: 'rgba(239, 68, 68, 0.04)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.08)', lineHeight: '1.4' }}>
                            ⚠️ This action cannot be undone. All image files and database entries for this hour will be permanently deleted.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setDeleteHourTarget(null)}
                                disabled={isDeleting}
                                style={{ 
                                    padding: '10px 20px', 
                                    fontSize: '0.88rem', 
                                    borderRadius: '10px',
                                    background: 'transparent',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    transition: 'var(--transition-smooth)'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteHour(deleteHourTarget.label, deleteHourTarget.screenshots)}
                                disabled={isDeleting}
                                style={{
                                    padding: '10px 20px', 
                                    fontSize: '0.88rem',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: '#ffffff',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)',
                                    opacity: isDeleting ? 0.6 : 1,
                                    transition: 'var(--transition-smooth)'
                                }}
                            >
                                <Trash2 size={15} />
                                {isDeleting ? 'Deleting All...' : 'Confirm Bulk Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
