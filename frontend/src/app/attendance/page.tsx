'use client';

import { PageHeader } from '@/components/common/PageHeader';

import { useState, useEffect, useMemo } from 'react';
import { 
    Calendar as CalendarIcon, 
    ChevronLeft, 
    ChevronRight, 
    Plus, 
    Trash2, 
    X, 
    Info,
    User as UserIcon,
    BarChart3,
    Palette,
    Settings,
    ShieldAlert
} from 'lucide-react';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { HolidayDTO, AttendanceOverrideDTO, EODSubmissionDTO, LeaveApplicationDTO, EmployeeDTO, AttendanceReportDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import { useAttendanceReport, useAddHoliday, useDeleteHoliday } from '@/hooks/queries/domains/attendance/useAttendance';
import { api } from '@/lib/api'; // still needed for getEmployees
import './Attendance.css';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'HOLIDAY' | 'WORKED_ON_HOLIDAY' | 'NONE';

const statusConfig: Record<AttendanceStatus, { label: string, color: string, bg: string }> = {
    PRESENT: { label: 'Present', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
    ABSENT: { label: 'Absent (Unexcused)', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
    PAID_LEAVE: { label: 'Paid Leave', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' },
    UNPAID_LEAVE: { label: 'Unpaid Leave', color: '#F97316', bg: 'rgba(249, 115, 22, 0.1)' },
    HOLIDAY: { label: 'Holiday', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.05)' },
    WORKED_ON_HOLIDAY: { label: 'Holiday Work', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
    NONE: { label: 'Pending', color: 'transparent', bg: 'transparent' }
};

const MIN_DATE = new Date(2025, 3, 1);

export default function AttendancePage() {
    const { employee, loading: authLoading } = useAuth();
    const { addNotification } = useNotifications();
    
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const monthYearStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    const { data: reportData, isLoading: isReportLoading } = useAttendanceReport(selectedEmployeeId, monthYearStr);
    const { mutateAsync: addHoliday } = useAddHoliday();
    const { mutateAsync: deleteHoliday } = useDeleteHoliday();

    const data = reportData || {
        eods: [],
        leaves: [],
        holidays: [],
        overrides: []
    };
    
    const [loading, setLoading] = useState(true);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '', is_working_day: false });

    const isAdmin = useMemo(() => {
        if (!employee?.roleId) return false;
        return employee.roleId.toUpperCase().includes('ADMIN');
    }, [employee]);

    const canViewOthers = useMemo(() => {
        if (!employee?.roleId) return false;
        const role = employee.roleId.toUpperCase();
        return role.includes('ADMIN') || role.includes('MANAGER');
    }, [employee]);

    useEffect(() => {
        // Wait for auth to resolve before fetching — avoids a phantom empty-string query
        // during the brief window when employee is still null (auth loading)
        if (authLoading || !employee) return;

        setLoading(true);
        api.getEmployees({ limit: 100 }).then(res => {
            const list = (res.data || []).filter(e => e.roleId !== 'ADMIN');
            setEmployees(list);
            if (list.length > 0 && !selectedEmployeeId) {
                setSelectedEmployeeId(canViewOthers ? list[0].id : (employee?.id || ''));
            } else if (!canViewOthers) {
                setSelectedEmployeeId(employee?.id || '');
            }
            setLoading(false);
        });
    }, [canViewOthers, employee, authLoading]);

    // Handled by React Query hooks

    const calendarDays = useMemo(() => {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= lastDate; i++) days.push(new Date(year, month, i));
        return days;
    }, [selectedMonth]);

    const getDayStatus = (date: Date): AttendanceStatus => {
        const dateStr = date.toLocaleDateString('en-CA');
        const override = data.overrides.find((o: AttendanceOverrideDTO) => o.date === dateStr);
        if (override) return override.status as AttendanceStatus;

        const eod = data.eods.find((e: EODSubmissionDTO) => e.reportDate === dateStr);
        const holiday = data.holidays.find((h: HolidayDTO) => h.date === dateStr);
        const isSunday = date.getDay() === 0;

        const leave = data.leaves.find((l: LeaveApplicationDTO) => l.status === 'APPROVED' && dateStr >= l.startDate && dateStr <= l.endDate);
        if (leave) return leave.leaveType === 'UNPAID' ? 'UNPAID_LEAVE' : 'PAID_LEAVE';

        if (eod) return (holiday || isSunday) ? 'WORKED_ON_HOLIDAY' : 'PRESENT';
        
        if (holiday || isSunday) return 'HOLIDAY';

        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (date < today) {
            return 'UNPAID_LEAVE'; 
        }
        
        return 'NONE';
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.name || !newHoliday.date) return;
        try {
            await addHoliday(newHoliday);
            addNotification({ title: 'Holiday Registered', message: 'Holiday successfully added to the system', type: 'SUCCESS' });
            setShowHolidayModal(false);
            setNewHoliday({ date: '', name: '', is_working_day: false });
        } catch {
            addNotification({ title: 'Registration Failed', message: 'Could not register holiday', type: 'ERROR' });
        }
    };

    const isLoadingData = loading || isReportLoading;

    const stats = useMemo(() => {
        const counts = { PRESENT: 0, PAID_LEAVE: 0, UNPAID_LEAVE: 0, HOLIDAY: 0, WORKED_ON_HOLIDAY: 0 };
        calendarDays.forEach(day => {
            if (day) {
                const s = getDayStatus(day);
                if (s !== 'NONE' && s in counts) counts[s as keyof typeof counts]++;
            }
        });
        return counts;
    }, [calendarDays, data, getDayStatus]);

    return (
        <div className="attendance-root page-root fade-in">
            <PageHeader
                title="Attendance & Leaves"
                subtitle={<p className="subtitle">Track team presence and manage institutional holidays.</p>}
                actions={
                    <div className="hero-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="month-picker-glass">
                            <button 
                                className="nav-arrow"
                                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))}
                                disabled={selectedMonth <= MIN_DATE}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="current-month-display">
                                {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </div>
                            <button 
                                className="nav-arrow"
                                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {isAdmin && (
                            <button className="primary-button" onClick={() => setShowHolidayModal(true)}>
                                <Plus size={18} /> Manage Holidays
                            </button>
                        )}
                    </div>
                }
            />

            <div className="attendance-grid">
                {/* ── CALENDAR ── */}
                <div className="calendar-card">
                    <div className="calendar-header-strip">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="day-header">{d}</div>
                        ))}
                    </div>
                    <div className="calendar-body-grid">
                        {calendarDays.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} className="date-cell empty" />;
                            
                            const dateStr = day.toLocaleDateString('en-CA');
                            const status = getDayStatus(day);
                            const config = statusConfig[status] || statusConfig.NONE;
                            const holiday = data.holidays.find((h: HolidayDTO) => h.date === dateStr);
                            const isToday = new Date().toDateString() === day.toDateString();

                            return (
                                <div key={dateStr} className={`date-cell ${isToday ? 'today' : ''}`}>
                                    <div className="cell-top">
                                        <span className="cell-num">{day.getDate()}</span>
                                        {status !== 'NONE' && (
                                            <div className="status-dot" style={{ background: config.color }} />
                                        )}
                                    </div>
                                    
                                    {status !== 'NONE' && (
                                        <div className="status-label-pill" style={{ color: config.color, background: config.bg }}>
                                            {config.label}
                                        </div>
                                    )}

                                    {holiday && <div className="holiday-name-tag">{holiday.name}</div>}

                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── SIDEBAR ── */}
                <div className="attendance-sidebar">
                    <div className="sidebar-glass-card">
                        <div className="widget-title">
                            <UserIcon size={18} /> Personnel Context
                        </div>
                        <div className="member-select-wrap">
                            <label className="stat-v-label">Selected Employee</label>
                            {canViewOthers ? (
                                <select 
                                    className="liquid-select"
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="liquid-select" style={{ display: 'flex', alignItems: 'center', opacity: 0.7, pointerEvents: 'none', backgroundImage: 'none' }}>
                                    {employee?.firstName} {employee?.lastName}
                                </div>
                            )}
                        </div>
                        <div className="stat-v-item full-width">
                            <span className="stat-v-label">Remaining Paid Leaves</span>
                            <span className="stat-v-value">
                                {employees.find((e: EmployeeDTO) => e.id === selectedEmployeeId)?.leave_balance || 0}
                            </span>
                        </div>
                    </div>

                    <div className="sidebar-glass-card">
                        <div className="widget-title">
                            <BarChart3 size={18} /> Monthly Insights
                        </div>
                        <div className="stats-v-grid">
                            <div className="stat-v-item">
                                <span className="stat-v-label">Present</span>
                                <span className="stat-v-value" style={{ color: '#10B981' }}>{stats.PRESENT}</span>
                            </div>
                            <div className="stat-v-item">
                                <span className="stat-v-label">Unpaid Leave</span>
                                <span className="stat-v-value" style={{ color: '#EF4444' }}>{stats.UNPAID_LEAVE}</span>
                            </div>
                            <div className="stat-v-item">
                                <span className="stat-v-label">Paid Leave</span>
                                <span className="stat-v-value" style={{ color: '#7C3AED' }}>{stats.PAID_LEAVE}</span>
                            </div>
                            <div className="stat-v-item">
                                <span className="stat-v-label">Holiday OT</span>
                                <span className="stat-v-value" style={{ color: '#8B5CF6' }}>{stats.WORKED_ON_HOLIDAY}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── HOLIDAY MODAL ── */}
            {showHolidayModal && (
                <div className="glass-modal-overlay" onClick={() => setShowHolidayModal(false)}>
                    <div className="correction-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="correction-header">
                            <h3>Institution Holidays</h3>
                            <button className="nav-arrow" onClick={() => setShowHolidayModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="correction-body" style={{ paddingBottom: '0' }}>
                            <div className="modal-input-group">
                                <label className="input-label">Holiday Name</label>
                                <input 
                                    className="correction-textarea"
                                    style={{ minHeight: 'unset', padding: '12px 16px', marginBottom: '16px' }}
                                    type="text" 
                                    placeholder="e.g. Diwali"
                                    value={newHoliday.name}
                                    onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                                />
                            </div>
                            <div className="modal-input-group">
                                <label className="input-label">Date</label>
                                <input 
                                    className="correction-textarea"
                                    style={{ minHeight: 'unset', padding: '12px 16px', marginBottom: '16px' }}
                                    type="date"
                                    value={newHoliday.date}
                                    onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                                />
                            </div>

                            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                                <label className="input-label">Active Holidays</label>
                                <div className="active-holidays-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {data.holidays.length === 0 && <div style={{ opacity: 0.3, fontSize: '0.8rem', textAlign: 'center', padding: '20px' }}>No holidays registered</div>}
                                    {data.holidays.map((h: HolidayDTO) => (
                                        <div key={h.id} className="holiday-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '12px', marginBottom: '8px' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'white' }}>{h.name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{h.date}</div>
                                            </div>
                                            <button 
                                                className="nav-arrow" 
                                                style={{ color: '#EF4444' }}
                                                onClick={async () => { if(confirm('Delete holiday?')) { await deleteHoliday(h.id); } }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="correction-footer" style={{ marginTop: '20px' }}>
                            <button className="correction-btn-cancel" onClick={() => setShowHolidayModal(false)}>
                                Cancel
                            </button>
                            <button className="correction-btn-apply" onClick={handleAddHoliday}>
                                Register Holiday
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
