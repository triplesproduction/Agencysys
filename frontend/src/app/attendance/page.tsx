'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    Calendar as CalendarIcon, 
    ChevronLeft, 
    ChevronRight, 
    Plus, 
    Trash2, 
    ShieldCheck, 
    X, 
    Info,
    User as UserIcon,
    BarChart3,
    Palette
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { api } from '@/lib/api';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { HolidayDTO, AttendanceOverrideDTO, EODSubmissionDTO, LeaveApplicationDTO, EmployeeDTO } from '@/types/dto';
import { useAuth } from '@/context/AuthContext';
import './Attendance.css';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'HOLIDAY' | 'WORKED_ON_HOLIDAY' | 'NONE';

const statusConfig: Record<AttendanceStatus, { label: string, color: string, bg: string, glow: string }> = {
    PRESENT: { label: 'Present', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', glow: '0 0 12px rgba(16, 185, 129, 0.3)' },
    ABSENT: { label: 'Absent', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', glow: '0 0 12px rgba(239, 68, 68, 0.3)' },
    PAID_LEAVE: { label: 'Paid Leave', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.15)', glow: '0 0 12px rgba(124, 58, 237, 0.3)' },
    UNPAID_LEAVE: { label: 'Unpaid Leave', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', glow: '0 0 12px rgba(249, 115, 22, 0.3)' },
    HOLIDAY: { label: 'Holiday', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.1)', glow: 'none' },
    WORKED_ON_HOLIDAY: { label: 'Holiday Work', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', glow: '0 0 12px rgba(139, 92, 246, 0.3)' },
    NONE: { label: 'Pending', color: 'transparent', bg: 'transparent', glow: 'none' }
};

const MIN_DATE = new Date(2025, 3, 1); // April 2025

export default function AttendancePage() {
    const { employee } = useAuth();
    const { addNotification } = useNotifications();
    
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [data, setData] = useState<{
        eods: EODSubmissionDTO[],
        leaves: LeaveApplicationDTO[],
        holidays: HolidayDTO[],
        overrides: AttendanceOverrideDTO[]
    }>({ eods: [], leaves: [], holidays: [], overrides: [] });
    
    const [isLoading, setIsLoading] = useState(true);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [showOverrideModal, setShowOverrideModal] = useState<{ day: Date, status: AttendanceStatus } | null>(null);
    const [overrideReason, setOverrideReason] = useState('');
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '', is_working_day: false });

    const isAdmin = employee?.roleId === 'ADMIN';

    useEffect(() => {
        if (isAdmin) {
            api.getEmployees({ limit: 100 }).then(res => {
                setEmployees(res.data);
                if (res.data.length > 0 && !selectedEmployeeId) {
                    setSelectedEmployeeId(employee?.id || res.data[0].id);
                }
            });
        } else {
            setSelectedEmployeeId(employee?.id || '');
        }
    }, [isAdmin, employee]);

    useEffect(() => {
        if (selectedEmployeeId) {
            if (selectedMonth < MIN_DATE) {
                setSelectedMonth(MIN_DATE);
                return;
            }
            const monthYear = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
            setIsLoading(true);
            api.getAttendanceReport(selectedEmployeeId, monthYear).then(res => {
                setData(res);
                setIsLoading(false);
            }).catch(err => {
                console.error(err);
                setIsLoading(false);
            });
        }
    }, [selectedEmployeeId, selectedMonth]);

    const calendarDays = useMemo(() => {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const days = [];
        for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        return days;
    }, [selectedMonth]);

    const getDayStatus = (date: Date): AttendanceStatus => {
        const dateStr = date.toLocaleDateString('en-CA');
        
        const override = data.overrides.find(o => o.date === dateStr);
        if (override) return override.status as AttendanceStatus;

        const eod = data.eods.find(e => e.reportDate === dateStr);
        const holiday = data.holidays.find(h => h.date === dateStr);
        const isSunday = date.getDay() === 0;

        if (eod) {
            if (holiday || isSunday) return 'WORKED_ON_HOLIDAY';
            return 'PRESENT';
        }

        if (holiday || isSunday) return 'HOLIDAY';

        const leave = data.leaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
        if (leave) {
            return leave.leaveType === 'Paid Leave' ? 'PAID_LEAVE' : 'UNPAID_LEAVE';
        }

        const today = new Date();
        today.setHours(0,0,0,0);
        if (date < today) return 'ABSENT';
        
        return 'NONE';
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.name || !newHoliday.date) {
            addNotification({ title: 'Input Required', message: 'Please fill all fields', type: 'error' });
            return;
        }
        const hDate = new Date(newHoliday.date);
        if (hDate < MIN_DATE) {
            addNotification({ title: 'Invalid Date', message: 'Cannot register holidays before April 2025', type: 'error' });
            return;
        }
        try {
            await api.addHoliday(newHoliday);
            addNotification({ title: 'Success', message: 'Holiday added', type: 'success' });
            setShowHolidayModal(false);
            setNewHoliday({ date: '', name: '', is_working_day: false });
            refreshData();
        } catch (err) {
            addNotification({ title: 'Error', message: 'Failed to add holiday', type: 'error' });
        }
    };

    const handleSetOverride = async () => {
        if (!showOverrideModal) return;
        try {
            await api.setAttendanceOverride({
                employee_id: selectedEmployeeId,
                date: showOverrideModal.day.toLocaleDateString('en-CA'),
                status: showOverrideModal.status as any,
                reason: overrideReason
            });
            addNotification({ title: 'Saved', message: 'Override saved', type: 'success' });
            setShowOverrideModal(null);
            setOverrideReason('');
            refreshData();
        } catch (err) {
            addNotification({ title: 'Failed', message: 'Failed to save override', type: 'error' });
        }
    };

    const refreshData = () => {
        const monthYear = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
        api.getAttendanceReport(selectedEmployeeId, monthYear).then(setData);
    };

    const stats = useMemo(() => {
        const counts = { PRESENT: 0, ABSENT: 0, PAID_LEAVE: 0, UNPAID_LEAVE: 0, HOLIDAY: 0, WORKED_ON_HOLIDAY: 0 };
        calendarDays.forEach(day => {
            if (day) {
                const status = getDayStatus(day);
                if (status !== 'NONE') counts[status as keyof typeof counts]++;
            }
        });
        return counts;
    }, [calendarDays, data]);

    return (
        <div className="attendance-container">
            <header className="attendance-header">
                <div className="header-title-section">
                    <h1>Attendance & Leaves</h1>
                    <p>Track presence, monitor leave balances, and manage official holidays.</p>
                </div>

                <div className="header-actions">
                    <div className="month-navigator">
                        <button 
                            onClick={() => {
                                const newDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
                                if (newDate >= MIN_DATE) setSelectedMonth(newDate);
                            }} 
                            className="nav-btn"
                            disabled={new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1) < MIN_DATE}
                            style={{ opacity: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1) < MIN_DATE ? 0.3 : 1 }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="current-month">
                            {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </div>
                        <button onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))} className="nav-btn">
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {isAdmin && (
                        <button onClick={() => setShowHolidayModal(true)} className="primary-button">
                            <Plus size={18} />
                            Manage Holidays
                        </button>
                    )}
                </div>
            </header>

            <div className="attendance-main-layout">
                {/* Main Calendar Content */}
                <div className="calendar-section">
                    <div className="calendar-wrapper">
                        <div className="calendar-header-grid">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="day-name">{d}</div>
                            ))}
                        </div>
                        <div className="calendar-days-grid">
                            {calendarDays.map((day, idx) => {
                                if (!day) return <div key={idx} className="calendar-day-cell empty" />;
                                
                                const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                const status = getDayStatus(day);
                                const isToday = new Date().toDateString() === day.toDateString();
                                const holiday = data.holidays.find(h => h.date === dateStr);

                                return (
                                    <div key={idx} className={`calendar-day-cell ${isToday ? 'today' : ''}`}>
                                        <div className="day-number-wrapper">
                                            <span className="day-number">{day.getDate()}</span>
                                            {status !== 'NONE' && (
                                                <div 
                                                    className="status-indicator-dot" 
                                                    style={{ background: statusConfig[status].color }} 
                                                />
                                            )}
                                        </div>
                                        
                                        {status !== 'NONE' && (
                                            <div className="day-status-pill" style={{ color: statusConfig[status].color, background: statusConfig[status].bg }}>
                                                {statusConfig[status].label}
                                            </div>
                                        )}

                                        {holiday && (
                                            <span className="holiday-label">{holiday.name}</span>
                                        )}

                                        {isAdmin && (
                                            <div className="cell-overlay">
                                                <button 
                                                    className="override-trigger-btn"
                                                    onClick={() => setShowOverrideModal({ day, status })}
                                                >
                                                    Override
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats & Info */}
                <div className="attendance-sidebar">
                    {/* Widget 1: Personnel Profile */}
                    <GlassCard className="sidebar-widget-premium">
                        <div className="widget-header-compact">
                            <div className="widget-icon-wrapper">
                                <UserIcon size={18} />
                            </div>
                            <div className="widget-title-group">
                                <h3 className="widget-title-premium">Personnel Profile</h3>
                                <p className="widget-subtitle-premium">Member Leave Metrics</p>
                            </div>
                        </div>

                        <div className="widget-content-stacked">
                            <div className="selection-section">
                                <label className="field-label-premium">Select Team Member</label>
                                <select 
                                    className="select-premium-glass"
                                    value={selectedEmployeeId || ''}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id} className="bg-[#0f0f14]">
                                            {emp.firstName} {emp.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="leave-balance-card-premium">
                                <div className="leave-balance-row">
                                    <span className="leave-label">Available Leave Balance</span>
                                    <div className="leave-badge-premium">
                                        {employees.find(e => e.id === selectedEmployeeId)?.leave_balance || 0} Days
                                    </div>
                                </div>
                                <div className="leave-progress-container">
                                    <div 
                                        className="leave-progress-bar-fill" 
                                        style={{ width: `${Math.min(100, ((employees.find(e => e.id === selectedEmployeeId)?.leave_balance || 0) / 20) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Widget 2: Monthly Insights */}
                    <GlassCard className="sidebar-widget-premium">
                        <div className="widget-header-compact">
                            <div className="widget-icon-wrapper stats-accent">
                                <BarChart3 size={18} />
                            </div>
                            <div className="widget-title-group">
                                <h3 className="widget-title-premium">Monthly Insights</h3>
                                <p className="widget-subtitle-premium">{selectedMonth.toLocaleString('default', { month: 'long' })} Overview</p>
                            </div>
                        </div>

                        <div className="widget-content-stacked">
                            <div className="stats-compact-grid">
                                <div className="stat-pill-premium">
                                    <span className="stat-pill-label">Present</span>
                                    <span className="stat-pill-value text-emerald-400">{stats.PRESENT}</span>
                                </div>
                                <div className="stat-pill-premium">
                                    <span className="stat-pill-label">Absent</span>
                                    <span className="stat-pill-value text-red-400">{stats.ABSENT}</span>
                                </div>
                                <div className="stat-pill-premium">
                                    <span className="stat-pill-label">Leaves</span>
                                    <span className="stat-pill-value text-purple-400">{stats.PAID_LEAVE}</span>
                                </div>
                                <div className="stat-pill-premium">
                                    <span className="stat-pill-label">OT</span>
                                    <span className="stat-pill-value text-blue-400">{stats.WORKED_ON_HOLIDAY}</span>
                                </div>
                            </div>

                            <div className="legend-premium-section">
                                <div className="legend-header-compact">
                                    <Palette size={12} className="text-gray-400" />
                                    <span className="field-label-premium mb-0">Status Guide</span>
                                </div>
                                <div className="legend-items-wrap">
                                    {Object.entries(statusConfig).map(([key, cfg]) => (
                                        key !== 'NONE' && (
                                            <div key={key} className="legend-item-pill">
                                                <div className="legend-indicator" style={{ background: cfg.color }} />
                                                <span>{cfg.label}</span>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>

                            {isAdmin && (
                                <button onClick={() => setShowHolidayModal(true)} className="action-button-premium">
                                    <Plus size={16} /> Manage Holidays
                                </button>
                            )}
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* Holiday Manager Modal */}
            {showHolidayModal && (
                <div className="modal-overlay">
                    <GlassCard className="modal-content wide p-0 overflow-hidden">
                        <div className="modal-header-premium">
                            <div>
                                <h2 className="modal-title-gradient">Holiday Management</h2>
                                <p className="modal-subtitle">Register and manage official holidays for the organization.</p>
                            </div>
                            <button onClick={() => setShowHolidayModal(false)} className="close-btn-premium"><X size={20} /></button>
                        </div>
                        
                        <div className="p-8">
                            <div className="holiday-modal-body">
                                <div className="holiday-form-side space-y-6">
                                    <span className="modal-section-title">New Holiday Entry</span>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Holiday Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Independence Day"
                                            className="employee-select-glass"
                                            value={newHoliday.name}
                                            onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Observance Date</label>
                                        <input 
                                            type="date" 
                                            className="employee-select-glass"
                                            value={newHoliday.date}
                                            onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                                        />
                                    </div>
                                    <button onClick={handleAddHoliday} className="primary-button w-full mt-4">
                                        <Plus size={18} /> Register Holiday
                                    </button>
                                </div>

                                <div className="holiday-list-side">
                                    <span className="modal-section-title">Registered Holidays</span>
                                    <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                        {data.holidays.length === 0 ? (
                                            <div className="text-center py-12 opacity-30">
                                                <Info size={32} className="mx-auto mb-2" />
                                                <p className="text-sm">No holidays registered yet</p>
                                            </div>
                                        ) : (
                                            data.holidays.map(h => (
                                                <div key={h.id} className="holiday-item-glass">
                                                    <div className="holiday-info">
                                                        <h4>{h.name}</h4>
                                                        <p>{new Date(h.date).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                                    </div>
                                                    <button 
                                                        onClick={async () => {
                                                            if(confirm('Delete holiday?')) {
                                                                await api.deleteHoliday(h.id);
                                                                refreshData();
                                                            }
                                                        }}
                                                        className="delete-holiday-btn"
                                                        title="Remove Holiday"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Override Modal */}
            {showOverrideModal && (
                <div className="modal-overlay">
                    <GlassCard className="modal-content p-0 overflow-hidden" style={{ maxWidth: '520px' }}>
                        <div className="modal-header-premium">
                            <div>
                                <h2 className="modal-title-gradient">Attendance Correction</h2>
                                <p className="modal-subtitle">Record adjustment for {showOverrideModal.day.toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                            <button onClick={() => setShowOverrideModal(null)} className="close-btn-premium"><X size={20} /></button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-3 block letter-spacing-widest">Correction Status</label>
                                <select 
                                    value={showOverrideModal.status}
                                    onChange={(e) => setShowOverrideModal({ ...showOverrideModal, status: e.target.value as AttendanceStatus })}
                                    className="employee-select-glass"
                                >
                                    {Object.entries(statusConfig).filter(([k]) => k !== 'NONE').map(([key, cfg]) => (
                                        <option key={key} value={key} className="bg-[#0f0f14]">{cfg.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-3 block letter-spacing-widest">Adjustment Rationale</label>
                                <textarea 
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    placeholder="Briefly explain this manual override for audit purposes..."
                                    className="employee-select-glass h-32 resize-none p-4"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setShowOverrideModal(null)} className="secondary-button flex-1 py-4">Discard</button>
                                <button onClick={handleSetOverride} className="primary-button flex-1 py-4">Apply Changes</button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}
