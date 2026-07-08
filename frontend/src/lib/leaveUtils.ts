import { EmployeeDTO, LeaveApplicationDTO } from '@/types/dto';

/**
 * Calculates the number of days between two dates, inclusive.
 */
export function getDayCount(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    let count = 0;
    for (let i = 0; i < diffDays; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        if (d.getDay() !== 0) count++;
    }
    return count;
}

/**
 * Calculates the total accrued leaves minus used paid leaves.
 * Accrual: 2 leaves per month starting from joinedAt date, including the current month.
 */
export function calculateLeaveBalance(employee: any, leaves: LeaveApplicationDTO[]): number {
    if (!employee) return 0;
    
    // 1. Determine months since joined
    let joinedDate = new Date(); // Default to now if not set
    if (employee.joinedAt) {
        joinedDate = new Date(employee.joinedAt);
    }
    
    const now = new Date();
    
    // Calculate total full months between joinedDate and now
    let monthsSinceJoined = (now.getFullYear() - joinedDate.getFullYear()) * 12;
    monthsSinceJoined -= joinedDate.getMonth();
    monthsSinceJoined += now.getMonth();
    
    // Include the joining month (+1)
    if (monthsSinceJoined < 0) monthsSinceJoined = 0;
    const totalMonths = monthsSinceJoined + 1;
    
    // Accrual is 2 paid leaves per month
    const totalAccrued = totalMonths * 2;
    
    // 2. Determine used paid leaves
    let usedPaidLeaves = 0;
    const paidLeaves = leaves.filter(l => 
        l.status === 'APPROVED' && 
        (l.leaveType === 'CASUAL' || l.leaveType === 'SICK' || l.leaveType !== 'UNPAID')
    );
    
    paidLeaves.forEach(l => {
        usedPaidLeaves += getDayCount(l.startDate, l.endDate);
    });
    
    // 3. Balance
    return totalAccrued - usedPaidLeaves;
}
