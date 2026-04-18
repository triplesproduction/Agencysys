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
    const [selectedBreakup, setSelectedBreakup] = useState<PayrollRecord | null>(null);


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
                    formula: `${base} - (${unpaidAbsences} days  ${dailyRate.toFixed(2)})`
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

    const stats = useMemo(() => ({
        totalPayout: payrollData.reduce((acc, curr) => acc + curr.netPayable, 0),
        totalDeductions: payrollData.reduce((acc, curr) => acc + curr.deductions, 0),
        onTimeEmployees: payrollData.filter(p => p.unpaidAbsences === 0).length
    }), [payrollData]);

    return (
        <div className="payroll-hub" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0 }}>
            {/* Redesigned Glass Stats Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', flexShrink: 0 }}>
                <div style={{ 
                    position: 'relative', 
                    padding: '20px', 
                    background: 'var(--glass-surface)', 
                    borderRadius: '20px', 
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    backdropFilter: 'blur(10px)',
                    boxShadow: 'var(--glass-shadow)'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: 'var(--purple-main)', filter: 'blur(40px)', opacity: 0.1, pointerEvents: 'none' }}></div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Total Monthly Payout</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.04em' }}>{stats.totalPayout.toLocaleString()}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', marginTop: '10px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34D399' }}></div>
                        Disbursal window: {monthNames[selectedMonth]} {selectedYear}
                    </div>
                </div>

                <div style={{ 
                    position: 'relative', 
                    padding: '20px', 
                    background: 'var(--glass-surface)', 
                    borderRadius: '20px', 
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    backdropFilter: 'blur(10px)',
                    boxShadow: 'var(--glass-shadow)'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: '#EF4444', filter: 'blur(40px)', opacity: 0.1, pointerEvents: 'none' }}></div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>System Deductions</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.04em' }}>{stats.totalDeductions.toLocaleString()}</div>
                    <div style={{ color: 'rgba(248, 113, 113, 0.45)', fontSize: '0.7rem', marginTop: '10px', fontWeight: 600 }}>Primarily attendance-based</div>
                </div>

                <div style={{ 
                    position: 'relative', 
                    padding: '20px', 
                    background: 'var(--glass-surface)', 
                    borderRadius: '20px', 
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    backdropFilter: 'blur(10px)',
                    boxShadow: 'var(--glass-shadow)'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: '#3B82F6', filter: 'blur(40px)', opacity: 0.1, pointerEvents: 'none' }}></div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Employee Engagement</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.04em' }}>{stats.onTimeEmployees}/{payrollData.length}</div>
                    <div style={{ color: 'rgba(96, 165, 250, 0.55)', fontSize: '0.7rem', marginTop: '10px', fontWeight: 600 }}>Active cycle participation</div>
                </div>
            </div>

            <div style={{ 
                flex: 1, 
                minHeight: 0, 
                display: 'flex', 
                flexDirection: 'column', 
                background: 'var(--glass-surface)', 
                border: '1px solid var(--glass-border)', 
                borderRadius: '24px', 
                overflow: 'hidden', 
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--glass-shadow)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    flexShrink: 0
                }}>
                    {/* Left: Search + Month picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div className="emp-search" style={{ maxWidth: '280px', background: 'rgba(0,0,0,0.2)' }}>
                            <Search size={15} />
                            <input
                                type="text"
                                placeholder="Filter records..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Month / Year picker */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '2px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            borderRadius: '12px', padding: '4px',
                        }}>
                            <button
                                onClick={() => {
                                    const prev = selectedMonth === 0 ? 11 : selectedMonth - 1;
                                    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
                                    setSelectedMonth(prev); setSelectedYear(prevYear);
                                }}
                                style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                            ><ChevronLeft size={16} /></button>
                            <div style={{ minWidth: '100px', textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {monthNames[selectedMonth]} {selectedYear}
                            </div>
                            <button
                                onClick={() => {
                                    const next = selectedMonth === 11 ? 0 : selectedMonth + 1;
                                    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
                                    setSelectedMonth(next); setSelectedYear(nextYear);
                                }}
                                style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                            ><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    {/* Right: Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button className="emp-action-btn" style={{ height: '38px', padding: '0 14px', fontSize: '0.75rem' }}>
                            <FileText size={14} /> Reports
                        </button>
                        <button 
                            disabled={isFinalizing}
                            onClick={async () => {
                                setIsFinalizing(true);
                                try {
                                    await Promise.all(payrollData.map(record => api.savePayrollRecord({
                                        ...record, employeeId: record.employee.id, month: selectedMonth, year: selectedYear, status: 'FINALIZED'
                                    })));
                                    addNotification({ title: 'Cycle Locked', message: 'Current month data archived.', type: 'SYSTEM' });
                                    const saved = await api.getPayrollRecords(selectedMonth, selectedYear);
                                    setFinalizedRecords(saved || []);
                                } catch (err: any) { alert('Archival failed: ' + err.message); }
                                finally { setIsFinalizing(false); }
                            }}
                            className="emp-action-btn-primary"
                            style={{ height: '38px', padding: '0 18px', fontSize: '0.75rem' }}
                        >
                            {isFinalizing ? 'Locking...' : 'Lock Cycle'}
                        </button>
                    </div>
                </div>

                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="emp-table" style={{ background: 'transparent', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 10 }}>
                                <th style={{ padding: '16px 24px', width: '25%' }}>Employee</th>
                                <th style={{ width: '15%' }}>Base</th>
                                <th style={{ width: '20%' }}>Attendance</th>
                                <th style={{ width: '15%' }}>Adjustments</th>
                                <th style={{ width: '15%' }}>Payout</th>
                                <th style={{ paddingRight: '24px', width: '10%', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '60px', textAlign: 'center' }}>
                                        <div className="spinner-mini" style={{ margin: '0 auto 16px' }}></div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Synchronizing ledger...</div>
                                    </td>
                                </tr>
                            ) : filteredPayroll.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>No records found.</td>
                                </tr>
                            ) : (
                                filteredPayroll.map((record) => (
                                    <tr key={record.employee.id} className="emp-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div className="emp-row-identity">
                                                <div className="emp-row-avatar" style={{ borderRadius: '10px', width: '36px', height: '36px' }}>
                                                    {record.employee.profilePhoto ? <img src={record.employee.profilePhoto} alt="" /> : record.employee.firstName.charAt(0)}
                                                </div>
                                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                                    <div className="emp-row-name" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.employee.firstName} {record.employee.lastName}</div>
                                                    <div className="emp-dept" style={{ fontSize: '0.7rem', marginTop: '1px', opacity: 0.6 }}>{record.employee.department}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>{record.baseSalary.toLocaleString()}</div>
                                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>FIXED</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{record.daysPresent}d</div>
                                                <div style={{ height: '3px', width: '30px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${(record.daysPresent / record.workingDays) * 100}%`, background: 'var(--purple-main)' }}></div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: record.approvedLeaves > 1 ? '#EF4444' : '#FBBF24', marginTop: '1px' }}>{record.approvedLeaves} Leaves</div>
                                        </td>
                                        <td>
                                            {record.deductions > 0 ? (
                                                <div style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.85rem' }}>-{record.deductions.toLocaleString()}</div>
                                            ) : (
                                                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem' }}>None</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981' }}>{record.netPayable.toLocaleString()}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                                            <button 
                                                className="emp-menu-btn"
                                                onClick={() => setSelectedBreakup(record)}
                                                style={{ width: '30px', height: '30px' }}
                                            >
                                                <ArrowUpRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                     {/* Breakup Drawer Portaled */}
            {selectedBreakup && typeof document !== 'undefined' && ReactDOM.createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', zIndex: 100000, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.2s' }} onClick={() => setSelectedBreakup(null)}>
                    <div 
                        className="slide-left"
                        style={{ 
                            background: 'rgba(10, 10, 12, 0.95)', 
                            width: '100%', 
                            maxWidth: '440px', 
                            height: '100%', 
                            borderLeft: '1px solid var(--glass-border)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            boxShadow: '-40px 0 80px rgba(0,0,0,0.6)', 
                            overflow: 'hidden',
                            backdropFilter: 'blur(25px)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '36px 32px 28px', borderBottom: '1px solid var(--glass-border)', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', background: 'var(--purple-main)', filter: 'blur(70px)', opacity: 0.15 }}></div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--purple-accent)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    <Activity size={13} /> Secure Audit Trail
                                </div>
                                <button onClick={() => setSelectedBreakup(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}></button>
                            </div>

                            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Financial Snapshot</h2>
                            <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: '6px', fontSize: '0.8rem', fontWeight: 500 }}>Ledger archive for {monthNames[selectedMonth]} {selectedYear}</p>

                            <div style={{ 
                                marginTop: '28px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '14px', 
                                background: 'rgba(255,255,255,0.03)', 
                                padding: '16px', 
                                borderRadius: '18px', 
                                border: '1px solid var(--glass-border)',
                                boxShadow: 'inset 0 0 20px rgba(255,255,255,0.02)'
                            }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, boxShadow: '0 8px 16px -4px rgba(0,0,0,0.4)', flexShrink: 0 }}>
                                    {selectedBreakup.employee.profilePhoto ? <img src={selectedBreakup.employee.profilePhoto} style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} /> : selectedBreakup.employee.firstName.charAt(0)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedBreakup.employee.firstName} {selectedBreakup.employee.lastName}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '1px', fontWeight: 600 }}>{selectedBreakup.employee.designation || 'Specialist'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
                                <div style={{ textAlign: 'center', padding: '14px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px', letterSpacing: '0.08em' }}>Cycle</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{selectedBreakup.workingDays}d</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '14px 6px', background: 'rgba(52, 211, 153, 0.04)', borderRadius: '16px', border: '1px solid rgba(52, 211, 153, 0.12)' }}>
                                    <div style={{ fontSize: '0.55rem', color: '#10B981', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px', opacity: 0.8 }}>Present</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10B981' }}>{selectedBreakup.daysPresent}d</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '14px 6px', background: 'rgba(247, 185, 36, 0.04)', borderRadius: '16px', border: '1px solid rgba(247, 185, 36, 0.12)' }}>
                                    <div style={{ fontSize: '0.55rem', color: '#FBBF24', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px', opacity: 0.8 }}>Leaves</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FBBF24' }}>{selectedBreakup.approvedLeaves}d</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {[
                                    { l: 'Base Compensation Rate', v: `${selectedBreakup.baseSalary.toLocaleString()}` },
                                    { l: 'Effective Daily Yield', v: `${(selectedBreakup.baseSalary / selectedBreakup.workingDays).toFixed(2)}` },
                                    { l: 'Loss of Pay Adjustments', v: selectedBreakup.unpaidAbsences > 0 ? `-${selectedBreakup.deductions.toLocaleString()}` : '', c: selectedBreakup.unpaidAbsences > 0 ? '#EF4444' : 'rgba(255,255,255,0.15)' }
                                ].map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', fontWeight: 500 }}>{item.l}</span>
                                        <span style={{ color: item.c || 'white', fontWeight: 800, fontSize: '0.9rem' }}>{item.v}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ 
                                marginTop: '28px', 
                                padding: '18px', 
                                borderRadius: '16px', 
                                background: 'rgba(124, 58, 237, 0.04)', 
                                border: '1px dashed rgba(139, 92, 246, 0.2)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--purple-accent)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.12em' }}>Algorithmic Derivation</div>
                                <div style={{ fontFamily: '"Roboto Mono", monospace', fontSize: '0.9rem', color: 'white', fontWeight: 640, background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>{selectedBreakup.formula}</div>
                            </div>
                        </div>

                        <div style={{ padding: '28px 32px 36px', borderTop: '1px solid var(--glass-border)', background: 'linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.04) 100%)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                <div>
                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Net Disbursement Amount</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>{selectedBreakup.netPayable.toLocaleString()}</div>
                                </div>
                                <div style={{ 
                                    padding: '6px 14px', 
                                    background: 'rgba(16, 185, 129, 0.1)', 
                                    color: '#10B981', 
                                    borderRadius: '10px', 
                                    fontSize: '0.7rem', 
                                    fontWeight: 900, 
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    letterSpacing: '0.02em',
                                    boxShadow: '0 4px 12px -4px rgba(16, 185, 129, 0.3)'
                                }}>
                                    READY
                                </div>
                            </div>
                            <button className="emp-action-btn-primary" style={{ width: '100%', height: '52px', borderRadius: '16px', fontSize: '0.95rem', fontWeight: 800, boxShadow: '0 12px 24px -10px var(--shadow-purple)' }} onClick={() => setSelectedBreakup(null)}>
                                Close Review View
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}


