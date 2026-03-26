'use client';

import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { WorkHourLogDTO } from '@/types/dto';
import './Logs.css';

export default function LogsPage() {
    const [logs, setLogs] = useState<WorkHourLogDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLogs() {
            try {
                // Feature doesn't exist yet via simple query in new real api, mocking generic array to avoid crash
                setLogs([]);
            } finally {
                setLoading(false);
            }
        }
        loadLogs();
    }, []);

    if (loading) {
        return <div className="page-loader"><div className="spinner"></div></div>;
    }

    const totalHours = logs.reduce((acc, log) => acc + log.hoursLogged, 0);

    return (
        <div className="logs-page fade-in">
            <header className="page-header">
                <div>
                    <h1 className="greeting">Work Hours Dashboard</h1>
                    <p className="subtitle">Track your time and associated tasks.</p>
                </div>
                <GlassCard className="total-hours-card">
                    <div className="total-label">Total Hours This Week</div>
                    <div className="total-value">{totalHours} <span className="hrs">hrs</span></div>
                </GlassCard>
            </header>

            <GlassCard className="logs-table-card">
                <h2 className="section-title">Recent Entries</h2>
                {logs.length === 0 ? (
                    <div className="empty-state">No time logs recorded.</div>
                ) : (
                    <div className="table-responsive">
                        <table className="glass-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Task ID</th>
                                    <th>Description</th>
                                    <th className="text-right">Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td><div className="date-cell">{log.date}</div></td>
                                        <td><div className="task-cell">{log.taskId || 'None'}</div></td>
                                        <td>{log.description || '-'}</td>
                                        <td className="text-right"><span className="hours-badge">{log.hoursLogged}h</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
