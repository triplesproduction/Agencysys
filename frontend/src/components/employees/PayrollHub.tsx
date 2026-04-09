'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
    CreditCard, 
    Calendar, 
    ArrowUpRight, 
    ArrowDownRight, 
    Activity, 
    FileText, 
    Search,
    ChevronLeft,
    ChevronRight,
    Users
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { EmployeeDTO } from '@/types/dto';
import { api } from '@/lib/api';
import { useNotifications } from '../notifications/NotificationProvider';

interface PayrollHubProps {
    employees: EmployeeDTO[];
}

interface PayrollRecord {
    employee: EmployeeDTO;
    workingDays: number;
    daysPresent: number;
    approvedLeaves: number;
    unpaidAbsences: number;
    baseSalary: number;
    deductions: number;
    netPayable: number;
    formula: string;
}

export default function PayrollHub({ employees }: PayrollHubProps) {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showPicker, setShowPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const pickerAnchorRef = useRef<HTMLButtonElement>(null);
    const { addNotification } = useNotifications();
    const [finalizedRecords, setFinalizedRecords] = useState<any[]>([]);
    const [isFinalizing, setIsFinalizing] = useState(false);

    useEffect(() => {
        const fetchSavedRecords = async () => {
            try {
                const saved = await api.getPayrollRecords(selectedMonth, selectedYear);
                setFinalizedRecords(saved || []);
            } catch (err) {
                console.error('Failed to fetch saved payroll:', err);
            }
        };
        fetchSavedRecords();
    }, [selectedMonth, selectedYear]);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Helper: Get Working Days (Total days - Sundays)
    const getWorkingDaysCount = (year: number, month: number) => {
        const totalDays = new Date(year, month + 1, 0).getDate();
        let workingDays = 0;
        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            if (date.getDay() !== 0) { // 0 = Sunday
                workingDays++;
            }
        }
        return workingDays;
    };

    const calculatePayroll = async () => {
        setLoading(true);
        try {
            const workingDays = getWorkingDaysCount(selectedYear, selectedMonth);
            
            // Fetch real attendance data (unique EOD reports per day)
            // This returns a map of employeeId -> uniqueDaysCount
            const attendanceMap = await api.getMonthlyAttendance(selectedMonth, selectedYear);
            
            const results: PayrollRecord[] = employees.map(emp => {
                // Check if we have a finalized record for this employee
                const saved = finalizedRecords.find(r => r.employee_id === emp.id);
                if (saved) {
                    return {
                        id: saved.id,
                        employee: emp,
                        baseSalary: saved.base_salary,
                        deductions: saved.deductions,
                        netPayable: saved.net_payable,
                        workingDays: saved.working_days,
                        daysPresent: saved.days_present,
                        approvedLeaves: saved.approved_leaves,
                        unpaidAbsences: saved.unpaid_absences,
                        formula: saved.formula,
                        status: saved.status
                    };
                }

                // Fallback to calculation
                const base = (emp.employmentType === 'INTERNSHIP' && emp.internshipStatus === 'PAID' ? emp.internshipStipend : emp.baseSalary) || 0;
                
                // Real Attendance logic:
                // 1. presentDays are calculated from eod_reports
                // 2. approvedLeaves are counted separately
                // 3. User rule: "if they take 2 leaves then there salary shall be calculated according to it."
                //    -> Interpretation: 1 leave is allowed/paid, 2nd+ is deductible.
                
                const leavesInMonth = (emp.leaves || []).filter(l => {
                    const start = new Date(l.startDate);
                    return start.getMonth() === selectedMonth && start.getFullYear() === selectedYear && l.status === 'APPROVED';
                }).length;

                // Actual presence from EOD reports
                const realDaysPresent = attendanceMap[emp.id] || 0;
                
                // Total effective days (Presence + Paid Leaves)
                // We assume 1 paid leave is allowed as per the "2 leaves = deduction" rule.
                const paidLeavesUsed = Math.min(leavesInMonth, 1);
                const effectiveDays = realDaysPresent + paidLeavesUsed;
                
                // Unpaid gap (Working Days - Effective Days)
                const unpaidAbsences = Math.max(0, workingDays - effectiveDays);
                
                const dailyRate = base / workingDays;
                const deductions = unpaidAbsences * dailyRate;
                const netPayable = Math.max(0, base - deductions);

                return {
                    employee: emp,
                    workingDays,
                    daysPresent: realDaysPresent,
                    approvedLeaves: leavesInMonth,
                    unpaidAbsences,
                    baseSalary: base,
                    deductions,
                    netPayable,
                    formula: `${base} - (${unpaidAbsences} days × ${dailyRate.toFixed(2)})`
                };
            });

            setPayrollData(results);
        } catch (err) {
            console.error("Payroll calculation failed:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        calculatePayroll();
    }, [selectedMonth, selectedYear, employees]);

    const filteredPayroll = useMemo(() => {
        return payrollData.filter(p => 
            p.employee.firstName.toLowerCase().includes(search.toLowerCase()) ||
            p.employee.lastName.toLowerCase().includes(search.toLowerCase()) ||
            p.employee.department?.toLowerCase().includes(search.toLowerCase())
        );
    }, [payrollData, search]);

    const stats = useMemo(() => {
        return {
            totalPayout: payrollData.reduce((acc, curr) => acc + curr.netPayable, 0),
            totalDeductions: payrollData.reduce((acc, curr) => acc + curr.deductions, 0),
            onTimeEmployees: payrollData.filter(p => p.unpaidAbsences === 0).length
        };
    }, [payrollData]);

    return (
        <div className="payroll-hub" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Stats Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                <GlassCard style={{ padding: '24px', background: 'rgba(139, 92, 246, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Total Monthly Payout</div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>+12% vs last</div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '12px 0 4px', color: 'white' }}>₹{stats.totalPayout.toLocaleString()}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <CreditCard size={14} /> Scheduled for {monthNames[selectedMonth]} 28th
                    </div>
                </GlassCard>

                <GlassCard style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Global Deductions</div>
                        <div style={{ color: '#EF4444' }}><ArrowDownRight size={20} /></div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '12px 0 4px', color: 'white' }}>₹{stats.totalDeductions.toLocaleString()}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <Activity size={14} /> Primarily from leave overruns
                    </div>
                </GlassCard>

                <GlassCard style={{ padding: '24px', background: 'rgba(139, 92, 246, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Perfomance Accuracy</div>
                        <div style={{ color: 'var(--purple-main)' }}><Users size={20} /></div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '12px 0 4px', color: 'white' }}>{stats.onTimeEmployees}/{payrollData.length}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <ArrowUpRight size={14} /> Full attendance this month
                    </div>
                </GlassCard>
            </div>

            <GlassCard style={{ padding: 0, overflow: 'visible' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    flexWrap: 'wrap',
                }}>
                    {/* Left: Search + Month picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px', padding: '8px 14px', flex: 1, maxWidth: '280px',
                        }}>
                            <Search size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder="Search payroll records..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '0.85rem', width: '100%' }}
                            />
                        </div>

                        {/* Month / Year picker */}
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '10px', padding: '6px 10px',
                            }}>
                                <button
                                    onClick={() => {
                                        const prev = selectedMonth === 0 ? 11 : selectedMonth - 1;
                                        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
                                        setSelectedMonth(prev);
                                        setSelectedYear(prevYear);
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', padding: '2px 4px', borderRadius: '6px', transition: 'all 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    ref={pickerAnchorRef}
                                    onClick={() => {
                                        if (!showPicker && pickerAnchorRef.current) {
                                            const rect = pickerAnchorRef.current.getBoundingClientRect();
                                            setPickerPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
                                            setPickerYear(selectedYear);
                                        }
                                        setShowPicker(v => !v);
                                    }}
                                    style={{ minWidth: '120px', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem', color: 'white', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: '6px', transition: 'background 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    {monthNames[selectedMonth]} {selectedYear}
                                </button>
                                <button
                                    onClick={() => {
                                        const next = selectedMonth === 11 ? 0 : selectedMonth + 1;
                                        const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
                                        setSelectedMonth(next);
                                        setSelectedYear(nextYear);
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', padding: '2px 4px', borderRadius: '6px', transition: 'all 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            {/* Month/Year Quick Picker — portaled to document.body to escape backdrop-filter stacking context */}
                            {showPicker && typeof document !== 'undefined' && ReactDOM.createPortal(
                                <div
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        position: 'fixed',
                                        top: pickerPos.top,
                                        left: pickerPos.left,
                                        transform: 'translateX(-50%)',
                                        zIndex: 99999,
                                        background: '#0d0d1a',
                                        border: '1px solid rgba(139,92,246,0.25)',
                                        borderRadius: '16px', padding: '18px',
                                        width: '260px',
                                        boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
                                    }}
                                >
                                    {/* Year */}
                                    <div style={{ marginBottom: '14px' }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Select Year</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); setPickerYear(y => Math.max(2020, y - 1)); }}
                                                style={{
                                                    width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                                                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                                                    color: '#a78bfa', fontSize: '1.1rem', fontWeight: 700,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.3)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; }}
                                            >‹</button>
                                            <div style={{
                                                flex: 1, textAlign: 'center', fontWeight: 800, fontSize: '1.4rem',
                                                color: 'white', letterSpacing: '-0.02em',
                                            }}>{pickerYear}</div>
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); setPickerYear(y => Math.min(2030, y + 1)); }}
                                                style={{
                                                    width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                                                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                                                    color: '#a78bfa', fontSize: '1.1rem', fontWeight: 700,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.3)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; }}
                                            >›</button>
                                        </div>
                                    </div>

                                    {/* Month */}
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Month</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                        {monthNames.map((m, i) => {
                                            const isSelected = i === selectedMonth && pickerYear === selectedYear;
                                            return (
                                                <button
                                                    key={m}
                                                    onClick={() => { setSelectedMonth(i); setSelectedYear(pickerYear); setShowPicker(false); }}
                                                    style={{
                                                        padding: '8px 4px', borderRadius: '8px',
                                                        border: isSelected ? '1px solid var(--purple-main)' : '1px solid rgba(255,255,255,0.08)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem', fontWeight: isSelected ? 700 : 500,
                                                        background: isSelected ? 'var(--purple-main)' : '#1a1a2e',
                                                        color: isSelected ? 'white' : 'rgba(255,255,255,0.7)',
                                                        transition: 'all 0.15s',
                                                    }}
                                                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'rgba(139,92,246,0.2)'; e.currentTarget.style.color = 'white'; } }}
                                                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = '#1a1a2e'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}
                                                >
                                                    {m.slice(0, 3)}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        <button
                                            onClick={() => setShowPicker(false)}
                                            style={{
                                                width: '100%', padding: '7px',
                                                background: '#1a1a2e',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '8px', color: 'rgba(255,255,255,0.45)',
                                                cursor: 'pointer', fontSize: '0.8rem',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#1a1a2e'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
                                        >Dismiss</button>
                                    </div>
                                </div>,
                                        document.body
                            )}
                        </div>
                    </div>

                    {/* Right: Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <button style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 16px', background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                            color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                        >
                            <FileText size={15} /> Generate Slips
                        </button>
                        <button
                            disabled={isFinalizing}
                            onClick={async () => {
                                setIsFinalizing(true);
                                try {
                                    // Save all current records
                                    await Promise.all(payrollData.map(record => 
                                        api.savePayrollRecord({
                                            ...record,
                                            employeeId: record.employee.id,
                                            month: selectedMonth,
                                            year: selectedYear,
                                            status: 'FINALIZED'
                                        })
                                    ));

                                    addNotification({
                                        title: 'Payroll Locked',
                                        message: `Monthly records for ${monthNames[selectedMonth]} have been archived.`,
                                        type: 'SYSTEM'
                                    });
                                    
                                    // Refresh finalized records
                                    const saved = await api.getPayrollRecords(selectedMonth, selectedYear);
                                    setFinalizedRecords(saved || []);
                                } catch (err: any) {
                                    alert('Failed to lock payroll: ' + err.message);
                                } finally {
                                    setIsFinalizing(false);
                                }
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 18px', background: 'var(--purple-main)',
                                border: '1px solid transparent', borderRadius: '10px',
                                color: 'white', fontSize: '0.85rem', fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.2s ease',
                                boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
                                opacity: isFinalizing ? 0.7 : 1
                            }}
                            onMouseEnter={e => { if(!isFinalizing) e.currentTarget.style.background = '#7c3aed'; }}
                            onMouseLeave={e => { if(!isFinalizing) e.currentTarget.style.background = 'var(--purple-main)'; }}
                        >
                            {isFinalizing ? 'Locking...' : 'Finalize Payroll'}
                        </button>
                    </div>
                </div>


                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                                <th style={{ padding: '20px 24px' }}>Employee</th>
                                <th style={{ padding: '20px 24px' }}>Dept / Role</th>
                                <th style={{ padding: '20px 24px' }}>Base / Stipend</th>
                                <th style={{ padding: '20px 24px' }}>Attendance</th>
                                <th style={{ padding: '20px 24px' }}>Deductions</th>
                                <th style={{ padding: '20px 24px' }}>Net Payable</th>
                                <th style={{ padding: '20px 24px', textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                        Calculating metrics...
                                    </td>
                                </tr>
                            ) : filteredPayroll.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>No payroll records found for this period.</td>
                                </tr>
                            ) : (
                                filteredPayroll.map((record) => (
                                    <tr key={record.employee.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.03)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
                                                    {record.employee.profilePhoto ? <img src={record.employee.profilePhoto} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : record.employee.firstName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'white' }}>{record.employee.firstName} {record.employee.lastName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{record.employee.employmentType}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ fontSize: '0.85rem', color: 'white' }}>{record.employee.department}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{record.employee.roleId}</div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ fontWeight: 500, color: 'white' }}>₹{record.baseSalary.toLocaleString()}</div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'white' }}>{record.daysPresent}/{record.workingDays}</span>
                                                <span style={{ fontSize: '0.75rem', color: record.approvedLeaves > 1 ? '#EF4444' : '#F59E0B' }}>({record.approvedLeaves} L)</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ color: record.deductions > 0 ? '#EF4444' : 'var(--text-secondary)', fontWeight: 600 }}>
                                                {record.deductions > 0 ? `- ₹${record.deductions.toLocaleString()}` : '—'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10B981' }}>₹{record.netPayable.toLocaleString()}</div>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                            <button className="secondary-button" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>View Breakup</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
}
