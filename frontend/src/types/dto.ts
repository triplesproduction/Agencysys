// API Contracts for TripleS OS Phase 1

export interface EmployeeDTO {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roleId: string;
    department?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'SUSPENDED';

    // Phase 4 Enterprise Fields
    profilePhoto?: string;
    dob?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    phone?: string;
    address?: string;
    emergencyContact?: string;
    designation?: string;
    workLocation?: 'OFFICE' | 'REMOTE' | 'HYBRID';

    joinedAt: string; // ISO DateTime

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
    assigneeId: string;
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
}

export interface EODSubmissionDTO {
    id: string;
    employeeId: string;
    reportDate: string; // ISO Date
    tasksCompleted: string[];
    tasksInProgress: string[];
    blockers?: string;
    sentiment?: 'GREAT' | 'GOOD' | 'OKAY' | 'BAD' | 'TERRIBLE';
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
