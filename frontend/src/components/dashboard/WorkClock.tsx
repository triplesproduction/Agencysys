'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useClockIn, useClockOut, useAddWorkHourLog } from '@/hooks/queries/domains/attendance/useAttendance';
import GlassCard from '../GlassCard';
import { Play, Square, Clock, Zap } from 'lucide-react';
import './WorkClock.css';

interface WorkClockProps {
    employeeId: string;
    onClockUpdate?: () => void;
}

export default function WorkClock({ employeeId, onClockUpdate }: WorkClockProps) {
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);

    const { mutateAsync: clockIn, isPending: isClockingIn } = useClockIn();
    const { mutateAsync: clockOut, isPending: isClockingOut } = useClockOut();
    const { mutateAsync: addWorkHourLog, isPending: isAddingLog } = useAddWorkHourLog();
    const loading = isClockingIn || isClockingOut || isAddingLog;

    useEffect(() => {
        const savedStart = localStorage.getItem(`clock_in_${employeeId}`);
        if (savedStart) {
            setIsClockedIn(true);
            setStartTime(parseInt(savedStart));
        }
    }, [employeeId]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isClockedIn && startTime) {
            interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [isClockedIn, startTime]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleClockIn = async () => {
        try {
            await clockIn(employeeId);
            const now = Date.now();
            localStorage.setItem(`clock_in_${employeeId}`, String(now));
            setStartTime(now);
            setIsClockedIn(true);
        } catch (error) {
            logger.error('Error', 'Failed to clock in:', error);
        }
    };

    const handleClockOut = async () => {
        if (!startTime) return;
        try {
            await clockOut(employeeId);
            const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
            const hoursLogged = parseFloat((totalSeconds / 3600).toFixed(2));

            await addWorkHourLog({
                employeeId,
                date: new Date().toISOString().substring(0, 10),
                hoursLogged,
                description: 'Session log'
            });

            localStorage.removeItem(`clock_in_${employeeId}`);
            setIsClockedIn(false);
            setStartTime(null);
            if (onClockUpdate) onClockUpdate();
        } catch (error) {
            logger.error('Error', 'Failed to log hours:', error);
        }
    };

    return (
        <GlassCard className="work-clock-card">
            <div className="clock-header">
                <h3><Zap size={18} color="var(--purple-main)" /> Shift Tracker</h3>
                {isClockedIn && <span className="live-badge">LIVE</span>}
            </div>

            <div className="clock-body">
                <div className="time-display">
                    <Clock size={20} className="time-icon" />
                    <span>{isClockedIn ? formatTime(elapsed) : '00:00:00'}</span>
                </div>

                <div className="clock-actions">
                    {!isClockedIn ? (
                        <button className="clock-btn in" onClick={handleClockIn} disabled={loading}>
                            {loading ? <div className="spinner-small"></div> : <><Play size={16} fill="white" /> Start Shift</>}
                        </button>
                    ) : (
                        <button className="clock-btn out" onClick={handleClockOut} disabled={loading}>
                            {loading ? <div className="spinner-small"></div> : <><Square size={16} fill="white" /> End Shift</>}
                        </button>
                    )}
                </div>
            </div>

            <p className="clock-hint">
                {isClockedIn 
                    ? `Started at ${new Date(startTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'System calculates real-time Pace score'
                }
            </p>
        </GlassCard>
    );
}
