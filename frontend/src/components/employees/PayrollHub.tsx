import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    FileText,
    ArrowUpRight,
    Activity,
    Download,
    Save,
    X,
    Filter
} from 'lucide-react';
import ReactDOM from 'react-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { useMonthlyAttendance } from '@/hooks/queries/domains/attendance/useAttendance';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { PayrollRecord, EmployeeDTO } from '@/types/dto';
import './PayrollHub.css';

interface PayrollHubProps {
    employees: EmployeeDTO[];
}

export default function PayrollHub({ employees }: PayrollHubProps) {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [payrollData, setPayrollData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showPicker, setShowPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const pickerAnchorRef = useRef<HTMLButtonElement>(null);
    const { addNotification } = useNotifications();
    const [finalizedRecords, setFinalizedRecords] = useState<any[]>([]);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [selectedBreakup, setSelectedBreakup] = useState<any | null>(null);

    const { data: attendanceMap = {}, isLoading: isAttendanceLoading } = useMonthlyAttendance(selectedMonth, selectedYear);
    useEffect(() => {
        const fetchSavedRecords = async () => {
            try {
                const saved = await api.getPayrollRecords(selectedMonth, selectedYear);
                setFinalizedRecords(saved || []);
            } catch (err) {
                logger.error('Error', 'Failed to fetch saved payroll:', err);
            }
        };
        fetchSavedRecords();
    }, [selectedMonth, selectedYear]);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Helper: Get Working Days (Total days - Sundays) from joining date
    const getWorkingDaysCount = (year: number, month: number, joinedAt?: string) => {
        const totalDays = new Date(year, month + 1, 0).getDate();
        let workingDays = 0;
        
        const joinDate = joinedAt ? new Date(joinedAt) : new Date(0);
        joinDate.setHours(0, 0, 0, 0);

        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            date.setHours(0, 0, 0, 0);
            if (date >= joinDate && date.getDay() !== 0) { // 0 = Sunday
                workingDays++;
            }
        }
        return workingDays;
    };

    const calculatePayroll = async () => {
        if (isAttendanceLoading) return;
        setLoading(true);
        try {
            const results: any[] = employees.map((emp: EmployeeDTO) => {
                const workingDays = getWorkingDaysCount(selectedYear, selectedMonth, emp.joinedAt);
                const saved = finalizedRecords.find((r: any) => r.employeeid === emp.id);
                if (saved) {
                    return {
                        id: saved.id,
                        employeeId: saved.employeeid,
                        month: saved.month,
                        year: saved.year,
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
                        status: saved.status as any,
                        createdAt: saved.createdat
                    };
                }

                const base = (emp.employmentType === 'INTERNSHIP' && emp.internshipStatus === 'PAID' ? emp.internshipStipend : emp.baseSalary) || 0;
                const leavesInMonth = (emp.leaves || []).filter((l: any) => {
                    const start = new Date(l.startDate);
                    return start.getMonth() === selectedMonth && start.getFullYear() === selectedYear && l.status === 'APPROVED';
                }).length;

                const realDaysPresent = attendanceMap[emp.id] || 0;
                const paidLeavesUsed = Math.min(leavesInMonth, 1);
                const effectiveDays = realDaysPresent + paidLeavesUsed;
                const unpaidAbsences = Math.max(0, workingDays - effectiveDays);

                const bonus = 0;
                const travelExpenses = 0;
                const dailyRate = base / workingDays;
                const deductions = unpaidAbsences * dailyRate;
                const netPayable = Math.max(0, base - deductions + bonus + travelExpenses);

                return {
                    employee: emp,
                    workingDays,
                    daysPresent: realDaysPresent,
                    approvedLeaves: leavesInMonth,
                    unpaidAbsences,
                    baseSalary: base,
                    deductions,
                    netPayable,
                    bonus,
                    travelExpenses,
                    adjustmentsNote: '',
                    status: 'DRAFT',
                    formula: `${base} - (${unpaidAbsences} days * ${dailyRate.toFixed(2)}) + ${bonus} + ${travelExpenses}`
                };
            });
            // Filter out inactive/suspended employees who had no activity this month and no saved records
            const validResults = results.filter((r) => {
                if (r.id) return true; // Keep if there's already a saved record
                
                const isInactive = ['SUSPENDED', 'INACTIVE', 'TERMINATED'].includes(r.employee.status);
                if (isInactive) {
                    return r.daysPresent > 0 || r.approvedLeaves > 0;
                }
                
                return true;
            });

            setPayrollData(validResults);
        } catch (err) {
            logger.error("Error", "Payroll calculation failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateMonthlyReport = () => {
        if (payrollData.length === 0) {
            addNotification({ title: 'No Data', message: 'No payroll records found for this period.', type: 'ERROR' });
            return;
        }

        try {
            // Initialize with compression enabled to reduce file size (40MB -> <4MB)
            const doc = new jsPDF({ compress: true }) as any;
            const pageWidth = doc.internal.pageSize.width;
            const monthStr = monthNames[selectedMonth].toUpperCase();

            // --- 1. LOGO & HEADER (OPTIMIZED EMBEDDING) ---
            try {
                // Use 'FAST' compression for image to keep file size low
                doc.addImage('/logo.png', 'PNG', (pageWidth / 2) - 42.5, 10, 85, 22, undefined, 'FAST');
            } catch (e) {
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.text('TRIPLE S PRODUCTION', pageWidth / 2, 22, { align: 'center' });
            }

            // Separator Line
            doc.setDrawColor(220, 220, 220);
            doc.line(40, 38, pageWidth - 40, 38);

            // --- 2. REPORT TITLE & DISCLOSURE (ENLARGED TITLE) ---
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            const mainTitle = `MONTHLY PAYROLL SUMMARY: ${monthNames[selectedMonth]} ${selectedYear}`.toUpperCase();
            doc.text(mainTitle, pageWidth / 2, 52, { align: 'center' });

            doc.setTextColor(100, 100, 100);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text('OFFICIAL PAYROLL DISCLOSURE STATEMENT', pageWidth / 2, 61, { align: 'center' });

            // --- 3. METRICS SUMMARY (WIDE LEDGER STYLE) ---
            const metricsY = 75;
            const mMargin = 8;
            const boxGap = 4;
            const boxWidth = (pageWidth - (mMargin * 2) - boxGap) / 2;
            const rowH = 12;

            // Helper for drawing a summary row with background for label
            const drawSummaryRow = (x: number, y: number, label: string, value: string) => {
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(248, 248, 248);
                doc.rect(x, y, boxWidth * 0.55, rowH, 'F'); // Label background
                doc.rect(x, y, boxWidth, rowH);
                
                doc.setFontSize(10);
                doc.setTextColor(60, 60, 60);
                doc.setFont('helvetica', 'bold');
                doc.text(label, x + 4, y + 8);
                
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                doc.text(value, x + boxWidth - 4, y + 8, { align: 'right' });
            };

            // Left Box: Period, Base, Days
            drawSummaryRow(mMargin, metricsY, 'Reporting Period', `${monthNames[selectedMonth]} ${selectedYear}`);
            drawSummaryRow(mMargin, metricsY + rowH, 'Total Base Salary', `Rs. ${stats.totalBase.toLocaleString()}`);
            drawSummaryRow(mMargin, metricsY + rowH * 2, 'Total Operational Days', `${payrollData[0]?.workingDays || 0} Days`);

            // Right Box: Date, Deductions, Net Payout
            const rightBoxX = mMargin + boxWidth + boxGap;
            drawSummaryRow(rightBoxX, metricsY, 'Document Date', new Date().toLocaleDateString('en-GB'));
            drawSummaryRow(rightBoxX, metricsY + rowH, 'System Deductions', `Rs. ${stats.totalDeductions.toLocaleString()}`);
            drawSummaryRow(rightBoxX, metricsY + rowH * 2, 'Total Net Payout', `Rs. ${stats.totalPayout.toLocaleString()}`);

            // --- 4. DATA TABLE (COMPACT & WIDE) ---
            const tableHeaders = [['EMPLOYEE NAME', 'BASE SALARY', 'ATTENDANCE', 'ADDITIONAL PAY', 'DEDUCTIONS', 'TOTAL WAGE']];
            
            let totalAdditional = 0;
            const tableRows = payrollData.map(record => {
                const addPay = (record.bonus || 0) + (record.travelExpenses || 0);
                totalAdditional += addPay;
                return [
                    { 
                        content: '', // Handled by didDrawCell
                        name: `${record.employee.firstName} ${record.employee.lastName}`,
                        designation: record.employee.designation || 'Specialist'
                    },
                    `Rs. ${Math.round(record.baseSalary).toLocaleString()}`,
                    `${record.daysPresent}D / ${record.workingDays}D`,
                    `Rs. ${Math.round(addPay).toLocaleString()}`,
                    `Rs. ${Math.round(record.deductions).toLocaleString()}`,
                    `Rs. ${Math.round(record.netPayable).toLocaleString()}`
                ];
            });

            autoTable(doc, {
                startY: metricsY + (rowH * 3) + 7, 
                head: tableHeaders,
                body: tableRows,
                theme: 'grid',
                headStyles: { 
                    fillColor: [255, 255, 255], 
                    textColor: [0, 0, 0], 
                    fontSize: 9.5,
                    fontStyle: 'bold',
                    lineColor: [180, 180, 180],
                    lineWidth: 0.1,
                    minCellHeight: 8,
                    valign: 'middle',
                    halign: 'center'
                },
                bodyStyles: { 
                    fontSize: 9,
                    textColor: [40, 40, 40],
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                    minCellHeight: 12,
                    valign: 'middle'
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 0) {
                        const raw = data.cell.raw as any;
                        if (raw.name) {
                            const x = data.cell.x + 5; // 5mm left padding
                            const y = data.cell.y + 5;
                            
                            // Draw Name: Bold, Slightly Bigger
                            doc.setFont('helvetica', 'bold');
                            doc.setFontSize(10);
                            doc.setTextColor(0, 0, 0);
                            doc.text(raw.name, x, y);
                            
                            // Draw Designation: Italic, Slightly Smaller
                            doc.setFont('helvetica', 'italic');
                            doc.setFontSize(8);
                            doc.setTextColor(80, 80, 80);
                            doc.text(raw.designation, x, y + 4.5);
                        }
                    }
                },
                alternateRowStyles: {
                    fillColor: [248, 248, 248]
                },
                columnStyles: {
                    0: { cellWidth: 50 }, 
                    1: { halign: 'center' },
                    2: { halign: 'center' },
                    3: { halign: 'center', textColor: [0, 0, 0], fontStyle: 'bold' },
                    4: { halign: 'center', textColor: [80, 80, 80] },
                    5: { halign: 'center', textColor: [0, 0, 0], fontStyle: 'bold' }
                },
                margin: { left: 8, right: 8 }, 
                foot: [['TOTAL SUMMARY', `Rs. ${stats.totalBase.toLocaleString()}`, '', `Rs. ${totalAdditional.toLocaleString()}`, `Rs. ${stats.totalDeductions.toLocaleString()}`, `Rs. ${stats.totalPayout.toLocaleString()}`]],
                footStyles: {
                    fillColor: [0, 0, 0],
                    textColor: [255, 255, 255],
                    fontSize: 11,
                    fontStyle: 'bold',
                    minCellHeight: 12,
                    valign: 'middle',
                    halign: 'center'
                }
            });

            // --- 5. FOOTER: SYSTEM BAR ---
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                const pageHeight = doc.internal.pageSize.height;
                
                doc.setFillColor(0, 0, 0);
                doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
                
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text('TRIPLE S PRODUCTION', 15, pageHeight - 9);
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.text(`Internal Payroll Document - Page ${i} of ${pageCount}`, pageWidth - 15, pageHeight - 9, { align: 'right' });
            }

            doc.save(`TripleS_Payroll_Report_${monthStr}_${selectedYear}.pdf`);
            addNotification({ title: 'Report Exported', message: `Black & White payroll summary for ${monthStr} saved.`, type: 'SUCCESS' });
        } catch (err: any) {
            addNotification({ title: 'Export Failed', message: err.message, type: 'ERROR' });
        }
    };

    useEffect(() => {
        calculatePayroll();
    }, [selectedMonth, selectedYear, employees, finalizedRecords, attendanceMap, isAttendanceLoading]);

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
        totalBase: payrollData.reduce((acc, curr) => acc + curr.baseSalary, 0),
        onTimeEmployees: payrollData.filter(p => p.unpaidAbsences === 0).length
    }), [payrollData]);

    return (
        <div className="payroll-hub">
            {/* ── STATS DASHBOARD ── */}
            <div className="payroll-stats-grid">
                <div className="payroll-stat-card">
                    <div className="stat-glow" style={{ background: 'var(--purple-main)' }}></div>
                    <div className="stat-label">Total Monthly Payout</div>
                    <div className="stat-value">₹{stats.totalPayout.toLocaleString()}</div>
                    <div className="stat-footer">
                        <div className="stat-indicator" style={{ background: '#34D399' }}></div>
                        Cycle: {monthNames[selectedMonth]} {selectedYear}
                    </div>
                </div>

                <div className="payroll-stat-card">
                    <div className="stat-glow" style={{ background: '#EF4444' }}></div>
                    <div className="stat-label">System Deductions</div>
                    <div className="stat-value">₹{stats.totalDeductions.toLocaleString()}</div>
                    <div className="stat-footer" style={{ color: 'rgba(248, 113, 113, 0.45)' }}>
                        Attendance-based adjustments
                    </div>
                </div>

                <div className="payroll-stat-card">
                    <div className="stat-glow" style={{ background: '#3B82F6' }}></div>
                    <div className="stat-label">Operational Efficiency</div>
                    <div className="stat-value">{stats.onTimeEmployees}/{payrollData.length}</div>
                    <div className="stat-footer" style={{ color: 'rgba(96, 165, 250, 0.55)' }}>
                        Employees with zero absences
                    </div>
                </div>
            </div>

            {/* ── MAIN LEDGER CONTAINER ── */}
            <div className="payroll-table-container">
                <header className="payroll-toolbar">
                    <div className="toolbar-left">
                        <div className="payroll-search">
                            <Search size={16} style={{ opacity: 0.3 }} />
                            <input
                                type="text"
                                placeholder="Filter financial records..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="month-navigator">
                            <button
                                className="nav-btn"
                                onClick={() => {
                                    const prev = selectedMonth === 0 ? 11 : selectedMonth - 1;
                                    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
                                    setSelectedMonth(prev); setSelectedYear(prevYear);
                                }}
                            ><ChevronLeft size={18} /></button>
                            <div className="nav-label">
                                {monthNames[selectedMonth]} {selectedYear}
                            </div>
                            <button
                                className="nav-btn"
                                onClick={() => {
                                    const next = selectedMonth === 11 ? 0 : selectedMonth + 1;
                                    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
                                    setSelectedMonth(next); setSelectedYear(nextYear);
                                }}
                            ><ChevronRight size={18} /></button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            className="emp-action-btn"
                            onClick={handleGenerateMonthlyReport}
                            style={{ height: '42px', padding: '0 18px', borderRadius: '12px', gap: '8px', fontSize: '0.85rem' }}
                        >
                            <FileText size={16} /> Reports
                        </button>
                        <button
                            disabled={isFinalizing}
                            onClick={async () => {
                                if (!confirm('Are you sure you want to lock this financial cycle? This will archive all current records.')) return;
                                setIsFinalizing(true);
                                try {
                                    await Promise.all(payrollData.map(record => api.savePayrollRecord({
                                        ...record, employeeId: record.employee.id, month: selectedMonth, year: selectedYear, status: 'FINALIZED'
                                    })));
                                    addNotification({ title: 'Cycle Locked', message: 'Financial ledger archived.', type: 'SUCCESS' });
                                    const saved = await api.getPayrollRecords(selectedMonth, selectedYear);
                                    setFinalizedRecords(saved || []);
                                } catch (err: any) {
                                    addNotification({ title: 'Error', message: 'Archival failed: ' + err.message, type: 'ERROR' });
                                }
                                finally { setIsFinalizing(false); }
                            }}
                            className="emp-action-btn-primary"
                            style={{ height: '42px', padding: '0 20px', borderRadius: '12px', gap: '8px', fontSize: '0.85rem' }}
                        >
                            {isFinalizing ? <div className="spinner-mini" style={{ width: '14px', height: '14px' }}></div> : <Save size={16} />}
                            {isFinalizing ? 'Locking...' : 'Lock Financial Cycle'}
                        </button>
                    </div>
                </header>

                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="payroll-table">
                        <thead>
                            <tr>
                                <th style={{ width: '30%' }}>Identity</th>
                                <th style={{ width: '15%' }}>Base Salary</th>
                                <th style={{ width: '20%' }}>Attendance</th>
                                <th style={{ width: '15%' }}>Deductions</th>
                                <th style={{ width: '12%' }}>Net Payout</th>
                                <th style={{ width: '8%', textAlign: 'right' }}>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '8rem', textAlign: 'center' }}>
                                        <div className="spinner-mini" style={{ margin: '0 auto 1.5rem', width: '32px', height: '32px' }}></div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Synchronizing Financial Intelligence...</div>
                                    </td>
                                </tr>
                            ) : filteredPayroll.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '8rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem', fontWeight: 600 }}>No financial records detected for this period.</td>
                                </tr>
                            ) : (
                                filteredPayroll.map((record) => (
                                    <tr key={record.employee.id} className="payroll-row">
                                        <td>
                                            <div className="employee-cell">
                                                <div className="emp-avatar">
                                                    {record.employee.profilePhoto ? <img src={record.employee.profilePhoto} alt="" /> : record.employee.firstName.charAt(0)}
                                                </div>
                                                <div className="emp-info">
                                                    <div className="emp-name">{record.employee.firstName} {record.employee.lastName}</div>
                                                    <div className="emp-dept">{record.employee.department} • {record.employee.designation || 'Specialist'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="amount-cell">
                                                <span className="amount-val">₹{record.baseSalary.toLocaleString()}</span>
                                                <span className="amount-label">FIXED RATE</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="attendance-viz">
                                                <div className="attendance-metrics">
                                                    <span className="days-count">{record.daysPresent}D</span>
                                                    <span className="separator">/</span>
                                                    <span className="total-days">{record.workingDays}D</span>
                                                </div>
                                                <div className="mini-progress">
                                                    <div className="mini-progress-bar" style={{ width: `${(record.daysPresent / record.workingDays) * 100}%` }}></div>
                                                </div>
                                                {record.approvedLeaves > 0 && (
                                                    <div className="leave-tag" style={{ background: record.approvedLeaves > 2 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: record.approvedLeaves > 2 ? '#EF4444' : '#FBBF24' }}>
                                                        {record.approvedLeaves}L
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {record.deductions > 0 ? (
                                                <div style={{ color: '#EF4444', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>
                                                    -₹{Math.round(record.deductions).toLocaleString()}
                                                </div>
                                            ) : (
                                                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.85rem', fontWeight: 600 }}>OPTIMAL</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="payout-val">₹{Math.round(record.netPayable).toLocaleString()}</div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                className="payroll-detail-btn"
                                                onClick={() => setSelectedBreakup(record)}
                                            >
                                                <ArrowUpRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── BREAKUP PANEL PORTAL ── */}
                {selectedBreakup && typeof document !== 'undefined' && ReactDOM.createPortal(
                    <div className="payroll-drawer-overlay" onClick={() => setSelectedBreakup(null)}>
                        <div className="payroll-drawer" onClick={e => e.stopPropagation()}>
                            <header className="drawer-header">
                                <div className="drawer-glow"></div>
                                <div className="drawer-actions">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--purple-light)', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                        <Activity size={14} /> Integrated Ledger Intelligence
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            onClick={() => {
                                                const doc = new jsPDF() as any;
                                                const { employee: emp } = selectedBreakup;
                                                doc.setFillColor(15, 15, 20);
                                                doc.rect(0, 0, 210, 40, 'F');
                                                doc.setTextColor(255, 255, 255);
                                                doc.setFontSize(22);
                                                doc.text('OFFICIAL PAYSLIP', 105, 25, { align: 'center' });
                                                doc.setTextColor(0, 0, 0);
                                                doc.setFontSize(10);
                                                doc.text(`Employee: ${emp.firstName} ${emp.lastName}`, 20, 50);
                                                doc.text(`Period: ${monthNames[selectedMonth]} ${selectedYear}`, 140, 50);
                                                const tableData = [
                                                    ['Description', 'Metric', 'Amount'],
                                                    ['Base Compensation', 'Fixed', `Rs. ${selectedBreakup.baseSalary.toLocaleString()}`],
                                                    ['Attendance Gap', `${selectedBreakup.unpaidAbsences} Days`, `- Rs. ${selectedBreakup.deductions.toLocaleString()}`],
                                                    ['Bonus Accruals', 'Manual', `+ Rs. ${selectedBreakup.bonus.toLocaleString()}`],
                                                    ['Reimbursements', 'Travel', `+ Rs. ${selectedBreakup.travelExpenses.toLocaleString()}`],
                                                    ['NET DISBURSEMENT', '', `Rs. ${selectedBreakup.netPayable.toLocaleString()}`]
                                                ];
                                                (doc as any).autoTable({
                                                    startY: 70, head: [tableData[0]], body: tableData.slice(1),
                                                    theme: 'grid', headStyles: { fillColor: [124, 58, 237] },
                                                    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } }
                                                });
                                                doc.save(`Payslip_${emp.firstName}_${monthNames[selectedMonth]}.pdf`);
                                            }}
                                            className="emp-action-btn"
                                            style={{ height: '36px', borderRadius: '10px', padding: '0 14px' }}
                                        >
                                            <Download size={14} /> Export PDF
                                        </button>
                                        <button onClick={() => setSelectedBreakup(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                </div>

                                <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.04em' }}>Financial Snapshot</h2>
                                <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Verification cycle: {monthNames[selectedMonth]} {selectedYear}</p>

                                <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--purple-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.4rem', boxShadow: '0 8px 20px -5px rgba(124, 58, 237, 0.5)', flexShrink: 0, overflow: 'hidden' }}>
                                        {selectedBreakup.employee.profilePhoto ? <img src={selectedBreakup.employee.profilePhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selectedBreakup.employee.firstName.charAt(0)}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedBreakup.employee.firstName} {selectedBreakup.employee.lastName}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 700, opacity: 0.6 }}>{selectedBreakup.employee.department} • {selectedBreakup.employee.designation || 'Specialist'}</div>
                                    </div>
                                </div>
                            </header>

                            <div className="drawer-content custom-scrollbar">
                                <div className="breakup-grid">
                                    <div className="breakup-tile">
                                        <div className="tile-label">Working Days</div>
                                        <input
                                            type="number"
                                            className="tile-input"
                                            value={selectedBreakup.workingDays}
                                            onChange={(e) => {
                                                const wd = Number(e.target.value) || 1;
                                                const dailyRate = selectedBreakup.baseSalary / wd;
                                                const unpaid = wd - selectedBreakup.daysPresent - selectedBreakup.approvedLeaves;
                                                const deductions = Math.max(0, unpaid * dailyRate);
                                                const net = selectedBreakup.baseSalary - deductions + (selectedBreakup.bonus || 0) + (selectedBreakup.travelExpenses || 0);
                                                setSelectedBreakup({
                                                    ...selectedBreakup, workingDays: wd, deductions, netPayable: net, unpaidAbsences: Math.max(0, unpaid),
                                                    formula: `${selectedBreakup.baseSalary} - (${Math.max(0, unpaid)} days * ${dailyRate.toFixed(2)})`
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="breakup-tile" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <div className="tile-label" style={{ color: '#10B981', opacity: 1 }}>Present</div>
                                        <input
                                            type="number"
                                            className="tile-input"
                                            style={{ color: '#10B981' }}
                                            value={selectedBreakup.daysPresent}
                                            onChange={(e) => {
                                                const dp = Number(e.target.value);
                                                const wd = selectedBreakup.workingDays;
                                                const dailyRate = selectedBreakup.baseSalary / wd;
                                                const unpaid = wd - dp - selectedBreakup.approvedLeaves;
                                                const deductions = Math.max(0, unpaid * dailyRate);
                                                const net = selectedBreakup.baseSalary - deductions + (selectedBreakup.bonus || 0) + (selectedBreakup.travelExpenses || 0);
                                                setSelectedBreakup({ ...selectedBreakup, daysPresent: dp, deductions, netPayable: net, unpaidAbsences: Math.max(0, unpaid) });
                                            }}
                                        />
                                    </div>
                                    <div className="breakup-tile" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                        <div className="tile-label" style={{ color: '#F59E0B', opacity: 1 }}>Leaves</div>
                                        <input
                                            type="number"
                                            className="tile-input"
                                            style={{ color: '#F59E0B' }}
                                            value={selectedBreakup.approvedLeaves}
                                            onChange={(e) => {
                                                const al = Number(e.target.value);
                                                const dailyRate = selectedBreakup.baseSalary / selectedBreakup.workingDays;
                                                const unpaid = selectedBreakup.workingDays - selectedBreakup.daysPresent - al;
                                                const deductions = Math.max(0, unpaid * dailyRate);
                                                const net = selectedBreakup.baseSalary - deductions + (selectedBreakup.bonus || 0) + (selectedBreakup.travelExpenses || 0);
                                                setSelectedBreakup({ ...selectedBreakup, approvedLeaves: al, deductions, netPayable: net, unpaidAbsences: Math.max(0, unpaid) });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="field-group">
                                    <div className="field-label">Primary Ledger</div>
                                    <div className="field-item">
                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Base Compensation</span>
                                        <span className="val" style={{ fontWeight: 800 }}>₹{selectedBreakup.baseSalary.toLocaleString()}</span>
                                    </div>
                                    <div className="field-item negative">
                                        <span style={{ fontWeight: 600 }}>Attendance Deductions (LOP)</span>
                                        <span className="val" style={{ fontWeight: 800 }}>-₹{selectedBreakup.deductions.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="field-group">
                                    <div className="field-label">Additional Credits</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="field-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                            <span className="tile-label">Incentives</span>
                                            <input
                                                type="number"
                                                className="tile-input"
                                                style={{ textAlign: 'left', fontSize: '1.1rem', color: '#10B981' }}
                                                value={selectedBreakup.bonus || ''}
                                                onChange={(e) => {
                                                    const b = Number(e.target.value);
                                                    const net = selectedBreakup.baseSalary - selectedBreakup.deductions + b + (selectedBreakup.travelExpenses || 0);
                                                    setSelectedBreakup({ ...selectedBreakup, bonus: b, netPayable: net });
                                                }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="field-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                            <span className="tile-label">Reimbursements</span>
                                            <input
                                                type="number"
                                                className="tile-input"
                                                style={{ textAlign: 'left', fontSize: '1.1rem', color: '#10B981' }}
                                                value={selectedBreakup.travelExpenses || ''}
                                                onChange={(e) => {
                                                    const te = Number(e.target.value);
                                                    const net = selectedBreakup.baseSalary - selectedBreakup.deductions + (selectedBreakup.bonus || 0) + te;
                                                    setSelectedBreakup({ ...selectedBreakup, travelExpenses: te, netPayable: net });
                                                }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="field-group">
                                    <div className="field-label">Audit Notes</div>
                                    <textarea
                                        className="field-item"
                                        style={{ height: '100px', resize: 'none', background: 'rgba(255,255,255,0.02)', color: 'white', fontSize: '0.9rem', outline: 'none', border: '1px solid var(--glass-border)', padding: '1rem' }}
                                        value={selectedBreakup.adjustmentsNote || ''}
                                        onChange={(e) => setSelectedBreakup({ ...selectedBreakup, adjustmentsNote: e.target.value })}
                                        placeholder="Document any deviations or performance rationale..."
                                    />
                                </div>
                            </div>

                            <footer className="drawer-footer">
                                <div className="payout-summary">
                                    <div className="tile-label">Verified Net Disbursement</div>
                                    <div className="total-amount">₹{Math.round(selectedBreakup.netPayable).toLocaleString()}</div>
                                    <div className="status-indicator-payout" style={{ marginTop: '0.5rem' }}>
                                        {selectedBreakup.status === 'FINALIZED' ? 'ARCHIVED LEDGER' : 'ACTIVE DRAFT'}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                    <button className="emp-action-btn" style={{ height: '56px', borderRadius: '16px' }} onClick={() => setSelectedBreakup(null)}>
                                        Discard
                                    </button>
                                    <button
                                        disabled={isFinalizing}
                                        className="emp-action-btn-primary"
                                        style={{ height: '56px', borderRadius: '16px', fontSize: '1rem' }}
                                        onClick={async () => {
                                            setIsFinalizing(true);
                                            try {
                                                await api.savePayrollRecord({
                                                    ...selectedBreakup, employeeId: selectedBreakup.employee.id,
                                                    month: selectedMonth, year: selectedYear, status: 'FINALIZED'
                                                });
                                                addNotification({ title: 'Record Locked', message: `Ledger for ${selectedBreakup.employee.firstName} archived.`, type: 'success' });
                                                const updated = await api.getPayrollRecords(selectedMonth, selectedYear);
                                                setFinalizedRecords(updated || []);
                                                setSelectedBreakup(null);
                                            } catch (err: any) {
                                                addNotification({ title: 'Error', message: err.message, type: 'error' });
                                            } finally {
                                                setIsFinalizing(false);
                                            }
                                        }}
                                    >
                                        <Save size={20} /> {isFinalizing ? 'Archiving...' : 'Lock & Archive Record'}
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
}


