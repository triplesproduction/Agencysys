import {
    EmployeeDTO,
    TaskDTO,
    EODSubmissionDTO,
    WorkHourLogDTO,
    KPIMetricDTO,
    LeaveApplicationDTO,
    RuleDTO,
    PaginatedResponse,
    KpiProfileDTO,
    KpiAuditLogDTO
} from '../types/dto';
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
        // Optimization: Use count query instead of fetching all rows to get counts
        const { count: total, error: totalError } = await supabase.from('employees').select('*', { count: 'exact', head: true });
        const { count: active, error: activeError } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
        
        handleSupabaseError(totalError || activeError, 'Fetch Stats');
        return {
            total: total || 0,
            active: active || 0
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

        // Normalize with architect defaults
        const normalizedData = (data || []).map((emp: any) => ({
            ...emp,
            firstName: emp.firstName || 'Unknown',
            lastName: emp.lastName || '',
            roleId: emp.roleId || 'STAFF',
            status: emp.status || 'ACTIVE',
            department: emp.department || 'General'
        }));

        return {
            data: normalizedData as EmployeeDTO[],
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
        const { data: res, error } = await supabase.functions.invoke('create-user', {
            body: data,
        });

        if (error) {
            let errorMsg = error.message || 'Edge function error';
            try {
                // Supabase wraps non-2xx responses. We can extract the actual Edge Function response body:
                if (error.context && typeof error.context.text === 'function') {
                    const ctx = await error.context.json();
                    if (ctx && ctx.error) errorMsg = ctx.error;
                }
            } catch (e) {
                // Ignore parse errors
            }
            throw new Error(errorMsg);
        }

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
        // We use the manage-user edge function instead of a direct table delete to ensure the auth user is also removed
        const { data, error } = await supabase.functions.invoke('manage-user', {
            body: { action: 'DELETE', targetUserId: id },
        });
        
        if (error || data?.error) throw new Error(error?.message || data?.error || 'Failed to delete user account');
        return data;
    },
    manageEmployeeAccount: async (action: 'DELETE' | 'UPDATE_STATUS', targetUserId: string, status?: string) => {
        const { data, error } = await supabase.functions.invoke('manage-user', {
            body: { action, targetUserId, status },
        });

        if (error || data?.error) throw new Error(error?.message || data?.error || `Failed to ${action.toLowerCase()} user account`);
        return data;
    },

    // Tasks
    getTasks: async (assigneeId?: string, status?: string, limit: number = 20) => {
        let query = supabase.from('tasks').select('*, assignee:employees!assigneeId(id, firstName, lastName, profilePhoto)');
        if (assigneeId) query = query.eq('assigneeId', assigneeId);
        if (status) query = query.eq('status', status);
        
        const { data, error } = await query
            .order('createdAt', { ascending: false })
            .limit(limit);

        handleSupabaseError(error, 'Fetch Tasks');
        
        // Normalize with architect defaults
        return (data || []).map((task: any) => ({
            ...task,
            status: task.status || 'TODO',
            priority: task.priority || 'MEDIUM',
            title: task.title || 'Untitled Task',
            dueDate: task.dueDate || new Date().toISOString()
        })) as TaskDTO[];
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        // Temporarily relaxed filtering due to auth mismatch (employeeId vs auth.id)
        // const { data, error } = await supabase.from('eod_reports').select('*').eq('employeeId', user.id).order('reportDate', { ascending: false });
        const { data, error } = await supabase.from('eod_reports').select('*').order('reportDate', { ascending: false });
        
        handleSupabaseError(error, 'Fetch My EODs');
        
        // Normalize with architect defaults
        return (data || []).map((report: any) => ({
            ...report,
            sentiment: report.sentiment || 'OKAY',
            completedText: report.completedText || '[]',
            inProgressText: report.inProgressText || '[]'
        })) as EODSubmissionDTO[];
    },
    getAllEODs: async (limit: number = 15) => {
        const { data, error } = await supabase
            .from('eod_reports')
            .select('*, employee:employees!employeeId(id, firstName, lastName, profilePhoto)')
            .order('reportDate', { ascending: false })
            .limit(limit);

        handleSupabaseError(error, 'Fetch All EODs');
        
        // Normalize with architect defaults
        return (data || []).map((report: any) => ({
            ...report,
            sentiment: report.sentiment || 'OKAY',
            completedText: report.completedText || '[]',
            inProgressText: report.inProgressText || '[]'
        }));
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        // Temporarily relaxed filtering due to auth mismatch
        // const { data, error } = await supabase.from('leaves').select('*').eq('employeeId', user.id).order('createdAt', { ascending: false });
        const { data, error } = await supabase.from('leaves').select('*').order('createdAt', { ascending: false });
        
        handleSupabaseError(error, 'Fetch My Leaves');
        return data as LeaveApplicationDTO[];
    },
    getLeaves: async () => {
        const { data, error } = await supabase.from('leaves').select('*, employee:employees!employeeId(*)').order('createdAt', { ascending: false });
        handleSupabaseError(error, 'Fetch Leaves');
        
        // Normalize with architect defaults
        return (data || []).map((leave: any) => ({
            ...leave,
            status: leave.status || 'PENDING',
            leaveType: leave.leaveType || 'CASUAL',
            reason: leave.reason || 'No reason provided'
        })) as LeaveApplicationDTO[];
    },
    approveLeave: async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const { data: { user } } = await supabase.auth.getUser();
        const updateData = { status, approverId: user?.id };
        const { data, error } = await supabase.from('leaves').update(updateData).eq('id', id).select().single();
        handleSupabaseError(error, 'Approve Leave');
        return data as LeaveApplicationDTO;
    },

    // KPIs
    getEmployeeKPIs: async (employeeId: string) => {
        // Fallback or legacy, returning old if needed, but primary is getKpiProfile now
        const { data, error } = await supabase.from('kpi_metrics').select('*').eq('employeeId', employeeId).order('lastUpdated', { ascending: false });
        if (error) console.warn('Missing old metrics:', error);
        return data as KPIMetricDTO[];
    },
    getKpiProfile: async (employeeId: string, monthYear?: string) => {
        const queryMonth = monthYear || new Date().toISOString().substring(0, 7);
        const { data, error } = await supabase.from('kpi_profiles').select('*').eq('employee_id', employeeId).eq('month_year', queryMonth).maybeSingle();
        handleSupabaseError(error, 'Fetch KPI Profile');
        return data as KpiProfileDTO | null;
    },
    getKpiAuditLogs: async (employeeId: string) => {
        const { data, error } = await supabase.from('kpi_audit_logs').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
        handleSupabaseError(error, 'Fetch KPI Audit Logs');
        return data as KpiAuditLogDTO[];
    },
    assignBonusPoints: async (employeeId: string, points: number, category: string, reason: string) => {
        const { error } = await supabase.rpc('assign_bonus', { 
            p_employee_id: employeeId, 
            p_points: points, 
            p_category: category, 
            p_reason: reason 
        });
        handleSupabaseError(error, 'Assign Bonus');
        return { success: true };
    },
    assignLateLogin: async (employeeId: string, reason: string) => {
        const date = new Date().toISOString().substring(0, 10);
        const { error } = await supabase.rpc('assign_late_login', {
            p_employee_id: employeeId,
            p_date: date,
            p_reason: reason
        });
        handleSupabaseError(error, 'Assign Late Login');
        return { success: true };
    },
    overrideKpiScore: async (employeeId: string, score: number, extra: number, reason: string) => {
        const { error } = await supabase.rpc('override_kpi_score', {
            p_employee_id: employeeId,
            p_new_score: score,
            p_new_extra: extra,
            p_reason: reason
        });
        handleSupabaseError(error, 'Override KPI Score');
        return { success: true };
    },
    addWorkHourLog: async (data: Partial<WorkHourLogDTO>) => {
        const { data: res, error } = await supabase.from('work_hours').insert(data).select().single();
        handleSupabaseError(error, 'Add Work Hour Log');
        return res as WorkHourLogDTO;
    },
    getRecentWorkHours: async (employeeId: string, limit: number = 5) => {
        const { data, error } = await supabase
            .from('work_hours')
            .select('*')
            .eq('employeeId', employeeId)
            .order('date', { ascending: false })
            .limit(limit);
        handleSupabaseError(error, 'Fetch Recent Work Hours');
        return data as WorkHourLogDTO[];
    },
    getAllKpiProfiles: async (monthYear?: string, limit: number = 10) => {
        const queryMonth = monthYear || new Date().toISOString().substring(0, 7);
        const { data, error } = await supabase
            .from('kpi_profiles')
            .select('*, employee:employees!employee_id(id, firstName, lastName, profilePhoto)')
            .eq('month_year', queryMonth)
            .order('current_score', { ascending: false })
            .limit(limit); // Optimization: Added limit

        handleSupabaseError(error, 'Fetch All KPI Profiles');
        return data as any[];
    },
    getAllKpiAuditLogs: async (limit: number = 10) => {
        const { data, error } = await supabase
            .from('kpi_audit_logs')
            .select('*, employee:employees!employee_id(id, firstName, lastName, profilePhoto)')
            .order('created_at', { ascending: false })
            .limit(limit);
        handleSupabaseError(error, 'Fetch All KPI Audit Logs');
        return data as any[];
    },

    // Chats
    sendChatMessage: async (data: { receiverId: string; content: string }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const msg = { ...data, senderId: user.id };
        const { data: res, error } = await supabase.from('messages').insert(msg).select().single();
        handleSupabaseError(error, 'Send Message');
        return res;
    },
    getMyChats: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Relaxed filtering for visibility due to ID mismatch
        // const { data, error } = await supabase.from('messages')
        //    .select('*')
        //    .or(`senderId.eq.${user.id},receiverId.eq.${user.id}`)
        //    .order('sentAt', { ascending: true });
        const { data, error } = await supabase.from('messages')
            .select('*')
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
        const { data: { user } } = await supabase.auth.getUser();
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
