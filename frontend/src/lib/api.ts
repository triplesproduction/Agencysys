import { logger } from '@/lib/logger';
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
    KpiAuditLogDTO,
    ProjectDTO,
    ProjectMemberDTO,
    HolidayDTO,
    AttendanceOverrideDTO
} from '../types/dto';
import { supabase } from './supabase';

const handleSupabaseEvent = (data: any, error: any, context: string) => {
    // Standardized high-fidelity logging for all system events
    // logger.log(`[DB TRACE] ${context}:`, { data, error });

    if (error) {
        logger.error(`Supabase Error (${context}):`, error);
        throw new Error(error.message || `An error occurred during ${context}`);
    }
};

const normalizeEmployee = (emp: any): EmployeeDTO => ({
    ...emp,
    firstName: emp.firstName || emp.first_name || 'Unknown',
    lastName: emp.lastName || emp.last_name || '',
    profilePhoto: emp.profilePhoto || emp.profile_photo,
    roleId: emp.roleId || emp.role_id || 'EMPLOYEE',
    designation: emp.designation || emp.design_ation || emp.roleId || 'Staff',
    status: emp.status || 'ACTIVE',
    department: emp.department || 'General'
});

export const api = {
    // Employees
    getEmployeeStats: async () => {
        // Optimization: Use count query instead of fetching all rows to get counts
        const { count: total, error: totalError } = await supabase.from('employees').select('*', { count: 'exact', head: true })
            .neq('roleId', 'ADMIN');
        const { count: active, error: activeError } = await supabase.from('employees').select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE').neq('roleId', 'ADMIN');
        
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
            query = query.neq('roleId', 'ADMIN');
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
        // logger.log('[API] Create Employee Payload:', data);
        const { data: res, error } = await supabase.from('employees').insert(data).select().single();
        handleSupabaseEvent(res, error, 'Create Employee');
        // logger.log('[API] Create Employee Response:', res);
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
        // logger.log(`[API] Update Employee (${id}) Payload:`, data);
        
        // Database uses camelCase (profilePhoto), so no mapping to snake_case is needed
        const mappedData = { ...data };

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
            logger.error('[API] updateEmployee Supabase error:', error);
            throw new Error(error.message || 'Failed to update employee');
        }

        // logger.log('[API] updateEmployee Response (rows):', rows);
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

    verifyAdminPassword: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Verification failed: Invalid admin password.');
        return !!data.user;
    },

    // --- Salary & Payroll ---
    addSalaryHike: async (employeeId: string, amount: number, effectiveDate: string, reason: string) => {
        // Fetch current baseSalary
        const { data: emp, error: fetchError } = await supabase.from('employees').select('baseSalary, base_salary').eq('id', employeeId).single();
        if (fetchError) throw fetchError;
        const currentSalary = emp.baseSalary || (emp as any).base_salary || 0;
        const newSalary = currentSalary + amount;

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
            .update({ baseSalary: newSalary })
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
                employeeid: record.employeeId,
                month: record.month,
                year: record.year,
                basesalary: record.baseSalary,
                deductions: record.deductions,
                netpayable: record.netPayable,
                workingdays: record.workingDays,
                dayspresent: record.daysPresent,
                approvedleaves: record.approvedLeaves,
                unpaidabsences: record.unpaidAbsences,
                bonus: record.bonus || 0,
                travel_expenses: record.travelExpenses || 0,
                adjustments_note: record.adjustmentsNote || '',
                formula: record.formula,
                status: record.status
            }, { onConflict: 'employeeid,month,year' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Tasks
    getTasks: async (assigneeId?: string, status?: string, limit: number = 20, projectId?: string) => {
        let query = supabase.from('tasks').select('*, assignee:employees!assigneeId(id, firstName, lastName, profilePhoto)');
        if (assigneeId) query = query.eq('assigneeId', assigneeId);
        if (status) query = query.eq('status', status);
        if (projectId) query = query.eq('projectId', projectId);
        
        const { data, error } = await query
            .order('createdAt', { ascending: false })
            .limit(limit);

        handleSupabaseEvent(data, error, 'Fetch Tasks');
        
        // Normalize with architect defaults
        return (data || []).map((task: any) => {
            let assigneeIds = task.assigneeIds || [];
            if (task.assigneeId && assigneeIds.length === 0) {
                assigneeIds = [task.assigneeId];
            }

            return {
                ...task,
                status: task.status || 'TODO',
                priority: task.priority || 'MEDIUM',
                title: task.title || 'Untitled Task',
                dueDate: task.dueDate || new Date().toISOString(),
                assigneeIds: Array.from(new Set(assigneeIds)) // Dedupe
            };
        }) as TaskDTO[];
    },
    createTask: async (payload: Partial<TaskDTO>) => {
        const data = { ...payload };
        
        if (data.assigneeIds && data.assigneeIds.length > 0 && !data.assigneeId) {
            data.assigneeId = data.assigneeIds[0];
        }

        // Strict whitelist to prevent Supabase schema cache errors
        const whitelist = ['title', 'description', 'status', 'priority', 'assigneeId', 'assigneeIds', 'dueDate', 'attachments', 'creatorId', 'projectId'];
        const dbPayload: any = {};
        Object.keys(data).forEach(key => {
            if (whitelist.includes(key) && (data as any)[key] !== undefined) {
                dbPayload[key] = (data as any)[key];
            }
        });

        if (process.env.NODE_ENV === 'development') {
            console.log('[API] Creating task with payload:', dbPayload);
        }

        const { data: res, error } = await supabase.from('tasks')
            .insert(dbPayload)
            .select('id, title, description, status, priority, assigneeId, assigneeIds, dueDate, attachments, creatorId, projectId, createdAt')
            .single();
            
        handleSupabaseEvent(res, error, 'Create Task');
        return { ...payload, ...res } as TaskDTO;
    },

    updateTaskStatus: async (id: string, status: string) => {
        const { data, error } = await supabase.from('tasks').update({ status }).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Task Status');
        return data as TaskDTO;
    },
    updateTask: async (id: string, payload: Partial<TaskDTO>) => {
        const data = { ...payload };

        if (data.assigneeIds && data.assigneeIds.length > 0) {
            data.assigneeId = data.assigneeIds[0];
        }

        // Strict whitelist to prevent Supabase schema cache errors
        const whitelist = ['title', 'description', 'status', 'priority', 'assigneeId', 'assigneeIds', 'dueDate', 'attachments', 'creatorId', 'quality_rating', 'projectId'];
        const dbPayload: any = {};
        Object.keys(data).forEach(key => {
            if (whitelist.includes(key) && (data as any)[key] !== undefined) {
                dbPayload[key] = (data as any)[key];
            }
        });

        if (process.env.NODE_ENV === 'development') {
            console.log(`[API] Updating task ${id} with payload:`, dbPayload);
        }

        const { data: res, error } = await supabase.from('tasks')
            .update(dbPayload)
            .eq('id', id)
            .select('id, title, description, status, priority, assigneeId, assigneeIds, dueDate, attachments, creatorId, projectId, quality_rating, createdAt')
            .single();

        handleSupabaseEvent(res, error, 'Update Task');
        return { ...payload, ...res } as TaskDTO;
    },

    deleteTask: async (id: string) => {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Task');
        return { success: true };
    },

    // EOD
    submitEOD: async (payload: Partial<EODSubmissionDTO>) => {
        const data = { ...payload };
        
        // Whitelist mapping for eod_reports table
        const dbPayload: any = {
            employeeId: data.employeeId,
            reportDate: data.reportDate,
            tasksCompleted: data.tasksCompleted || [],
            tasksInProgress: data.tasksInProgress || [],
            completedText: (data as any).completedText || null,
            blockers: data.blockers,
            sentiment: data.sentiment || 'GOOD',
            status: data.status || 'SUBMITTED',
            work_hours: data.workHours
        };

        const insertPromise = supabase.from('eod_reports')
            .insert(dbPayload)
            .select('id, employeeId, reportDate, tasksCompleted, tasksInProgress, completedText, blockers, sentiment, status, work_hours')
            .single();

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('submitEOD timed out. Verify your database columns.')), 10000)
        );

        const { data: res, error } = await Promise.race([insertPromise, timeoutPromise]) as any;
        
        handleSupabaseEvent(res, error, 'Submit EOD');
        
        if (res) {
            (res as any).workHours = (res as any).work_hours;
        }
        
        return res as unknown as EODSubmissionDTO;
    },
    updateEOD: async (id: string, payload: Partial<EODSubmissionDTO>) => {
        const data = { ...payload };

        // Whitelist mapping for eod_reports table
        const dbPayload: any = {
            employeeId: data.employeeId,
            reportDate: data.reportDate,
            tasksCompleted: data.tasksCompleted,
            tasksInProgress: data.tasksInProgress,
            completedText: (data as any).completedText,
            inProgressText: (data as any).inProgressText,
            blockers: data.blockers,
            sentiment: data.sentiment,
            status: data.status,
            work_hours: data.workHours
        };

        const { data: res, error } = await supabase.from('eod_reports').update(dbPayload).eq('id', id).select('id, employeeId, reportDate, tasksCompleted, tasksInProgress, completedText, inProgressText, blockers, sentiment, status, work_hours').single();
        
        handleSupabaseEvent(res, error, 'Update EOD');

        if (res) {
            (res as any).workHours = (res as any).work_hours;
        }

        return res as unknown as EODSubmissionDTO;
    },
    getMyEODs: async (userId: string) => {
        if (!userId) throw new Error('Not authenticated');
        
        // Use the actual columns found in the DB (tasksCompleted/InProgress are arrays)
        const { data, error } = await supabase.from('eod_reports').select('*').eq('employeeId', userId).order('reportDate', { ascending: false }).order('createdAt', { ascending: false });
        
        handleSupabaseEvent(data, error, 'Fetch My EODs');
        
        // Normalize with architect defaults
        return (data || []).map((report: any) => ({
            ...report,
            sentiment: report.sentiment || 'OKAY',
            tasksCompleted: report.tasksCompleted || [],
            tasksInProgress: report.tasksInProgress || [],
            workHours: report.workHours || (report as any).work_hours || 0
        })) as EODSubmissionDTO[];
    },
    getAllEODs: async (options?: { limit?: number; startDate?: string; endDate?: string; employeeId?: string }) => {
        let query = supabase
            .from('eod_reports')
            .select('*, employee:employees!employeeId(id, firstName, lastName, profilePhoto, department, roleId)');

        if (options?.startDate) query = query.gte('reportDate', options.startDate);
        if (options?.endDate) query = query.lte('reportDate', options.endDate);
        if (options?.employeeId) query = query.eq('employeeId', options.employeeId);

        query = query.order('reportDate', { ascending: false }).order('createdAt', { ascending: false });

        if (options?.limit) query = query.limit(options.limit);

        const { data, error } = await query;

        handleSupabaseEvent(data, error, 'Fetch All EODs');
        
        // Normalize with architect defaults
        return (data || []).map((report: any) => ({
            ...report,
            sentiment: report.sentiment || 'OKAY',
            tasksCompleted: report.tasksCompleted || [],
            tasksInProgress: report.tasksInProgress || [],
            workHours: report.workHours || (report as any).work_hours || 0
        }));
    },
    getWorkHoursInRange: async (startDate: string, endDate: string, employeeId?: string) => {
        let query = supabase.from('work_hours').select('*').gte('date', startDate).lte('date', endDate);
        if (employeeId) query = query.eq('employeeId', employeeId);
        
        const { data, error } = await query;
        handleSupabaseEvent(data, error, 'Fetch Work Hours In Range');
        return data || [];
    },
    updateEODSentiment: async (id: string, sentiment: string) => {
        const { data, error } = await supabase.from('eod_reports').update({ sentiment }).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Sentiment');
        return data as any;
    },
    reviewEOD: async (id: string, payload: { employeeId: string; date: string; workHours: number; adminNote?: string; status: string }) => {
        // 1. Update the EOD Report status and note
        if (id) {
            const { error: updateError } = await supabase.from('eod_reports')
                .update({ 
                    status: payload.status
                })
                .eq('id', id);
            
            if (updateError) {
                logger.error('Error updating EOD report status:', updateError);
                handleSupabaseEvent(null, updateError, 'Update EOD Report Status');
            }
        }

        // 2. Sync with work hour log
        // Also sync to work_hours table
        const { data: logs, error: selectError } = await supabase.from('work_hours').select('*').eq('employeeId', payload.employeeId).eq('date', payload.date);
        
        if (selectError) {
            logger.error('[API] Error fetching work hours for sync:', selectError.message);
        }

        if (logs && logs.length > 0) {
            // Update the first log found for that date
            const note = payload.adminNote ? ` [Note: ${payload.adminNote}]` : '';
            const statusStr = payload.status ? ` [Status: ${payload.status}]` : '';
            const { data, error } = await supabase.from('work_hours')
                .update({ 
                    hoursLogged: payload.workHours, 
                    description: `Synced from EOD on ${new Date().toLocaleDateString()}.${note}${statusStr}` 
                })
                .eq('id', logs[0].id)
                .select().single();
            handleSupabaseEvent(data, error, 'Update Work Hours via Review');
            return data;
        } else {
            // Create new
            const note = payload.adminNote ? ` [Note: ${payload.adminNote}]` : '';
            const statusStr = payload.status ? ` [Status: ${payload.status}]` : '';
            const { data, error } = await supabase.from('work_hours').insert({
                employeeId: payload.employeeId,
                date: payload.date,
                hoursLogged: payload.workHours,
                description: `EOD Submission Sync on ${new Date().toLocaleDateString()}.${note}${statusStr}`
            }).select().single();
            handleSupabaseEvent(data, error, 'Create Work Hours via Review');
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
        const insertPromise = supabase.from('work_hours').insert(data).select().single();
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('logWorkHours timed out. Verify your database columns.')), 10000)
        );
        const { data: res, error } = await Promise.race([insertPromise, timeoutPromise]) as any;
        handleSupabaseEvent(res, error, 'Log Work Hours');
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
        
        const { data, error } = await supabase.from('leaves').select('*').eq('employeeId', userId).order('createdAt', { ascending: false });
        
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

    // --- Attendance & Holidays ---
    getHolidays: async (year?: number) => {
        let query = supabase.from('holidays').select('*');
        if (year) {
            query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
        }
        const { data, error } = await query.order('date', { ascending: true });
        handleSupabaseEvent(data, error, 'Fetch Holidays');
        return (data || []) as HolidayDTO[];
    },
    addHoliday: async (holiday: Partial<HolidayDTO>) => {
        const { data, error } = await supabase.from('holidays').insert(holiday).select().single();
        handleSupabaseEvent(data, error, 'Add Holiday');
        return data as HolidayDTO;
    },
    deleteHoliday: async (id: string) => {
        const { error } = await supabase.from('holidays').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Holiday');
    },
    getAttendanceOverrides: async (employeeId: string, monthYear: string) => {
        const date = new Date(monthYear + '-01');
        const startOfMonth = `${monthYear}-01`;
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_overrides')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('date', startOfMonth)
            .lte('date', endOfMonth);
        handleSupabaseEvent(data, error, 'Fetch Attendance Overrides');
        return (data || []) as AttendanceOverrideDTO[];
    },
    setAttendanceOverride: async (override: Partial<AttendanceOverrideDTO>) => {
        const { data, error } = await supabase.from('attendance_overrides').upsert(override).select().single();
        handleSupabaseEvent(data, error, 'Set Attendance Override');
        return data as AttendanceOverrideDTO;
    },
    getAttendanceReport: async (employeeId: string, monthYear: string) => {
        const date = new Date(monthYear + '-01');
        const startOfMonth = `${monthYear}-01`;
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

        const [eods, leaves, holidays, overrides] = await Promise.all([
            supabase.from('eod_reports').select('*').eq('employeeId', employeeId).gte('reportDate', startOfMonth).lte('reportDate', endOfMonth),
            supabase.from('leaves').select('*').eq('employeeId', employeeId).eq('status', 'APPROVED').or(`startDate.lte.${endOfMonth},endDate.gte.${startOfMonth}`),
            supabase.from('holidays').select('*').gte('date', startOfMonth).lte('date', endOfMonth),
            supabase.from('attendance_overrides').select('*').eq('employee_id', employeeId).gte('date', startOfMonth).lte('date', endOfMonth)
        ]);

        return {
            eods: (eods.data || []) as EODSubmissionDTO[],
            leaves: (leaves.data || []) as LeaveApplicationDTO[],
            holidays: (holidays.data || []) as HolidayDTO[],
            overrides: (overrides.data || []) as AttendanceOverrideDTO[]
        };
    },

    // KPIs
    getEmployeeKPIs: async (employeeId: string) => {
        // Fallback or legacy, returning old if needed, but primary is getKpiProfile now
        const { data, error } = await supabase.from('kpi_metrics').select('*').eq('employeeId', employeeId).order('lastUpdated', { ascending: false });
        if (error) logger.warn('Missing old metrics:', error);
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
    recalculateKpiProfile: async (employeeId: string, monthYear: string) => {
        const { error } = await supabase.rpc('recalculate_kpi_profile', {
            p_employee_id: employeeId,
            p_month_year: monthYear
        });
        handleSupabaseEvent(null, error, 'Recalculate KPI Profile');
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
        const now = new Date();
        const year = monthYear ? parseInt(monthYear.split('-')[0]) : now.getFullYear();
        const month = monthYear ? parseInt(monthYear.split('-')[1]) - 1 : now.getMonth();
        
        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const nextMonthYear = month === 11 ? year + 1 : year;
        const nextMonth = month === 11 ? 0 : month + 1;
        const startOfNextMonth = new Date(nextMonthYear, nextMonth, 1).toISOString().split('T')[0];

        // 1. Fetch from work_hours and eod_reports
        try {
            const [{ data: workHoursData }, { data: eodData }] = await Promise.all([
                supabase.from('work_hours').select('*').eq('employeeId', employeeId).gte('date', startOfMonth).lt('date', startOfNextMonth),
                supabase.from('eod_reports').select('*').eq('employeeId', employeeId).gte('reportDate', startOfMonth).lt('reportDate', startOfNextMonth)
            ]);
            
            // 2. Aggregate by date to prevent double-counting (taking the max of either for that day)
            const dailyHours: Record<string, number> = {};

            (workHoursData || []).forEach((row: any) => {
                const d = row.date;
                const h = parseFloat(row.hoursLogged || (row as any).hours_logged) || 0;
                if (d) dailyHours[d] = Math.max(dailyHours[d] || 0, h);
            });

            (eodData || []).forEach((row: any) => {
                const d = row.reportDate || (row as any).report_date;
                const h = parseFloat(row.workHours || (row as any).work_hours) || 0;
                if (d) dailyHours[d] = Math.max(dailyHours[d] || 0, h);
            });

            const total = Object.values(dailyHours).reduce((acc, h) => acc + h, 0);
            return total;
        } catch (err) {
            logger.error('[API] getMonthlyWorkHours failure:', err);
            return 0;
        }
    },
    getAllKpiProfiles: async (monthYear?: string, limit: number = 10) => {
        const queryMonth = monthYear || new Date().toISOString().substring(0, 7);
        const { data, error } = await supabase
            .from('kpi_profiles')
            .select('*, employee:employees!employee_id(*)')
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
            .select('*, employee:employees!employee_id(*)')
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
    createAnnouncement: async (data: { title: string; message: string; priority?: string; channel?: string; type?: string, authorId?: string }) => {
        const payload = {
            ...data,
            status: 'active',
            type: data.type || (data.priority?.toUpperCase() === 'CRITICAL' ? 'URGENT' : 'ANNOUNCEMENT'),
            createdAt: new Date().toISOString()
        };
        const { data: res, error } = await supabase.from('announcements').insert(payload).select().single();
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
                logger.warn('Could not delete old profile photo:', delErr);
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
        // Documents stored in the 'private-docs' bucket
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const { error } = await supabase.storage.from('private-docs').upload(fileName, file);
        handleSupabaseEvent(null, error, 'File Upload');
        return { url: fileName };
    },

    /** Find or create a 1-to-1 conversation between two users */
    getOrCreateConversation: async (myId: string, otherId: string): Promise<string> => {
        // Find existing conversation where both users are participants
        const { data: myConvs } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', myId);

        if (myConvs && myConvs.length > 0) {
            const myConvIds = myConvs.map((r: any) => r.conversation_id);
            const { data: shared } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', otherId)
                .in('conversation_id', myConvIds);

            if (shared && shared.length > 0) {
                return shared[0].conversation_id;
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
            { conversation_id: conv.id, user_id: myId },
            { conversation_id: conv.id, user_id: otherId },
        ]);
        if (partError) throw new Error(partError.message);

        return conv.id;
    },

    /** Get all conversations for a user, with last message and unread count */
    getConversations: async (myId: string, role?: string) => {
        logger.log('[Chat] getConversations called, myId:', myId);

        let convIds: string[] = [];

        const { data: parts, error } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', myId);
            
        if (error) {
            logger.error('[Chat] getConversations error (check RLS policies):', error.message);
            return [];
        }
        if (!parts || parts.length === 0) return [];
        convIds = parts.map((p: any) => p.conversation_id);
        if (convIds.length === 0) return [];

        // 1. Get all other participants (their userId only)
        const { data: otherParts, error: otherErr } = await supabase
            .from('conversation_participants')
            .select('conversation_id, user_id')
            .in('conversation_id', convIds)
            .neq('user_id', myId);

        if (otherErr) logger.error('[Chat] otherParts error:', otherErr.message);

        // Collect unique other userIds and fetch employee data
        const otherUserIds = Array.from(new Set((otherParts || []).map((p: any) => p.user_id)));
        let employeeMap: Record<string, any> = {};
        if (otherUserIds.length > 0) {
            const { data: emps } = await supabase
                .from('employees')
                .select('id, firstName, lastName, profilePhoto, designation, roleId')
                .in('id', otherUserIds);
            (emps || []).forEach((e: any) => { employeeMap[e.id] = e; });
        }

        // 2. Fetch the LATEST message for each conversation
        // We do this by fetching the latest message per convId
        // In Supabase, we can use a query that gets the last message for each conv
        const { data: latestMsgs } = await supabase
            .from('messages')
            .select('*')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false })
            .limit(200);

        // Map latest message per conversation
        const lastMessageMap: Record<string, any> = {};
        (latestMsgs || []).forEach((m: any) => {
            if (!lastMessageMap[m.conversation_id]) {
                lastMessageMap[m.conversation_id] = m;
            }
        });

        // 3. Get unread counts for all conversations
        const { data: unreadMsgs } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .neq('sender_id', myId)
            .neq('status', 'seen');

        const unreadCounts: Record<string, number> = {};
        (unreadMsgs || []).forEach((m: any) => {
            unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1;
        });

        // 4. Assemble results for ALL convIds
        const results = convIds.map((convId: string) => {
            const other = (otherParts || []).find((p: any) => p.conversation_id === convId);
            const otherEmployee = other ? employeeMap[other.user_id] : null;

            return {
                conversationId: convId,
                otherUser: otherEmployee ? {
                    id: otherEmployee.id,
                    firstName: otherEmployee.firstName,
                    lastName: otherEmployee.lastName,
                    profilePhoto: otherEmployee.profilePhoto,
                    designation: otherEmployee.designation,
                    roleId: otherEmployee.roleId
                } : null,
                lastMessage: lastMessageMap[convId] ? {
                    id: lastMessageMap[convId].id,
                    content: lastMessageMap[convId].content,
                    type: lastMessageMap[convId].type,
                    createdAt: lastMessageMap[convId].created_at,
                    senderId: lastMessageMap[convId].sender_id
                } : null,
                unreadCount: unreadCounts[convId] || 0,
            };
        });

        // Sort by latest message timestamp
        return results.sort((a, b) => {
            const aIsAdmin = String((a.otherUser as any)?.roleId || '').toUpperCase() === 'ADMIN';
            const bIsAdmin = String((b.otherUser as any)?.roleId || '').toUpperCase() === 'ADMIN';
            if (aIsAdmin && !bIsAdmin) return -1;
            if (!aIsAdmin && bIsAdmin) return 1;
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });
    },

    /** Get messages for a conversation (newest last, with sender name) */
    getMessages: async (conversationId: string, limit = 50): Promise<any[]> => {
        logger.log('[Chat] getMessages for conv:', conversationId, 'limit:', limit);
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false }) // Get LATEST first
            .limit(limit);

        if (error) {
            logger.error('[Chat] getMessages error:', error.message);
            return [];
        }

        const messages = (data || []).reverse(); // Reverse so they are chronological for UI

        // Enrich messages with sender names
        const senderIds = Array.from(new Set(messages.map((m: any) => m.sender_id)));
        if (senderIds.length > 0) {
            const { data: emps } = await supabase
                .from('employees')
                .select('id, firstName, lastName, profilePhoto')
                .in('id', senderIds);
            
            const empMap: Record<string, any> = {};
            (emps || []).forEach(e => empMap[e.id] = e);

            return messages.map((m: any) => ({
                id: m.id,
                content: m.content,
                type: m.type,
                createdAt: m.created_at,
                senderId: m.sender_id,
                status: m.status,
                senderName: empMap[m.sender_id] ? `${empMap[m.sender_id].firstName} ${empMap[m.sender_id].lastName}` : 'System',
                senderPhoto: empMap[m.sender_id]?.profilePhoto,
                taskId: m.task_id
            }));
        }

        return messages.map((m: any) => ({
            id: m.id,
            content: m.content,
            type: m.type,
            createdAt: m.created_at,
            senderId: m.sender_id,
            status: m.status,
            taskId: m.task_id
        }));
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
                conversation_id: payload.conversationId,
                sender_id: payload.senderId,
                content: payload.content || null,
                type: payload.type || 'text',
                media_url: payload.mediaUrl || null,
                task_ref: payload.taskRef || null,
                status: 'sent'
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return {
            ...data,
            createdAt: data.created_at,
            senderId: data.sender_id
        };
    },

    /** Mark all unread messages in a conversation as 'seen' */
    markMessagesRead: async (conversationId: string, myId: string): Promise<void> => {
        await supabase
            .from('messages')
            .update({ status: 'seen' })
            .eq('conversation_id', conversationId)
            .neq('sender_id', myId)
            .neq('status', 'seen');
        
        // Notify other components (like Sidebar) to refresh unread count
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('messagesMarkedRead'));
        }
    },

    /** Upsert typing status */
    setTypingStatus: async (userId: string, conversationId: string, isTyping: boolean): Promise<void> => {
        await supabase
            .from('typing_status')
            .upsert({ 
                user_id: userId, 
                conversation_id: conversationId, 
                is_typing: isTyping, 
                updated_at: new Date().toISOString() 
            }, {
                onConflict: 'user_id,conversation_id',
            });
    },

    /** Upload image to chat-media bucket */
    uploadChatMedia: async (file: File): Promise<{ url: string }> => {
        const ext = file.name.split('.').pop();
        const fileName = `chat/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        logger.log('[Chat] uploadChatMedia: uploading', fileName, 'size:', file.size);
        const { error } = await supabase.storage.from('chat-media').upload(fileName, file, { upsert: false });
        if (error) {
            logger.error('[Chat] uploadChatMedia FAILED:', error.message);
            throw new Error(`Image upload failed: ${error.message}. Ensure the 'chat-media' bucket exists in Supabase Storage with public access.`);
        }
        const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(fileName);
        logger.log('[Chat] uploadChatMedia SUCCESS. URL:', pub.publicUrl);
        return { url: pub.publicUrl };
    },

    /** Get total unread count for a user (for sidebar badge) */
    /** Count of distinct conversations (not total messages) that have unread messages */
    getUnreadCount: async (myId: string): Promise<number> => {
        // Get all conversations the user belongs to
        const { data: parts } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', myId);
        if (!parts || parts.length === 0) return 0;
        const convIds = parts.map((p: any) => p.conversation_id);

        // Fetch all unread messages and count distinct conversation_ids
        const { data: unreadMsgs } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .neq('sender_id', myId)
            .neq('status', 'seen');

        if (!unreadMsgs || unreadMsgs.length === 0) return 0;

        // Count distinct conversations (not individual messages)
        const distinctConvs = new Set(unreadMsgs.map((m: any) => m.conversation_id));
        return distinctConvs.size;
    },

    sendChatMessage: async (payload: { receiverId: string; content: string }, senderId: string) => {
        const convId = await api.getOrCreateConversation(senderId, payload.receiverId);
        return api.sendMessage({ conversationId: convId, senderId, content: payload.content });
    },

    // --- Projects ---
    getProjects: async (userId?: string) => {
        let query = supabase.from('projects').select(`
            *,
            members:project_members(
                *,
                user:employees!fk_project_members_user(id, firstName, lastName, profilePhoto)
            )
        `);
        
        if (userId) {
            // Filter by projects where the user is a member
            const { data: memberProjects } = await supabase
                .from('project_members')
                .select('projectId')
                .eq('userId', userId);
            
            const projectIds = (memberProjects || []).map(m => m.projectId);
            if (projectIds.length === 0) return [];
            query = query.in('id', projectIds);
        }

        const { data, error } = await query.order('createdAt', { ascending: false });
        handleSupabaseEvent(data, error, 'Fetch Projects');
        return data as ProjectDTO[];
    },

    getProjectById: async (id: string) => {
        const { data, error } = await supabase
            .from('projects')
            .select(`
                *,
                members:project_members(
                    *,
                    user:employees!fk_project_members_user(id, firstName, lastName, profilePhoto)
                ),
                tasks:tasks(*)
            `)
            .eq('id', id)
            .single();
        
        handleSupabaseEvent(data, error, 'Fetch Project Detail');
        return data as ProjectDTO;
    },

    createProject: async (payload: Partial<ProjectDTO>) => {
        const { data, error } = await supabase.from('projects').insert(payload).select().single();
        handleSupabaseEvent(data, error, 'Create Project');
        return data as ProjectDTO;
    },

    updateProject: async (id: string, payload: Partial<ProjectDTO>) => {
        const { data, error } = await supabase.from('projects').update(payload).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Project');
        return data as ProjectDTO;
    },

    deleteProject: async (id: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Project');
        return { success: true };
    },

    addProjectMember: async (projectId: string, userId: string, role: string = 'MEMBER') => {
        const { data, error } = await supabase.from('project_members').insert({ projectId, userId, role }).select().single();
        handleSupabaseEvent(data, error, 'Add Project Member');
        return data as ProjectMemberDTO;
    },

    removeProjectMember: async (id: string) => {
        const { error } = await supabase.from('project_members').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Remove Project Member');
        return { success: true };
    },

    // Work Sessions (Shift Tracker)
    clockIn: async (employeeId: string) => {
        try {
            const { data, error } = await supabase
                .from('work_sessions')
                .insert({ employeeId, startTime: new Date().toISOString(), status: 'ACTIVE' })
                .select()
                .single();
            if (error) {
                // Graceful degradation if table doesn't exist yet — clock still works via localStorage
                logger.warn('[WorkClock] work_sessions table unavailable, using local fallback:', error.message);
                return { id: null, local: true };
            }
            return data;
        } catch (err) {
            logger.warn('[WorkClock] clockIn failed gracefully:', err);
            return { id: null, local: true };
        }
    },

    clockOut: async (employeeId: string) => {
        try {
            const { data, error } = await supabase
                .from('work_sessions')
                .update({ endTime: new Date().toISOString(), status: 'COMPLETED' })
                .eq('employeeId', employeeId)
                .eq('status', 'ACTIVE')
                .select()
                .single();
            if (error) {
                logger.warn('[WorkClock] work_sessions table unavailable, using local fallback:', error.message);
                return { id: null, local: true };
            }
            return data;
        } catch (err) {
            logger.warn('[WorkClock] clockOut failed gracefully:', err);
            return { id: null, local: true };
        }
    },
};
