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
import { getUserFromToken } from './auth';
import { supabase } from './supabase';

const handleSupabaseError = (error: any, context: string) => {
    if (error) {
        console.error(`Supabase Error (${context}):`, error);
        throw new Error(error.message || `An error occurred during ${context}`);
    }
};

export const api = {
    // Employees
    getEmployeeStats: async () => {
        const { data, error } = await supabase.from('employees').select('id, status');
        handleSupabaseError(error, 'Fetch Stats');
        return {
            total: data?.length || 0,
            active: data?.filter(e => e.status === 'ACTIVE').length || 0
        };
    },
    getEmployees: async (options?: { page?: number, limit?: number, search?: string, roleId?: string, status?: string, department?: string, sortBy?: string }) => {
        let query = supabase.from('employees').select('*', { count: 'exact' });
        
        if (options?.search) {
            query = query.or(`firstName.ilike.%${options.search}%,lastName.ilike.%${options.search}%,email.ilike.%${options.search}%`);
        }
        if (options?.roleId) query = query.eq('roleId', options.roleId);
        if (options?.status) query = query.eq('status', options.status);
        if (options?.department) query = query.eq('department', options.department);
        
        if (options?.sortBy) {
            const [col, dir] = options.sortBy.split(':');
            query = query.order(col || 'firstName', { ascending: dir !== 'desc' });
        } else {
            query = query.order('firstName', { ascending: true });
        }

        const page = options?.page || 1;
        const limit = options?.limit || 10;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        query = query.range(from, to);

        const { data, error, count } = await query;
        handleSupabaseError(error, 'Fetch Employees');

        return {
            data: data as EmployeeDTO[],
            total: count || 0,
            page
        };
    },
    getEmployeeById: async (id: string) => {
        const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
        handleSupabaseError(error, 'Fetch Employee');
        return data as EmployeeDTO;
    },
    createEmployee: async (data: any) => {
        const { data: res, error } = await supabase.from('employees').insert(data).select().single();
        handleSupabaseError(error, 'Create Employee');
        return res as EmployeeDTO;
    },
    createEmployeeAccount: async (data: any): Promise<{ userId: string; email: string; tempPassword: string }> => {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Not authenticated. Please log in again.');

        const { data: res, error } = await supabase.functions.invoke('create-user', {
            body: data,
            headers: { Authorization: `Bearer ${token}` },
        });
        if (error) throw new Error(error.message || 'Edge function error');
        if (res?.error) throw new Error(res.error);
        return res as { userId: string; email: string; tempPassword: string };
    },
    updateEmployeeStatus: async (id: string, status: string) => {
        const { data, error } = await supabase.from('employees').update({ status }).eq('id', id).select().single();
        handleSupabaseError(error, 'Update Status');
        return data as EmployeeDTO;
    },
    updateEmployee: async (id: string, data: any) => {
        const { data: res, error } = await supabase.from('employees').update(data).eq('id', id).select().single();
        handleSupabaseError(error, 'Update Employee');
        return res as EmployeeDTO;
    },
    deleteEmployee: async (id: string) => {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        handleSupabaseError(error, 'Delete Employee');
    },

    // Tasks
    getTasks: async (assigneeId?: string, status?: string) => {
        let query = supabase.from('tasks').select('*, assignee:employees!assigneeId(*)');
        if (assigneeId) query = query.eq('assigneeId', assigneeId);
        if (status) query = query.eq('status', status);
        const { data, error } = await query.order('createdAt', { ascending: false });
        handleSupabaseError(error, 'Fetch Tasks');
        return data as TaskDTO[];
    },
    createTask: async (data: Partial<TaskDTO>) => {
        const { data: res, error } = await supabase.from('tasks').insert(data).select().single();
        handleSupabaseError(error, 'Create Task');
        return res as TaskDTO;
    },
    updateTaskStatus: async (id: string, status: string) => {
        const { data, error } = await supabase.from('tasks').update({ status }).eq('id', id).select().single();
        handleSupabaseError(error, 'Update Task Status');
        return data as TaskDTO;
    },
    updateTask: async (id: string, data: Partial<TaskDTO>) => {
        const { data: res, error } = await supabase.from('tasks').update(data).eq('id', id).select().single();
        handleSupabaseError(error, 'Update Task');
        return res as TaskDTO;
    },

    // EOD
    submitEOD: async (data: Partial<EODSubmissionDTO>) => {
        const { data: res, error } = await supabase.from('eod_reports').insert(data).select().single();
        handleSupabaseError(error, 'Submit EOD');
        return res as EODSubmissionDTO;
    },
    getMyEODs: async () => {
        const user = getUserFromToken();
        if (!user || !user.id) throw new Error('Not authenticated');
        const { data, error } = await supabase.from('eod_reports').select('*').eq('employeeId', user.id).order('reportDate', { ascending: false });
        handleSupabaseError(error, 'Fetch My EODs');
        return data as EODSubmissionDTO[];
    },
    getAllEODs: async () => {
        const { data, error } = await supabase.from('eod_reports').select('*, employee:employees!employeeId(id, firstName, lastName, profilePhoto)').order('reportDate', { ascending: false });
        handleSupabaseError(error, 'Fetch All EODs');
        return data as any[];
    },
    updateEODSentiment: async (id: string, sentiment: string) => {
        const { data, error } = await supabase.from('eod_reports').update({ sentiment }).eq('id', id).select().single();
        handleSupabaseError(error, 'Update Sentiment');
        return data as any;
    },

    // Work Hours
    logWorkHours: async (data: Partial<WorkHourLogDTO>) => {
        const { data: res, error } = await supabase.from('work_hours').insert(data).select().single();
        handleSupabaseError(error, 'Log Work Hours');
        return res as WorkHourLogDTO;
    },

    // Leaves
    applyForLeave: async (data: Partial<LeaveApplicationDTO>) => {
        const { data: res, error } = await supabase.from('leaves').insert(data).select().single();
        handleSupabaseError(error, 'Apply for Leave');
        return res as LeaveApplicationDTO;
    },
    getMyLeaves: async () => {
        const user = getUserFromToken();
        if (!user || !user.id) throw new Error('Not authenticated');
        const { data, error } = await supabase.from('leaves').select('*').eq('employeeId', user.id).order('createdAt', { ascending: false });
        handleSupabaseError(error, 'Fetch My Leaves');
        return data as LeaveApplicationDTO[];
    },
    getLeaves: async () => {
        const { data, error } = await supabase.from('leaves').select('*, employee:employees!employeeId(*)').order('createdAt', { ascending: false });
        handleSupabaseError(error, 'Fetch Leaves');
        return data as LeaveApplicationDTO[];
    },
    approveLeave: async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const user = getUserFromToken();
        const updateData = { status, approverId: user?.id };
        const { data, error } = await supabase.from('leaves').update(updateData).eq('id', id).select().single();
        handleSupabaseError(error, 'Approve Leave');
        return data as LeaveApplicationDTO;
    },

    // KPIs
    getEmployeeKPIs: async (employeeId: string) => {
        const { data, error } = await supabase.from('kpi_metrics').select('*').eq('employeeId', employeeId).order('lastUpdated', { ascending: false });
        handleSupabaseError(error, 'Fetch KPIs');
        return data as KPIMetricDTO[];
    },

    // Chats
    sendChatMessage: async (data: { receiverId: string; content: string }) => {
        const user = getUserFromToken();
        if (!user || !user.id) throw new Error('Not authenticated');
        const msg = { ...data, senderId: user.id };
        const { data: res, error } = await supabase.from('messages').insert(msg).select().single();
        handleSupabaseError(error, 'Send Message');
        return res;
    },
    getMyChats: async () => {
        const user = getUserFromToken();
        if (!user || !user.id) throw new Error('Not authenticated');
        const { data, error } = await supabase.from('messages')
            .select('*')
            .or(`senderId.eq.${user.id},receiverId.eq.${user.id}`)
            .order('sentAt', { ascending: true });
        handleSupabaseError(error, 'Fetch My Chats');
        return { data: data || [] };
    },
    getAdminChats: async () => {
        const { data, error } = await supabase.from('messages')
            .select('*, sender:employees!senderId(*), receiver:employees!receiverId(*)')
            .order('sentAt', { ascending: false });
        handleSupabaseError(error, 'Fetch Admin Chats');
        return { data: data || [], message: 'Admin chats' };
    },
    deleteChatMessage: async (messageId: string, forEveryone: boolean) => {
        const { error } = await supabase.from('messages').delete().eq('id', messageId);
        handleSupabaseError(error, 'Delete Message');
        return { success: true };
    },

    // Notifications
    broadcastNotification: async (data: { title: string; message: string; type: string; metadata?: any }) => {
        const { error } = await supabase.from('notifications').insert(data);
        handleSupabaseError(error, 'Broadcast Notification');
        return { success: true, count: 1 };
    },

    // Rules
    getRules: async () => {
        const { data, error } = await supabase.from('rules').select('*, author:employees!createdBy(id, firstName, lastName)').order('createdAt', { ascending: false });
        handleSupabaseError(error, 'Fetch Rules');
        return data as RuleDTO[];
    },
    createRule: async (data: Partial<RuleDTO>) => {
        const user = getUserFromToken();
        const ruleData = { ...data, createdBy: user?.id };
        const { data: res, error } = await supabase.from('rules').insert(ruleData).select().single();
        handleSupabaseError(error, 'Create Rule');
        return res as RuleDTO;
    },
    updateRule: async (id: string, data: Partial<RuleDTO>) => {
        const { data: res, error } = await supabase.from('rules').update(data).eq('id', id).select().single();
        handleSupabaseError(error, 'Update Rule');
        return res as RuleDTO;
    },
    deleteRule: async (id: string) => {
        const { error } = await supabase.from('rules').delete().eq('id', id);
        handleSupabaseError(error, 'Delete Rule');
    },

    // Announcements
    getAnnouncements: async () => {
        const { data, error } = await supabase.from('announcements').select('*').order('createdAt', { ascending: false });
        handleSupabaseError(error, 'Fetch Announcements');
        return data as any[];
    },
    createAnnouncement: async (data: { title: string; message: string; type?: string }) => {
        const { data: res, error } = await supabase.from('announcements').insert(data).select().single();
        handleSupabaseError(error, 'Create Announcement');
        return res as any;
    },
    updateAnnouncementStatus: async (id: string, status: 'active' | 'inactive') => {
        const { data, error } = await supabase.from('announcements').update({ status }).eq('id', id).select().single();
        handleSupabaseError(error, 'Update Announcement Status');
        return data as any;
    },
    deleteAnnouncement: async (id: string) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        handleSupabaseError(error, 'Delete Announcement');
    },

    // Uploads
    uploadFile: async (file: File) => {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const { error } = await supabase.storage.from('uploads').upload(fileName, file);
        handleSupabaseError(error, 'File Upload');
        
        const { data: pubData } = supabase.storage.from('uploads').getPublicUrl(fileName);
        return { url: pubData.publicUrl };
    },
};
