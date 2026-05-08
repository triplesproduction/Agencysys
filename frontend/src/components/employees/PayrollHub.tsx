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
    Users,
    Download,
    Plus,
    Save
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import GlassCard from '@/components/GlassCard';
import { EmployeeDTO } from '@/types/dto';
import { api } from '@/lib/api';
import { useNotifications } from '../notifications/NotificationProvider';

interface PayrollHubProps {
    employees: EmployeeDTO[];
}

interface PayrollRecord {
    id?: string;
    employee: EmployeeDTO;
    workingDays: number;
    daysPresent: number;
    approvedLeaves: number;
    unpaidAbsences: number;
    baseSalary: number;
    deductions: number;
    netPayable: number;
    formula: string;
    bonus: number;
    travelExpenses: number;
    adjustmentsNote: string;
    status: string;
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
                const saved = finalizedRecords.find(r => r.employeeid === emp.id);
                if (saved) {
                    return {
                        id: saved.id,
                        employee: emp,
                        baseSalary: Number(saved.basesalary),
                        deductions: Number(saved.deductions),
                        netPayable: Number(saved.netpayable),
                        workingDays: Number(saved.workingdays),
                        daysPresent: Number(saved.dayspresent),
                        approvedLeaves: Number(saved.approvedleaves),
                        unpaidAbsences: Number(saved.unpaidabsences),
                        bonus: Number(saved.bonus || 0),
                        travelExpenses: Number(saved.travel_expenses || 0),
                        adjustmentsNote: saved.adjustments_note || '',
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
                    bonus: 0,
                    travelExpenses: 0,
                    adjustmentsNote: '',
                    status: 'DRAFT',
                    formula: `${base} - (${unpaidAbsences} days * ${dailyRate.toFixed(2)})`
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
                            <tr style={{ background: 'rgba(13, 13, 18, 0.98)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
                                <th style={{ padding: '16px 24px', width: '25%', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--glass-border)' }}>Employee</th>
                                <th style={{ padding: '16px 12px', width: '15%', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--glass-border)' }}>Base</th>
                                <th style={{ padding: '16px 12px', width: '20%', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--glass-border)' }}>Attendance</th>
                                <th style={{ padding: '16px 12px', width: '15%', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--glass-border)' }}>Adjustments</th>
                                <th style={{ padding: '16px 12px', width: '15%', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--glass-border)' }}>Payout</th>
                                <th style={{ padding: '16px 24px', width: '10%', textAlign: 'right', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--glass-border)' }}>Actions</th>
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
                                        <td style={{ padding: '14px 24px' }}>
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
                                        <td style={{ padding: '14px 12px' }}>
                                            <div style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>{record.baseSalary.toLocaleString()}</div>
                                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>FIXED</div>
                                        </td>
                                        <td style={{ padding: '14px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{record.daysPresent}d</div>
                                                <div style={{ height: '3px', width: '30px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${(record.daysPresent / record.workingDays) * 100}%`, background: 'var(--purple-main)' }}></div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: record.approvedLeaves > 1 ? '#EF4444' : '#FBBF24', marginTop: '1px' }}>{record.approvedLeaves} Leaves</div>
                                        </td>
                                        <td style={{ padding: '14px 12px' }}>
                                            {record.deductions > 0 ? (
                                                <div style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.85rem' }}>-{record.deductions.toLocaleString()}</div>
                                            ) : (
                                                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem' }}>None</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 12px' }}>
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
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)', zIndex: 100000, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.2s' }} onClick={() => setSelectedBreakup(null)}>
                    <div 
                        className="slide-left"
                        style={{ 
                            background: 'rgba(12, 12, 16, 0.98)', 
                            width: '100%', 
                            maxWidth: '480px', 
                            height: '100%', 
                            borderLeft: '1px solid var(--glass-border)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            boxShadow: '-40px 0 100px rgba(0,0,0,0.8)', 
                            overflow: 'hidden',
                            backdropFilter: 'blur(30px)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '40px 36px 28px', borderBottom: '1px solid var(--glass-border)', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '220px', height: '220px', background: 'var(--purple-main)', filter: 'blur(90px)', opacity: 0.12 }}></div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--purple-accent)', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                    <Activity size={13} /> Integrated Ledger System
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button 
                                        onClick={() => {
                                            const doc = new jsPDF() as any;
                                            const { employee: emp } = selectedBreakup;
                                            
                                            // Add header
                                            doc.setFillColor(139, 92, 246);
                                            doc.rect(0, 0, 210, 40, 'F');
                                            doc.setTextColor(255, 255, 255);
                                            doc.setFontSize(22);
                                            doc.text('PAYSLIP', 105, 25, { align: 'center' });
                                            
                                            doc.setTextColor(0, 0, 0);
                                            doc.setFontSize(10);
                                            doc.text(`Employee: ${emp.firstName} ${emp.lastName}`, 20, 50);
                                            doc.text(`ID: ${emp.id.slice(0, 8)}`, 20, 55);
                                            doc.text(`Period: ${monthNames[selectedMonth]} ${selectedYear}`, 140, 50);
                                            
                                            const tableData = [
                                                ['Description', 'Calculation', 'Amount'],
                                                ['Base Salary', 'Fixed Rate', `Rs. ${selectedBreakup.baseSalary.toLocaleString()}`],
                                                ['Attendance', `${selectedBreakup.daysPresent}/${selectedBreakup.workingDays} days`, ''],
                                                ['Deductions', `${selectedBreakup.unpaidAbsences} Unpaid Absences`, `- Rs. ${selectedBreakup.deductions.toLocaleString()}`],
                                                ['Bonus', 'Performance/Special', `+ Rs. ${selectedBreakup.bonus.toLocaleString()}`],
                                                ['Travel Expenses', 'Reimbursements', `+ Rs. ${selectedBreakup.travelExpenses.toLocaleString()}`],
                                                ['TOTAL NET PAYABLE', '', `Rs. ${selectedBreakup.netPayable.toLocaleString()}`]
                                            ];
                                            
                                            (doc as any).autoTable({
                                                startY: 70,
                                                head: [tableData[0]],
                                                body: tableData.slice(1),
                                                theme: 'grid',
                                                headStyles: { fillColor: [139, 92, 246] },
                                                columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } }
                                            });
                                            
                                            doc.save(`Payslip_${emp.firstName}_${monthNames[selectedMonth]}.pdf`);
                                        }}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '6px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Download size={13} /> PDF Slip
                                    </button>
                                    <button onClick={() => setSelectedBreakup(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                            </div>

                            <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.04em' }}>Ledger Snapshot</h2>
                            <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: '6px', fontSize: '0.8rem' }}>Verification cycle for {monthNames[selectedMonth]} {selectedYear}</p>

                            <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '22px', border: '1px solid var(--glass-border)', boxShadow: 'inset 0 0 30px rgba(255,255,255,0.02)' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.5)', flexShrink: 0 }}>
                                    {selectedBreakup.employee.profilePhoto ? <img src={selectedBreakup.employee.profilePhoto} style={{ width: '100%', height: '100%', borderRadius: '14px', objectFit: 'cover' }} /> : selectedBreakup.employee.firstName.charAt(0)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedBreakup.employee.firstName} {selectedBreakup.employee.lastName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px', fontWeight: 700 }}>{selectedBreakup.employee.department} • {selectedBreakup.employee.designation || 'Specialist'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '32px' }}>
                                <div style={{ textAlign: 'center', padding: '16px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '18px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.1em' }}>Cycle</div>
                                    <input 
                                        type="number" 
                                        value={selectedBreakup.workingDays} 
                                        onChange={(e) => {
                                            const wd = Number(e.target.value) || 1;
                                            const dailyRate = selectedBreakup.baseSalary / wd;
                                            const unpaid = wd - selectedBreakup.daysPresent - selectedBreakup.approvedLeaves;
                                            const deductions = Math.max(0, unpaid * dailyRate);
                                            const net = selectedBreakup.baseSalary - deductions + (selectedBreakup.bonus || 0) + (selectedBreakup.travelExpenses || 0);
                                            setSelectedBreakup({
                                                ...selectedBreakup, 
                                                workingDays: wd, 
                                                deductions, 
                                                netPayable: net,
                                                unpaidAbsences: Math.max(0, unpaid),
                                                formula: `${selectedBreakup.baseSalary} - (${Math.max(0, unpaid)} days * ${dailyRate.toFixed(2)})`
                                            });
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 900, fontSize: '1.25rem', textAlign: 'center', width: '100%', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ textAlign: 'center', padding: '16px 8px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '18px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                    <div style={{ fontSize: '0.55rem', color: '#10B981', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px', opacity: 0.8 }}>Present</div>
                                    <input 
                                        type="number" 
                                        value={selectedBreakup.daysPresent} 
                                        onChange={(e) => {
                                            const dp = Number(e.target.value);
                                            const wd = selectedBreakup.workingDays;
                                            const al = selectedBreakup.approvedLeaves;
                                            const dailyRate = selectedBreakup.baseSalary / wd;
                                            const unpaid = wd - dp - al;
                                            const deductions = Math.max(0, unpaid * dailyRate);
                                            const net = selectedBreakup.baseSalary - deductions + (selectedBreakup.bonus || 0) + (selectedBreakup.travelExpenses || 0);
                                            setSelectedBreakup({
                                                ...selectedBreakup, 
                                                daysPresent: dp, 
                                                deductions, 
                                                netPayable: net,
                                                unpaidAbsences: Math.max(0, unpaid),
                                                formula: `${selectedBreakup.baseSalary} - (${Math.max(0, unpaid)} days * ${dailyRate.toFixed(2)})`
                                            });
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#10B981', fontWeight: 900, fontSize: '1.25rem', textAlign: 'center', width: '100%', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ textAlign: 'center', padding: '16px 8px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '18px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                                    <div style={{ fontSize: '0.55rem', color: '#F59E0B', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px', opacity: 0.8 }}>Leaves</div>
                                    <input 
                                        type="number" 
                                        value={selectedBreakup.approvedLeaves} 
                                        onChange={(e) => {
                                            const al = Number(e.target.value);
                                            const wd = selectedBreakup.workingDays;
                                            const dp = selectedBreakup.daysPresent;
                                            const dailyRate = selectedBreakup.baseSalary / wd;
                                            const unpaid = wd - dp - al;
                                            const deductions = Math.max(0, unpaid * dailyRate);
                                            const net = selectedBreakup.baseSalary - deductions + (selectedBreakup.bonus || 0) + (selectedBreakup.travelExpenses || 0);
                                            setSelectedBreakup({
                                                ...selectedBreakup, 
                                                approvedLeaves: al, 
                                                deductions, 
                                                netPayable: net,
                                                unpaidAbsences: Math.max(0, unpaid),
                                                formula: `${selectedBreakup.baseSalary} - (${Math.max(0, unpaid)} days * ${dailyRate.toFixed(2)})`
                                            });
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#F59E0B', fontWeight: 900, fontSize: '1.25rem', textAlign: 'center', width: '100%', outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.12em', paddingLeft: '4px' }}>Base & Deductions</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>Standard Rate</span>
                                    <span style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>₹{selectedBreakup.baseSalary.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px', background: 'rgba(239, 68, 68, 0.03)', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                    <span style={{ color: '#EF4444', fontSize: '0.85rem', fontWeight: 600, opacity: 0.8 }}>LOP Adjustments</span>
                                    <span style={{ color: '#EF4444', fontWeight: 800, fontSize: '1rem' }}>-₹{selectedBreakup.deductions.toLocaleString()}</span>
                                </div>

                                <div style={{ marginTop: '12px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.12em', paddingLeft: '4px' }}>Beyond-Salary Compensation</div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid var(--glass-border)', padding: '16px 20px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>Performance Bonus</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem', fontWeight: 800 }}>₹</span>
                                            <input 
                                                type="number" 
                                                value={selectedBreakup.bonus || ''} 
                                                onChange={(e) => {
                                                    const b = Number(e.target.value);
                                                    const net = selectedBreakup.baseSalary - selectedBreakup.deductions + b + (selectedBreakup.travelExpenses || 0);
                                                    setSelectedBreakup({...selectedBreakup, bonus: b, netPayable: net});
                                                }}
                                                placeholder="0.00"
                                                style={{ background: 'transparent', border: 'none', color: '#10B981', fontWeight: 900, fontSize: '1.1rem', outline: 'none', width: '100%' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid var(--glass-border)', padding: '16px 20px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>Travel Expenses</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem', fontWeight: 800 }}>₹</span>
                                            <input 
                                                type="number" 
                                                value={selectedBreakup.travelExpenses || ''} 
                                                onChange={(e) => {
                                                    const te = Number(e.target.value);
                                                    const net = selectedBreakup.baseSalary - selectedBreakup.deductions + (selectedBreakup.bonus || 0) + te;
                                                    setSelectedBreakup({...selectedBreakup, travelExpenses: te, netPayable: net});
                                                }}
                                                placeholder="0.00"
                                                style={{ background: 'transparent', border: 'none', color: '#10B981', fontWeight: 900, fontSize: '1.1rem', outline: 'none', width: '100%' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid var(--glass-border)', padding: '16px 20px' }}>
                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>Adjustment / Audit Notes</div>
                                    <textarea 
                                        value={selectedBreakup.adjustmentsNote || ''}
                                        onChange={(e) => setSelectedBreakup({...selectedBreakup, adjustmentsNote: e.target.value})}
                                        placeholder="Add context for bonuses or deductions..."
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', outline: 'none', width: '100%', resize: 'none', height: '60px', fontFamily: 'inherit' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '32px 36px 40px', borderTop: '1px solid var(--glass-border)', background: 'linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.05) 100%)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                                <div>
                                    <div style={{ color: 'var(--purple-accent)', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>Verified Net Disbursement</div>
                                    <div style={{ fontSize: '2.75rem', fontWeight: 900, color: 'white', letterSpacing: '-0.05em', lineHeight: 1 }}>₹{Math.round(selectedBreakup.netPayable).toLocaleString()}</div>
                                </div>
                                <div style={{ 
                                    padding: '8px 16px', 
                                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)', 
                                    color: 'var(--purple-accent)', 
                                    borderRadius: '12px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 900, 
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    boxShadow: '0 8px 20px -8px rgba(139, 92, 246, 0.5)'
                                }}>
                                    {selectedBreakup.status === 'FINALIZED' ? 'LOCKED' : 'DRAFT'}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                                <button className="emp-action-btn" style={{ height: '56px', borderRadius: '18px', justifyContent: 'center' }} onClick={() => setSelectedBreakup(null)}>
                                    Discard
                                </button>
                                <button 
                                    className="emp-action-btn-primary" 
                                    style={{ height: '56px', borderRadius: '18px', fontSize: '1rem', fontWeight: 800, justifyContent: 'center' }} 
                                    onClick={async () => {
                                        setIsFinalizing(true);
                                        try {
                                            await api.savePayrollRecord({
                                                ...selectedBreakup,
                                                employeeId: selectedBreakup.employee.id,
                                                month: selectedMonth,
                                                year: selectedYear,
                                                status: 'FINALIZED'
                                            });
                                            addNotification({ title: 'Record Locked', message: `Payroll for ${selectedBreakup.employee.firstName} finalized.`, type: 'SYSTEM' });
                                            // Update local state
                                            const updated = await api.getPayrollRecords(selectedMonth, selectedYear);
                                            setFinalizedRecords(updated || []);
                                            setSelectedBreakup(null);
                                        } catch (err: any) {
                                            addNotification({ title: 'Lock Failed', message: err.message, type: 'ERROR' });
                                        } finally {
                                            setIsFinalizing(false);
                                        }
                                    }}
                                >
                                    <Save size={18} /> {isFinalizing ? 'Locking...' : 'Save & Lock Record'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
        </div>
    );
}


