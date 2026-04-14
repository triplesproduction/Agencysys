// API Contracts for TripleS OS Phase 1

export interface EmployeeDTO {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roleId: string; // System Role (ADMIN, MANAGER, EMPLOYEE)
    designation: string; // Professional Role (e.g. Website Developer)
    department?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'SUSPENDED';

    // Phase 4 Enterprise Fields
    profilePhoto?: string;
    dob?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    phone?: string;
    address?: string;
    emergencyContact?: string;
    joinedAt: string; // ISO DateTime
    workLocation?: 'OFFICE' | 'REMOTE' | 'HYBRID';
    
    // Enterprise Employment & Payroll
    employmentType: 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP';
    internshipStatus?: 'PAID' | 'UNPAID';
    internshipStipend?: number;
    salaryHistory?: SalaryHistory[];
    baseSalary: number;
    experience?: number; // Years of experience

    // Nested Relations (Optional for Grid)
    tasksAssigned?: any[];
    kpis?: any[];
    leaves?: any[];
    documents?: {
        id: string;
        name: string;
        fileType: string;
        content: string;
        uploadedAt: string;
    }[];
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
}

export interface TaskDTO {
    id: string;
    title: string;
    description?: string;
    assigneeId?: string; // Legacy/Primary assignee
    assigneeIds?: string[]; // Modern multi-assignee support
    creatorId: string;
    status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'MISSED_DEADLINE';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueDate: string; // ISO DateTime
    estimatedHours?: number;
    createdAt: string; // ISO DateTime
    instructions?: string;
    managerId?: string;
    attachments?: string[];
    assignee?: {
        id: string;
        firstName: string;
        lastName: string;
        profilePhoto?: string;
    };
    assignees?: {
        id: string;
        firstName: string;
        lastName: string;
        profilePhoto?: string;
    }[];

    
    // KPI Fields
    submittedAt?: string;
    deadline_status?: 'ON_TIME' | 'LATE_30M' | 'LATE_1H' | 'LATE_GT_1H' | 'NOT_SUBMITTED_BY_EOD';
    quality_rating?: number; // 1-5
    points_awarded?: number;
}

export interface EODSubmissionDTO {
    id: string;
    employeeId: string;
    reportDate: string; // ISO Date
    tasksCompleted: any[]; // Can be string[] or {id, title}[] depending on legacy status
    tasksInProgress: any[];
    completedText?: string | null;
    inProgressText?: string | null;
    blockers?: string;
    sentiment?: 'GREAT' | 'GOOD' | 'OKAY' | 'BAD' | 'TERRIBLE';
    workHours?: number;
    submittedAt: string; // ISO DateTime
}

export interface KPIMetricDTO {
    id: string;
    employeeId: string;
    metricName: string;
    targetValue: number;
    currentValue: number;
    period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    lastUpdated: string; // ISO DateTime
}

export interface LeaveApplicationDTO {
    id: string;
    employeeId: string;
    leaveType: 'SICK' | 'CASUAL' | 'EARNED' | 'UNPAID';
    startDate: string; // ISO Date
    endDate: string; // ISO Date
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    approverId?: string;
    appliedAt: string; // ISO DateTime
}

export interface WorkHourLogDTO {
    id: string;
    employeeId: string;
    taskId?: string;
    date: string; // ISO Date
    hoursLogged: number;
    description?: string;
    loggedAt: string; // ISO DateTime
}

export interface MessageDTO {
    id: string;
    senderId: string;
    receiverId?: string;
    channelId?: string;
    content: string;
    attachments?: string[];
    sentAt: string; // ISO DateTime
}

export interface RuleDTO {
    id: string;
    title: string;
    description: string;
    category: 'HR' | 'Attendance' | 'Work Policy' | 'Leave' | 'Security';
    priority: 'Normal' | 'Important' | 'Critical';
    effectiveDate?: string;
    createdBy: string;
    createdAt: string;
    author?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

export interface KpiProfileDTO {
    id: string;
    employee_id: string;
    month_year: string;
    current_score: number;
    extra_points: number;
    total_hours_worked: number;
    late_login_count: number;
    tasks_completed: number;
    tasks_late: number;
    average_quality_rating: number;
    leaves_taken: number;
    unpaid_leaves: number;
    bonus_points: number;
    grade: string;
    last_updated: string;
}

export interface KpiAuditLogDTO {
    id: string;
    employee_id: string;
    event_source: string;
    source_id?: string;
    points_change: number;
    visible_score_before: number;
    visible_score_after: number;
    extra_points_before: number;
    extra_points_after: number;
    description: string;
    created_at: string;
}

export interface SalaryHistory {
    id: string;
    employeeId: string;
    amount: number;
    effectiveDate: string;
    reason?: string;
    createdAt: string;
}

export interface PayrollRecord {
    id: string;
    employeeId: string;
    month: number;
    year: number;
    baseSalary: number;
    deductions: number;
    netPayable: number;
    workingDays: number;
    daysPresent: number;
    approvedLeaves: number;
    unpaidAbsences: number;
    formula?: string;
    status: 'DRAFT' | 'FINALIZED' | 'PAID';
    createdAt: string;
}
