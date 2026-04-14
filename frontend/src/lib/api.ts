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

const handleSupabaseEvent = (data: any, error: any, context: string) => {
    // Standardized high-fidelity logging for all system events
    console.log(`[DB TRACE] ${context}:`, { data, error });

    if (error) {
        console.error(`Supabase Error (${context}):`, error);
        throw new Error(error.message || `An error occurred during ${context}`);
    }
};

const normalizeEmployee = (emp: any): EmployeeDTO => ({
    ...emp,
    firstName: emp.firstName || emp.first_name || 'Unknown',
    lastName: emp.lastName || emp.last_name || '',
    profilePhoto: emp.profilePhoto || emp.profile_photo,
    roleId: emp.roleId || 'EMPLOYEE',
    designation: emp.designation || emp.roleId || 'Staff',
    status: emp.status || 'ACTIVE',
    department: emp.department || 'General'
});

export const api = {
    // Employees
    getEmployeeStats: async () => {
        // Optimization: Use count query instead of fetching all rows to get counts
        const { count: total, error: totalError } = await supabase.from('employees').select('*', { count: 'exact', head: true })
            .neq('roleId', 'ADMIN').neq('roleId', 'admin');
        const { count: active, error: activeError } = await supabase.from('employees').select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE').neq('roleId', 'ADMIN').neq('roleId', 'admin');
        
        handleSupabaseEvent({ total, active }, totalError || activeError, 'Fetch Stats');
        return {
            total: total || 0,
            active: active || 0
        };
    },
    getEmployees: async (options?: { page?: number, limit?: number, search?: string, roleId?: string, status?: string, department?: string, sortBy?: string, excludeAdmin?: boolean }) => {
        let query = supabase.from('employees').select('*', { count: 'exact' });
        
        if (options?.search) {
            query = query.or(`firstName.ilike.%${options.search}%,lastName.ilike.%${options.search}%,email.ilike.%${options.search}%`);
        }
        if (options?.roleId) {
            query = query.eq('roleId', options.roleId);
        } else if (options?.excludeAdmin) {
            query = query.neq('roleId', 'ADMIN').neq('roleId', 'admin');
        }
        
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
        handleSupabaseEvent(data, error, 'Fetch Employees');

        // Normalize with architect defaults
        const normalizedData = (data || []).map(normalizeEmployee);

        return {
            data: normalizedData as EmployeeDTO[],
            total: count || 0,
            page
        };
    },
    getEmployeeById: async (id: string) => {
        const { data, error } = await supabase
            .from('employees')
            .select(`
                *,
                tasksAssigned:tasks!assigneeId(*),
                kpis:kpi_metrics(*),
                documents:employee_documents(*),
                salaryHistory:salary_history(*)
            `)
            .eq('id', id)
            .single();
        
        handleSupabaseEvent(data, error, 'Fetch Employee Full Profile');
        return data ? normalizeEmployee(data) : null;
    },
    createEmployee: async (data: any) => {
        console.log('[API] Create Employee Payload:', data);
        const { data: res, error } = await supabase.from('employees').insert(data).select().single();
        handleSupabaseEvent(data, error, 'Create Employee');
        console.log('[API] Create Employee Response:', res);
        return res ? normalizeEmployee(res) : null;
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
        handleSupabaseEvent(data, error, 'Update Status');
        return data ? normalizeEmployee(data) : null;
    },
    updateEmployee: async (id: string, data: any) => {
        console.log(`[API] Update Employee (${id}) Payload:`, data);
        
        // Map camelCase keys to snake_case for database compatibility
        const mappedData = { ...data };
        if (mappedData.profilePhoto !== undefined) {
            mappedData.profile_photo = mappedData.profilePhoto;
            delete mappedData.profilePhoto;
        }

        const updatePromise = supabase
            .from('employees')
            .update(mappedData)
            .eq('id', id)
            .select();

        // 10-second safety timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Update timed out. Verify your database columns use camelCase.')), 10000)
        );

        const { data: rows, error } = await Promise.race([updatePromise, timeoutPromise]) as any;

        if (error) {
            console.error('[API] updateEmployee Supabase error:', error);
            throw new Error(error.message || 'Failed to update employee');
        }

        console.log('[API] updateEmployee Response (rows):', rows);
        return rows && rows.length > 0 ? normalizeEmployee(rows[0]) : null;
    },
    deleteEmployee: async (id: string) => {
        // We use the manage-user edge function instead of a direct table delete to ensure the auth user is also removed
        const { data, error } = await supabase.functions.invoke('manage-user', {
            body: { action: 'DELETE', targetUserId: id },
        });
        
        if (error || data?.error) throw new Error(error?.message || data?.error || 'Failed to delete user account');
        return data;
    },
    manageEmployeeAccount: async (action: 'DELETE' | 'UPDATE_STATUS' | 'UPDATE_PASSWORD', targetUserId: string, payload?: any) => {
        const { data, error } = await supabase.functions.invoke('manage-user', {
            body: { action, targetUserId, ...payload },
        });

        if (error || data?.error) throw new Error(error?.message || data?.error || `Failed to ${action.toLowerCase()} user account`);
        return data;
    },

    // --- Salary & Payroll ---
    addSalaryHike: async (employeeId: string, amount: number, effectiveDate: string, reason: string) => {
        // 1. Add to salaryHistory table
        const { data: hike, error: hikeError } = await supabase.from('salary_history').insert({
            employeeId: employeeId,
            amount: amount,
            effectiveDate: effectiveDate,
            reason: reason
        }).select().single();
        
        if (hikeError) throw hikeError;

        // 2. Update current baseSalary in employees table
        const { error: empError } = await supabase.from('employees')
            .update({ baseSalary: amount })
            .eq('id', employeeId);

        if (empError) throw empError;
        return hike;
    },

    getPayrollRecords: async (month: number, year: number) => {
        const { data, error } = await supabase
            .from('payroll_records')
            .select(`
                *,
                employee:employees(*)
            `)
            .eq('month', month)
            .eq('year', year);
        if (error) throw error;
        return data as any[];
    },

    savePayrollRecord: async (record: any) => {
        const { data, error } = await supabase
            .from('payroll_records')
            .upsert({
                employeeId: record.employeeId,
                month: record.month,
                year: record.year,
                baseSalary: record.baseSalary,
                deductions: record.deductions,
                netPayable: record.netPayable,
                workingDays: record.workingDays,
                daysPresent: record.daysPresent,
                approvedLeaves: record.approvedLeaves,
                unpaidAbsences: record.unpaidAbsences,
                formula: record.formula,
                status: record.status
            })
            .select()
            .single();
        if (error) throw error;
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

        handleSupabaseEvent(data, error, 'Fetch Tasks');
        
        // Normalize with architect defaults
        return (data || []).map((task: any) => ({
            ...task,
            status: task.status || 'TODO',
            priority: task.priority || 'MEDIUM',
            title: task.title || 'Untitled Task',
            dueDate: task.dueDate || new Date().toISOString()
        })) as TaskDTO[];
    },
    createTask: async (payload: Partial<TaskDTO>) => {
        // Safe mapping to handle DB schema limitations
        const data = { ...payload };
        if (data.assigneeIds && data.assigneeIds.length > 0) {
            data.assigneeId = data.assigneeIds[0];
        }
        delete data.assigneeIds;

        const { data: res, error } = await supabase.from('tasks').insert(data).select().single();
        handleSupabaseEvent(data, error, 'Create Task');
        return res as TaskDTO;
    },

    updateTaskStatus: async (id: string, status: string) => {
        const { data, error } = await supabase.from('tasks').update({ status }).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Task Status');
        return data as TaskDTO;
    },
    updateTask: async (id: string, payload: Partial<TaskDTO>) => {
        // Safe mapping to handle DB schema limitations
        const data = { ...payload };
        if (data.assigneeIds && data.assigneeIds.length > 0) {
            data.assigneeId = data.assigneeIds[0];
        }
        delete data.assigneeIds;

        const { data: res, error } = await supabase.from('tasks').update(data).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Task');
        return res as TaskDTO;
    },

    deleteTask: async (id: string) => {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Task');
        return { success: true };
    },

    // EOD
    submitEOD: async (data: Partial<EODSubmissionDTO>) => {
        const { data: res, error } = await supabase.from('eod_reports').insert(data).select().single();
        handleSupabaseEvent(data, error, 'Submit EOD');
        return res as EODSubmissionDTO;
    },
    updateEOD: async (id: string, data: Partial<EODSubmissionDTO>) => {
        const { data: res, error } = await supabase.from('eod_reports').update(data).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update EOD');
        return res as EODSubmissionDTO;
    },
    getMyEODs: async (userId: string) => {
        if (!userId) throw new Error('Not authenticated');
        
        // Use the actual columns found in the DB (tasksCompleted/InProgress are arrays)
        const { data, error } = await supabase.from('eod_reports').select('*').eq('employeeId', userId).order('reportDate', { ascending: false });
        
        handleSupabaseEvent(data, error, 'Fetch My EODs');
        
        // Normalize with architect defaults
        return (data || []).map((report: any) => ({
            ...report,
            sentiment: report.sentiment || 'OKAY',
            tasksCompleted: report.tasksCompleted || [],
            tasksInProgress: report.tasksInProgress || []
        })) as EODSubmissionDTO[];
    },
    getAllEODs: async (limit: number = 15) => {
        const { data, error } = await supabase
            .from('eod_reports')
            .select('*, employee:employees!employeeId(id, firstName, lastName, profilePhoto)')
            .order('reportDate', { ascending: false })
            .limit(limit);

        handleSupabaseEvent(data, error, 'Fetch All EODs');
        
        // Normalize with architect defaults
        return (data || []).map((report: any) => ({
            ...report,
            sentiment: report.sentiment || 'OKAY',
            tasksCompleted: report.tasksCompleted || [],
            tasksInProgress: report.tasksInProgress || []
        }));
    },
    updateEODSentiment: async (id: string, sentiment: string) => {
        const { data, error } = await supabase.from('eod_reports').update({ sentiment }).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Sentiment');
        return data as any;
    },
    reviewEOD: async (id: string, payload: { employeeId: string; date: string; workHours: number; adminNote?: string; status: string }) => {
        // Find existing work hour log for this date and employee
        const { data: logs } = await supabase.from('work_hours').select('*').eq('employeeId', payload.employeeId).eq('date', payload.date);
        
        if (logs && logs.length > 0) {
            // Update existing
            const note = payload.adminNote ? `[Review Note: ${payload.adminNote}]` : '';
            const statusStr = payload.status ? ` [Status: ${payload.status}]` : '';
            const { data, error } = await supabase.from('work_hours')
                .update({ 
                    hoursLogged: payload.workHours, 
                    description: `Admin updated on ${new Date().toLocaleDateString()}. ${note}${statusStr}` 
                })
                .eq('id', logs[0].id)
                .select().single();
            handleSupabaseEvent(data, error, 'Update Work Hours via Review');
            return data;
        } else {
            // Create new
            const data = await api.addWorkHourLog({
                employeeId: payload.employeeId,
                date: payload.date,
                hoursLogged: payload.workHours,
                description: `Admin reviewed on ${new Date().toLocaleDateString()}. Status: ${payload.status}. Note: ${payload.adminNote || 'None'}`
            });
            return data;
        }
    },
    getWorkHoursByDate: async (employeeId: string, date: string) => {
        const { data, error } = await supabase.from('work_hours').select('*').eq('employeeId', employeeId).eq('date', date).maybeSingle();
        return data;
    },
    getMonthlyAttendance: async (month: number, year: number) => {
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('eod_reports')
            .select('employeeId, reportDate')
            .gte('reportDate', startDate)
            .lte('reportDate', endDate);
            
        handleSupabaseEvent(data, error, 'Fetch Monthly Attendance');
        
        // Return a map of employeeId -> count of unique days
        const attendanceMap: Record<string, number> = {};
        (data || []).forEach((report: any) => {
            if (!attendanceMap[report.employeeId]) attendanceMap[report.employeeId] = 0;
            attendanceMap[report.employeeId]++;
        });
        return attendanceMap;
    },

    // Work Hours
    logWorkHours: async (data: Partial<WorkHourLogDTO>) => {
        const { data: res, error } = await supabase.from('work_hours').insert(data).select().single();
        handleSupabaseEvent(data, error, 'Log Work Hours');
        return res as WorkHourLogDTO;
    },

    // Leaves
    applyForLeave: async (data: Partial<LeaveApplicationDTO>) => {
        const { data: res, error } = await supabase.from('leaves').insert(data).select().single();
        handleSupabaseEvent(data, error, 'Apply for Leave');
        return res as LeaveApplicationDTO;
    },
    getMyLeaves: async (userId: string) => {
        if (!userId) throw new Error('Not authenticated');
        
        // Temporarily relaxed filtering due to auth mismatch
        // const { data, error } = await supabase.from('leaves').select('*').eq('employeeId', user.id).order('createdAt', { ascending: false });
        const { data, error } = await supabase.from('leaves').select('*').order('createdAt', { ascending: false });
        
        handleSupabaseEvent(data, error, 'Fetch My Leaves');
        return data as LeaveApplicationDTO[];
    },
    getEmployeeLeaves: async (employeeId: string) => {
        const { data, error } = await supabase.from('leaves').select('*').eq('employeeId', employeeId).order('startDate', { ascending: false });
        handleSupabaseEvent(data, error, 'Fetch Employee Leaves');
        return data as LeaveApplicationDTO[];
    },
    getLeaves: async () => {
        const { data, error } = await supabase.from('leaves').select('*, employee:employees!employeeId(*)').order('createdAt', { ascending: false });
        handleSupabaseEvent(data, error, 'Fetch Leaves');
        
        // Normalize with architect defaults
        return (data || []).map((leave: any) => ({
            ...leave,
            status: leave.status || 'PENDING',
            leaveType: leave.leaveType || 'CASUAL',
            reason: leave.reason || 'No reason provided'
        })) as LeaveApplicationDTO[];
    },
    approveLeave: async (id: string, status: 'APPROVED' | 'REJECTED', approverId: string) => {
        const updateData = { status, approverId };
        const { data, error } = await supabase.from('leaves').update(updateData).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Approve Leave');
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
        // Using snake_case columns as established in DB schema
        const { data, error } = await supabase.from('kpi_profiles').select('*').eq('employee_id', employeeId).eq('month_year', queryMonth).maybeSingle();
        handleSupabaseEvent(data, error, 'Fetch KPI Profile');
        
        if (!data) return null;

        // Map back to camelCase DTO if needed, or return as is if DTO handles it
        return {
            ...data,
            employeeId: data.employee_id,
            monthYear: data.month_year,
            currentScore: data.current_score
        } as KpiProfileDTO;
    },
    getKpiAuditLogs: async (employeeId: string) => {
        // Using snake_case columns: employee_id, created_at
        const { data, error } = await supabase.from('kpi_audit_logs').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
        handleSupabaseEvent(data, error, 'Fetch KPI Audit Logs');
        
        return (data || []).map((log: any) => ({
            ...log,
            employeeId: log.employee_id,
            createdAt: log.created_at,
            pointsChange: log.points_change,
            eventSource: log.event_source,
            visibleScoreBefore: log.visible_score_before,
            visibleScoreAfter: log.visible_score_after
        })) as KpiAuditLogDTO[];
    },
    assignBonusPoints: async (employeeId: string, points: number, category: string, reason: string) => {
        const { error } = await supabase.rpc('assign_bonus', { 
            p_employee_id: employeeId, 
            p_points: points, 
            p_category: category, 
            p_reason: reason 
        });
        handleSupabaseEvent(null, error, 'Assign Bonus');
        return { success: true };
    },
    assignLateLogin: async (employeeId: string, reason: string) => {
        const date = new Date().toISOString().substring(0, 10);
        const { error } = await supabase.rpc('assign_late_login', {
            p_employee_id: employeeId,
            p_date: date,
            p_reason: reason
        });
        handleSupabaseEvent(null, error, 'Assign Late Login');
        return { success: true };
    },
    overrideKpiScore: async (employeeId: string, score: number, extra: number, reason: string) => {
        const { error } = await supabase.rpc('override_kpi_score', {
            p_employee_id: employeeId,
            p_new_score: score,
            p_new_extra: extra,
            p_reason: reason
        });
        handleSupabaseEvent(null, error, 'Override KPI Score');
        return { success: true };
    },
    addWorkHourLog: async (data: Partial<WorkHourLogDTO>) => {
        const { data: res, error } = await supabase.from('work_hours').insert(data).select().single();
        handleSupabaseEvent(res, error, 'Add Work Hour Log');
        return res as WorkHourLogDTO;
    },
    getRecentWorkHours: async (employeeId: string, limit: number = 5) => {
        const { data, error } = await supabase
            .from('work_hours')
            .select('*')
            .eq('employeeId', employeeId)
            .order('date', { ascending: false })
            .limit(limit);
        handleSupabaseEvent(data, error, 'Fetch Recent Work Hours');
        return data as WorkHourLogDTO[];
    },
    getMonthlyWorkHours: async (employeeId: string, monthYear?: string) => {
        // queryMonth format: YYYY-MM
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed
        
        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const nextMonthYear = month === 11 ? year + 1 : year;
        const nextMonth = month === 11 ? 0 : month + 1;
        const startOfNextMonth = new Date(nextMonthYear, nextMonth, 1).toISOString().split('T')[0];

        // If monthYear is provided, we'd need more logic, but for "current month" we use this range:
        const { data, error } = await supabase
            .from('work_hours')
            .select('hoursLogged')
            .eq('employeeId', employeeId)
            .gte('date', startOfMonth)
            .lt('date', startOfNextMonth);
        
        handleSupabaseEvent(data, error, 'Fetch Monthly Work Hours');
        const total = (data || []).reduce((acc: number, row: any) => acc + (parseFloat(row.hoursLogged) || 0), 0);
        return total;
    },
    getAllKpiProfiles: async (monthYear?: string, limit: number = 10) => {
        const queryMonth = monthYear || new Date().toISOString().substring(0, 7);
        const { data, error } = await supabase
            .from('kpi_profiles')
            .select('*, employee:employees!employee_id(id, firstName, lastName, profilePhoto:profile_photo)')
            .eq('month_year', queryMonth)
            .order('current_score', { ascending: false })
            .limit(limit);

        handleSupabaseEvent(data, error, 'Fetch All KPI Profiles');
        return (data || []).map((p: any) => ({
            ...p,
            employeeId: p.employee_id,
            monthYear: p.month_year,
            currentScore: p.current_score
        }));
    },
    getAllKpiAuditLogs: async (limit: number = 10) => {
        const { data, error } = await supabase
            .from('kpi_audit_logs')
            .select('*, employee:employees!employee_id(id, firstName, lastName, profilePhoto:profile_photo)')
            .order('created_at', { ascending: false })
            .limit(limit);
        handleSupabaseEvent(data, error, 'Fetch All KPI Audit Logs');
        
        return (data || []).map((log: any) => ({
            ...log,
            employeeId: log.employee_id,
            createdAt: log.created_at,
            pointsChange: log.points_change,
            eventSource: log.event_source,
            visibleScoreBefore: log.visible_score_before,
            visibleScoreAfter: log.visible_score_after
        }));
    },


    deleteChatMessage: async (messageId: string, _forEveryone: boolean) => {
        const { error } = await supabase.from('messages').delete().eq('id', messageId);
        handleSupabaseEvent(null, error, 'Delete Message');
        return { success: true };
    },

    // Notifications
    broadcastNotification: async (data: { title: string; message: string; type: string; metadata?: any }) => {
        const { error } = await supabase.from('notifications').insert(data);
        handleSupabaseEvent(data, error, 'Broadcast Notification');
        return { success: true, count: 1 };
    },

    // Rules
    getRules: async () => {
        const { data, error } = await supabase.from('rules').select('*, author:employees!createdBy(id, firstName, lastName)').order('createdAt', { ascending: false });
        handleSupabaseEvent(data, error, 'Fetch Rules');
        return data as RuleDTO[];
    },
    createRule: async (data: Partial<RuleDTO>, userId: string) => {
        const ruleData = { ...data, createdBy: userId };
        const { data: res, error } = await supabase.from('rules').insert(ruleData).select().single();
        handleSupabaseEvent(res, error, 'Create Rule');
        return res as RuleDTO;
    },
    updateRule: async (id: string, data: Partial<RuleDTO>) => {
        const { data: res, error } = await supabase.from('rules').update(data).eq('id', id).select().single();
        handleSupabaseEvent(res, error, 'Update Rule');
        return res as RuleDTO;
    },
    deleteRule: async (id: string) => {
        const { error } = await supabase.from('rules').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Rule');
    },

    // Announcements
    getAnnouncements: async () => {
        const { data, error } = await supabase.from('announcements').select('*').order('createdAt', { ascending: false });
        handleSupabaseEvent(data, error, 'Fetch Announcements');
        return data as any[];
    },
    createAnnouncement: async (data: { title: string; message: string; priority?: string; channel?: string; type?: string }) => {
        const { data: res, error } = await supabase.from('announcements').insert(data).select().single();
        handleSupabaseEvent(res, error, 'Create Announcement');
        return res as any;
    },
    updateAnnouncementStatus: async (id: string, status: 'active' | 'inactive') => {
        const { data, error } = await supabase.from('announcements').update({ status }).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Announcement Status');
        return data as any;
    },
    deleteAnnouncement: async (id: string) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Announcement');
    },

    // Uploads
    uploadPhoto: async (file: File, oldUrl?: string) => {
        // Delete old photo from storage if it exists
        if (oldUrl) {
            try {
                // Extract path after /public/documents/ from the Supabase public URL
                const marker = '/object/public/documents/';
                const idx = oldUrl.indexOf(marker);
                if (idx !== -1) {
                    const oldPath = oldUrl.substring(idx + marker.length);
                    // Only delete if it's a profile photo (not a default/external URL)
                    if (oldPath.startsWith('profiles/')) {
                        await supabase.storage.from('documents').remove([oldPath]);
                    }
                }
            } catch (delErr) {
                console.warn('Could not delete old profile photo:', delErr);
            }
        }

        // Upload new photo
        const ext = file.name.split('.').pop();
        const fileName = `profiles/${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(fileName, file, { upsert: true });
        if (error) throw new Error(error.message);
        const { data: pubData } = supabase.storage.from('documents').getPublicUrl(fileName);
        return { url: pubData.publicUrl };
    },
    uploadFile: async (file: File) => {
        // Documents stored in the 'documents' bucket under docs/ subfolder
        const ext = file.name.split('.').pop();
        const fileName = `docs/${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(fileName, file);
        handleSupabaseEvent(null, error, 'File Upload');
        const { data: pubData } = supabase.storage.from('documents').getPublicUrl(fileName);
        return { url: pubData.publicUrl };
    },

    // ── MESSAGING ────────────────────────────────────────────────────────────
    /** Find or create a 1-to-1 conversation between two users */
    getOrCreateConversation: async (myId: string, otherId: string): Promise<string> => {
        // Find existing conversation where both users are participants
        const { data: myConvs } = await supabase
            .from('conversation_participants')
            .select('conversationId')
            .eq('userId', myId);

        if (myConvs && myConvs.length > 0) {
            const myConvIds = myConvs.map((r: any) => r.conversationId);
            const { data: shared } = await supabase
                .from('conversation_participants')
                .select('conversationId')
                .eq('userId', otherId)
                .in('conversationId', myConvIds);

            if (shared && shared.length > 0) {
                return shared[0].conversationId;
            }
        }

        // Create new conversation
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .insert({})
            .select()
            .single();
        if (convError) throw new Error(convError.message);

        // Add both participants
        const { error: partError } = await supabase.from('conversation_participants').insert([
            { conversationId: conv.id, userId: myId },
            { conversationId: conv.id, userId: otherId },
        ]);
        if (partError) throw new Error(partError.message);

        return conv.id;
    },

    /** Get all conversations for a user, with last message and unread count */
    getConversations: async (myId: string) => {
        const { data: parts, error } = await supabase
            .from('conversation_participants')
            .select('conversationId')
            .eq('userId', myId);

        if (error) {
            console.error('[Chat] getConversations error (check RLS policies):', error.message);
            return [];
        }
        if (!parts || parts.length === 0) return [];

        const convIds = parts.map((p: any) => p.conversationId);

        // Get all other participants (their userId only)
        const { data: otherParts, error: otherErr } = await supabase
            .from('conversation_participants')
            .select('conversationId, userId')
            .in('conversationId', convIds)
            .neq('userId', myId);

        if (otherErr) console.error('[Chat] otherParts error:', otherErr.message);

        // Collect unique other userIds and fetch employee data in one query
        const otherUserIds = Array.from(new Set((otherParts || []).map((p: any) => p.userId)));
        let employeeMap: Record<string, any> = {};

        if (otherUserIds.length > 0) {
            const { data: emps } = await supabase
                .from('employees')
                .select('*')
                .in('id', otherUserIds);
            (emps || []).forEach((e: any) => { employeeMap[e.id] = e; });
        }

        // Get last message per conversation
        const results = await Promise.all(
            convIds.map(async (convId: string) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversationId', convId)
                    .order('createdAt', { ascending: false })
                    .limit(1);

                const { count: unread } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversationId', convId)
                    .neq('senderId', myId)
                    .neq('status', 'seen');

                const other = (otherParts || []).find((p: any) => p.conversationId === convId);
                const otherEmployee = other ? employeeMap[other.userId] : null;

                return {
                    conversationId: convId,
                    otherUser: otherEmployee || null,
                    lastMessage: msgs?.[0] || null,
                    unreadCount: unread || 0,
                };
            })
        );

        // Sort by latest message timestamp, admin pinned first
        return results.sort((a, b) => {
            const aIsAdmin = (a.otherUser as any)?.roleId?.toUpperCase() === 'ADMIN';
            const bIsAdmin = (b.otherUser as any)?.roleId?.toUpperCase() === 'ADMIN';
            if (aIsAdmin && !bIsAdmin) return -1;
            if (!aIsAdmin && bIsAdmin) return 1;
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });
    },

    /** Get messages for a conversation (newest last) */
    getMessages: async (conversationId: string, limit = 60): Promise<any[]> => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversationId', conversationId)
            .order('createdAt', { ascending: true })
            .limit(limit);
        if (error) throw new Error(error.message);
        return data || [];
    },

    /** Send a message */
    sendMessage: async (payload: {
        conversationId: string;
        senderId: string;
        content?: string;
        type?: 'text' | 'image';
        mediaUrl?: string;
        taskRef?: any;
    }): Promise<any> => {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                conversationId: payload.conversationId,
                senderId: payload.senderId,
                content: payload.content || null,
                type: payload.type || 'text',
                mediaUrl: payload.mediaUrl || null,
                taskRef: payload.taskRef || null,
                status: 'sent',
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    /** Mark all unread messages in a conversation as 'seen' */
    markMessagesRead: async (conversationId: string, myId: string): Promise<void> => {
        await supabase
            .from('messages')
            .update({ status: 'seen' })
            .eq('conversationId', conversationId)
            .neq('senderId', myId)
            .neq('status', 'seen');
    },

    /** Upsert typing status */
    setTypingStatus: async (userId: string, conversationId: string, isTyping: boolean): Promise<void> => {
        await supabase
            .from('typing_status')
            .upsert({ userId, conversationId, isTyping, updatedAt: new Date().toISOString() }, {
                onConflict: 'userId,conversationId',
            });
    },

    /** Upload image to chat-media bucket */
    uploadChatMedia: async (file: File): Promise<{ url: string }> => {
        const ext = file.name.split('.').pop();
        const fileName = `chat/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const { error } = await supabase.storage.from('chat-media').upload(fileName, file, { upsert: false });
        if (error) throw new Error(error.message);
        const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(fileName);
        return { url: pub.publicUrl };
    },

    /** Get total unread count for a user (for sidebar badge) */
    getUnreadCount: async (myId: string): Promise<number> => {
        // Get all conversations the user belongs to
        const { data: parts } = await supabase
            .from('conversation_participants')
            .select('conversationId')
            .eq('userId', myId);
        if (!parts || parts.length === 0) return 0;
        const convIds = parts.map((p: any) => p.conversationId);
        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('conversationId', convIds)
            .neq('senderId', myId)
            .neq('status', 'seen');
        return count || 0;
    },

    // Legacy compat
    getMyChats: async (myId: string) => {
        return api.getConversations(myId);
    },
    sendChatMessage: async (payload: { receiverId: string; content: string }, senderId: string) => {
        const convId = await api.getOrCreateConversation(senderId, payload.receiverId);
        return api.sendMessage({ conversationId: convId, senderId, content: payload.content });
    },
    getAdminChats: async () => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(100);
        return data || [];
    },
};
