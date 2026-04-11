'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { KpiAuditLogDTO } from '@/types/dto';
import { Clock, CheckCircle, FileText, Star, LogIn, AlertTriangle, Cpu } from 'lucide-react';
import './KpiAuditLedger.css';

export default function KpiAuditLedger({ employeeId }: { employeeId: string }) {
    const [logs, setLogs] = useState<KpiAuditLogDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!employeeId) return;
        api.getKpiAuditLogs(employeeId).then(data => {
            setLogs(data || []);
        }).finally(() => setLoading(false));
    }, [employeeId]);

    const getIcon = (source: string) => {
        switch (source) {
            case 'TASK_DEADLINE': return <Clock size={16} className="text-orange" />;
            case 'TASK_QUALITY': return <Star size={16} className="text-yellow" />;
            case 'LATE_LOGIN': return <LogIn size={16} className="text-red" />;
            case 'LEAVE_UNPAID': return <AlertTriangle size={16} className="text-red" />;
            case 'BONUS': return <CheckCircle size={16} className="text-green" />;
            case 'MANUAL_OVERRIDE': return <Cpu size={16} className="text-purple" />;
            default: return <FileText size={16} />;
        }
    };

    if (loading) return <div className="ledger-loader">Loading audit logs...</div>;

    if (logs.length === 0) {
        return null;
    }

    return (
        <div className="kpi-ledger">
            <h3 className="ledger-title">Performance Audit Log</h3>
            <div className="ledger-list">
                {logs.map((log) => (
                    <div key={log.id} className="ledger-row">
                        <div className="ledger-icon">{getIcon(log.event_source)}</div>
                        <div className="ledger-body">
                            <span className="ledger-desc">{log.description}</span>
                            <span className="ledger-time">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div className={`ledger-score ${log.points_change > 0 ? 'positive' : log.points_change < 0 ? 'negative' : 'neutral'}`}>
                            {log.points_change > 0 ? '+' : ''}{log.points_change} pts
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
