import {
    EmployeeDTO,
    TaskDTO,
    EODSubmissionDTO,
    WorkHourLogDTO,
    KPIMetricDTO,
    LeaveApplicationDTO,
    RuleDTO,
    PaginatedResponse
} from '../types/dto';
import { getAuthToken, clearAuthToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...((options?.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            throw new Error(`API Request Failed: ${response.statusText}`);
        }

        if (response.status === 401) {
            console.error('Auth Error - clearing stale token:', errorData);
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    clearAuthToken();
                    window.location.href = '/login';
                }, 1500);
            }
        }

        const errObj = errorData?.error;
        const errMsg = typeof errObj === 'string'
            ? errObj
            : (errObj?.message || errorData?.message || `Error ${response.status}`);
        throw new Error(Array.isArray(errMsg) ? errMsg.join(', ') : errMsg);
    }

    if (response.status === 204) {
        return {} as T;
    }

    const json = await response.json();
    return json.data !== undefined ? json.data : json;
}

export const api = {
    // Auth
    login: async (email: string, password: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        return data as { access_token: string; employee?: any };
    },
    testLogin: (employeeId: string, roleId: string) => fetchApi<{ access_token: string }>('/auth/test-login', {
        method: 'POST',
        body: JSON.stringify({ employeeId, roleId })
    }),

    // Employees
    getEmployeeStats: () => fetchApi<{ total: number, active: number }>('/employees/stats'),
    getEmployees: (options?: { page?: number, limit?: number, search?: string, roleId?: string, status?: string, department?: string, sortBy?: string }) => {
        const params = new URLSearchParams();
        if (options) {
            Object.entries(options).forEach(([key, value]) => {
                if (value !== undefined) params.append(key, String(value));
            });
        }
        const qs = params.toString() ? `?${params.toString()}` : '';
        return fetchApi<PaginatedResponse<EmployeeDTO>>(`/employees${qs}`);
    },
    getEmployeeById: (id: string) => fetchApi<EmployeeDTO>(`/employees/${id}`),
    createEmployee: (data: any) => fetchApi<EmployeeDTO>('/employees', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateEmployeeStatus: (id: string, status: string) => fetchApi<EmployeeDTO>(`/employees/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    }),
    updateEmployee: (id: string, data: any) => fetchApi<EmployeeDTO>(`/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),
    deleteEmployee: (id: string) => fetchApi<void>(`/employees/${id}`, {
        method: 'DELETE'
    }),

    // Tasks
    getTasks: (assigneeId?: string, status?: string) => {
        const params = new URLSearchParams();
        if (assigneeId) params.append('assigneeId', assigneeId);
        if (status) params.append('status', status);
        const q = params.toString() ? `?${params.toString()}` : '';
        return fetchApi<TaskDTO[]>(`/tasks${q}`);
    },
    createTask: (data: Partial<TaskDTO>) => fetchApi<TaskDTO>('/tasks', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateTaskStatus: (id: string, status: string) => fetchApi<TaskDTO>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    }),
    updateTask: (id: string, data: Partial<TaskDTO>) => fetchApi<TaskDTO>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),

    // EOD
    submitEOD: (data: Partial<EODSubmissionDTO>) => fetchApi<EODSubmissionDTO>('/eod-reports', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getMyEODs: () => fetchApi<EODSubmissionDTO[]>('/eod-reports/me'),
    getAllEODs: () => fetchApi<any[]>('/eod-reports'),
    updateEODSentiment: (id: string, sentiment: string) => fetchApi<any>(`/eod-reports/${id}/sentiment`, {
        method: 'PATCH',
        body: JSON.stringify({ sentiment })
    }),

    // Work Hours
    logWorkHours: (data: Partial<WorkHourLogDTO>) => fetchApi<WorkHourLogDTO>('/work-hours', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    // Leaves
    applyForLeave: (data: Partial<LeaveApplicationDTO>) => fetchApi<LeaveApplicationDTO>('/leaves', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getMyLeaves: () => fetchApi<LeaveApplicationDTO[]>('/leaves/me'),
    getLeaves: () => fetchApi<LeaveApplicationDTO[]>('/leaves'),
    approveLeave: (id: string, status: 'APPROVED' | 'REJECTED') => fetchApi<LeaveApplicationDTO>(`/leaves/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    }),

    // KPIs
    getEmployeeKPIs: (employeeId: string) => fetchApi<KPIMetricDTO[]>(`/kpis/employees/${employeeId}`),

    // Chats
    sendChatMessage: (data: { receiverId: string; content: string }) => fetchApi<any>('/chats/send', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getMyChats: () => fetchApi<{ data: any[] }>('/chats/me'),
    getAdminChats: () => fetchApi<{ data: any[], message: string }>('/chats/admin'),
    deleteChatMessage: (messageId: string, forEveryone: boolean) => fetchApi<any>(`/chats/${encodeURIComponent(messageId)}/delete`, {
        method: 'POST',
        body: JSON.stringify({ forEveryone })
    }),

    // Notifications
    broadcastNotification: (data: { title: string; message: string; type: string; metadata?: any }) => fetchApi<{ success: boolean; count: number }>('/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    // Rules
    getRules: () => fetchApi<RuleDTO[]>('/rules'),
    createRule: (data: Partial<RuleDTO>) => fetchApi<RuleDTO>('/rules', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateRule: (id: string, data: Partial<RuleDTO>) => fetchApi<RuleDTO>(`/rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),
    deleteRule: (id: string) => fetchApi<void>(`/rules/${id}`, {
        method: 'DELETE'
    }),

    // Announcements
    getAnnouncements: () => fetchApi<any[]>('/announcements'),
    createAnnouncement: (data: { title: string; message: string; type?: string }) => fetchApi<any>('/announcements', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateAnnouncementStatus: (id: string, status: 'active' | 'inactive') => fetchApi<any>(`/announcements/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    }),
    deleteAnnouncement: (id: string) => fetchApi<void>(`/announcements/${id}`, {
        method: 'DELETE'
    }),

    // Uploads
    uploadFile: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetchApi<{ url: string }>('/uploads/file', {
            method: 'POST',
            body: formData
        });
    },
};
