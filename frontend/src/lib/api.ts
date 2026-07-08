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
    AttendanceOverrideDTO,
    NoteDTO,
    BoardDTO
} from '../types/dto';
import { supabase } from './supabase';
// Simple upload rate limiter state
let uploadHistory: number[] = [];
const UPLOAD_RATE_LIMIT_MS = 10000; // 10 seconds
const UPLOAD_RATE_MAX = 5;

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
    getEmployees: async (options?: { page?: number, limit?: number, search?: string, roleId?: string, status?: string, department?: string, sortBy?: string, excludeAdmin?: boolean, includeSuspended?: boolean }) => {
        let query = supabase.from('employees').select('*', { count: 'exact' });
        
        if (options?.search) {
            query = query.or(`firstName.ilike.%${options.search}%,lastName.ilike.%${options.search}%,email.ilike.%${options.search}%`);
        }
        if (options?.roleId) {
            query = query.eq('roleId', options.roleId);
        } 
        
        if (options?.excludeAdmin) {
            query = query.neq('roleId', 'ADMIN');
        }
        
        if (options?.status) {
            query = query.eq('status', options.status);
        } else if (!options?.includeSuspended) {
            query = query.neq('status', 'SUSPENDED');
        }
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

        if (!options?.sortBy) {
            normalizedData.sort((a, b) => {
                const statusOrder = (s: string) => {
                    switch (s?.toUpperCase()) {
                        case 'ACTIVE': return 0;
                        case 'ON_LEAVE': return 1;
                        case 'SUSPENDED': return 2;
                        case 'TERMINATED': return 3;
                        default: return 4;
                    }
                };
                const diff = statusOrder(a.status) - statusOrder(b.status);
                if (diff !== 0) return diff;
                return (a.firstName || '').localeCompare(b.firstName || '');
            });
        }

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

        const { data: rows, error } = await supabase
            .from('employees')
            .update(mappedData)
            .eq('id', id)
            .select();

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
        const { data: emp, error: fetchError } = await supabase.from('employees').select('baseSalary').eq('id', employeeId).single();
        if (fetchError) throw fetchError;
        const currentSalary = emp.baseSalary || 0;
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
        if (assigneeId) query = query.or(`assigneeId.eq.${assigneeId},assigneeIds.cs.{${assigneeId}}`);
        if (status) query = query.eq('status', status);
        if (projectId) query = query.eq('projectId', projectId);
        
        const { data, error } = await query
            .order('order_index', { ascending: true })
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
    getTaskById: async (id: string): Promise<TaskDTO | null> => {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, assignee:employees!assigneeId(id, firstName, lastName, profilePhoto)')
            .eq('id', id)
            .maybeSingle();
        if (error) {
            handleSupabaseEvent(null, error, 'Fetch Task By ID');
            return null;
        }
        return data as TaskDTO | null;
    },
    createTask: async (payload: Partial<TaskDTO>) => {
        const data = { ...payload };
        
        if (data.assigneeIds && data.assigneeIds.length > 0 && !data.assigneeId) {
            data.assigneeId = data.assigneeIds[0];
        }

        // Strict whitelist to prevent Supabase schema cache errors
        const whitelist = ['title', 'description', 'status', 'priority', 'assigneeId', 'assigneeIds', 'dueDate', 'attachments', 'creatorId', 'projectId', 'order_index'];
        const dbPayload: any = {};
        Object.keys(data).forEach(key => {
            if (whitelist.includes(key) && (data as any)[key] !== undefined) {
                dbPayload[key] = (data as any)[key];
            }
        });

        logger.log('[API] Creating task with payload:', dbPayload);

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
        const whitelist = ['title', 'description', 'status', 'priority', 'assigneeId', 'assigneeIds', 'dueDate', 'attachments', 'creatorId', 'quality_rating', 'projectId', 'order_index'];
        const dbPayload: any = {};
        Object.keys(data).forEach(key => {
            if (whitelist.includes(key) && (data as any)[key] !== undefined) {
                dbPayload[key] = (data as any)[key];
            }
        });

        logger.log(`[API] Updating task ${id} with payload:`, dbPayload);

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
        
        // Limit to 60 most recent EODs — oldest records are not needed on the dashboard
        const { data, error } = await supabase.from('eod_reports').select('*').eq('employeeId', userId).order('reportDate', { ascending: false }).order('createdAt', { ascending: false }).limit(60);
        
        
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
            .select('*, employee:employees!employeeId(id, firstName, lastName, profilePhoto, department, roleId, status)');

        if (options?.startDate) query = query.gte('reportDate', options.startDate);
        if (options?.endDate) query = query.lte('reportDate', options.endDate);
        if (options?.employeeId) query = query.eq('employeeId', options.employeeId);

        query = query.order('reportDate', { ascending: false }).order('createdAt', { ascending: false });

        if (options?.limit) query = query.limit(options.limit);

        const { data, error } = await query;

        handleSupabaseEvent(data, error, 'Fetch All EODs');
        
        // Normalize with architect defaults and filter out suspended/terminated employees
        return (data || [])
            .map((report: any) => ({
                ...report,
                sentiment: report.sentiment || 'OKAY',
                tasksCompleted: report.tasksCompleted || [],
                tasksInProgress: report.tasksInProgress || [],
                workHours: report.workHours || (report as any).work_hours || 0
            }))
            .filter((report: any) => report.employee && report.employee.status === 'ACTIVE');
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
            const updatePayload: any = { status: payload.status };
            if (payload.workHours !== undefined) updatePayload.work_hours = payload.workHours;
            
            const { error: updateError } = await supabase.from('eod_reports')
                .update(updatePayload)
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
                .select().maybeSingle();
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
            }).select().maybeSingle();
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
        handleSupabaseEvent(res, error, 'Apply for Leave');
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
        
        // Normalize with architect defaults and filter out suspended/terminated employees
        return (data || [])
            .map((leave: any) => ({
                ...leave,
                status: leave.status || 'PENDING',
                leaveType: leave.leaveType || 'CASUAL',
                reason: leave.reason || 'No reason provided'
            }))
            .filter((leave: any) => leave.employee && leave.employee.status === 'ACTIVE') as LeaveApplicationDTO[];
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
            // Defensive grade mapping: the column may be returned as 'grade' or absent.
            // The DB column name is 'grade'; guard against casing edge cases.
            grade: data.grade ?? data.Grade ?? 'N/A',
            currentScore: parseFloat(String(data.current_score || 0)),
            current_score: parseFloat(String(data.current_score || 0)),
            extra_points: parseFloat(String(data.extra_points || 0)),
            total_hours_worked: parseFloat(String(data.total_hours_worked || 0)),
            bonus_points: parseFloat(String(data.bonus_points || 0)),
            average_quality_rating_sum: parseFloat(String(data.average_quality_rating_sum || 0))
        } as KpiProfileDTO;
    },
    getKpiAuditLogs: async (employeeId: string, limit: number = 25) => {
        // Using snake_case columns: employee_id, created_at
        const { data, error } = await supabase.from('kpi_audit_logs').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(limit);
        handleSupabaseEvent(data, error, 'Fetch KPI Audit Logs');
        
        return (data || []).map((log: any) => ({
            ...log,
            employeeId: log.employee_id,
            createdAt: log.created_at,
            pointsChange: parseFloat(String(log.points_change || 0)),
            points_change: parseFloat(String(log.points_change || 0)),
            eventSource: log.event_source,
            visibleScoreBefore: parseFloat(String(log.visible_score_before || 0)),
            visible_score_before: parseFloat(String(log.visible_score_before || 0)),
            visibleScoreAfter: parseFloat(String(log.visible_score_after || 0)),
            visible_score_after: parseFloat(String(log.visible_score_after || 0))
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
                if (row.status !== 'APPROVED') return;
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
            // Only select the columns actually used in the UI — avoids pulling salary/bank data via employees.*
            .select('employee_id, current_score, month_year, total_hours_worked, bonus_points, extra_points, average_quality_rating_sum, employee:employees!employee_id(id, firstName, lastName, profilePhoto, roleId, status)')
            .eq('month_year', queryMonth)
            .order('current_score', { ascending: false })
            .limit(limit);

        handleSupabaseEvent(data, error, 'Fetch All KPI Profiles');
        return (data || [])
            .map((p: any) => ({
                ...p,
                employeeId: p.employee_id,
                monthYear: p.month_year,
                currentScore: parseFloat(String(p.current_score || 0)),
                current_score: parseFloat(String(p.current_score || 0)),
                extra_points: parseFloat(String(p.extra_points || 0)),
                total_hours_worked: parseFloat(String(p.total_hours_worked || 0)),
                bonus_points: parseFloat(String(p.bonus_points || 0)),
                average_quality_rating_sum: parseFloat(String(p.average_quality_rating_sum || 0))
            }))
            .filter((p: any) => p.employee && p.employee.status === 'ACTIVE');
    },
    getAllKpiAuditLogs: async (limit: number = 10) => {
        const { data, error } = await supabase
            .from('kpi_audit_logs')
            .select('*, employee:employees!employee_id(*)')
            .order('created_at', { ascending: false })
            .limit(limit);
        handleSupabaseEvent(data, error, 'Fetch All KPI Audit Logs');
        
        return (data || [])
            .map((log: any) => ({
                ...log,
                employeeId: log.employee_id,
                createdAt: log.created_at,
                pointsChange: parseFloat(String(log.points_change || 0)),
                points_change: parseFloat(String(log.points_change || 0)),
                eventSource: log.event_source,
                visibleScoreBefore: parseFloat(String(log.visible_score_before || 0)),
                visible_score_before: parseFloat(String(log.visible_score_before || 0)),
                visibleScoreAfter: parseFloat(String(log.visible_score_after || 0)),
                visible_score_after: parseFloat(String(log.visible_score_after || 0))
            }))
            .filter((log: any) => log.employee && log.employee.status === 'ACTIVE');
    },


    deleteChatMessage: async (messageId: string, _forEveryone: boolean) => {
        const { error } = await supabase.from('messages').delete().eq('id', messageId);
        handleSupabaseEvent(null, error, 'Delete Message');
        return { success: true };
    },

    // Notifications
    broadcastNotification: async (data: { title: string; message: string; type: string; metadata?: any }) => {
        // 1. Persist to DB
        const { error } = await supabase.from('notifications').insert({ ...data, recipient_id: null, is_global: true });
        handleSupabaseEvent(data, error, 'Broadcast Notification Insert');

        // 2. Subscribe the channel first, then send, then clean up
        const channel = supabase.channel(`notify-broadcast-${Date.now()}`);
        await new Promise<void>((resolve) => {
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
            });
        });
        await channel.send({
            type: 'broadcast',
            event: 'notification',
            payload: { ...data, id: crypto.randomUUID() }
        });
        await supabase.removeChannel(channel);
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
    validateUpload: (file: File, maxSizeMB: number, allowedMimeTypes: string[]) => {
        // 1. Upload Rate Limiter (Sliding Window)
        const now = Date.now();
        uploadHistory.push(now);
        while (uploadHistory.length > 0 && uploadHistory[0] < now - UPLOAD_RATE_LIMIT_MS) {
            uploadHistory.shift();
        }
        if (uploadHistory.length > UPLOAD_RATE_MAX) {
            throw new Error(`Upload rate limit exceeded. Please wait a few seconds before trying again.`);
        }

        // 2. File Size Limit
        const sizeLimit = maxSizeMB * 1024 * 1024;
        if (file.size > sizeLimit) {
            throw new Error(`File size exceeds the ${maxSizeMB}MB limit.`);
        }
        
        // 3. MIME Type Validation
        if (!allowedMimeTypes.includes(file.type)) {
            throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
        }

        // 4. Double-Extension & Dangerous Extension Block
        const parts = file.name.split('.');
        if (parts.length > 2) {
            const secondToLast = parts[parts.length - 2].toLowerCase();
            const commonExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'doc', 'docx', 'zip', 'tar', 'gz'];
            if (commonExtensions.includes(secondToLast)) {
                throw new Error("Files with multiple extensions are blocked for security.");
            }
        }
        const ext = parts.pop()?.toLowerCase() || '';
        const dangerousExtensions = ['exe', 'sh', 'bat', 'js', 'php', 'apk', 'dmg', 'iso', 'zip', 'tar', 'gz', 'cmd', 'vbs', 'scr'];
        if (dangerousExtensions.includes(ext)) {
            throw new Error(`Dangerous file extension blocked: .${ext}`);
        }
    },
    
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

        // Validate File
        api.validateUpload(file, 2, ['image/jpeg', 'image/png', 'image/webp']);

        // Upload new photo
        const session = await supabase.auth.getSession();
        const userId = session.data.session?.user.id;
        if (!userId) throw new Error('Unauthenticated upload');

        // Sanitize extension to prevent path traversal like "foo.jpg/../../evil.sh"
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
        const fileName = `profiles/${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(fileName, file, { upsert: true });
        if (error) {
            logger.error('Upload', 'Failed avatar photo upload:', { error: error.message, fileName, size: file.size });
            throw new Error(error.message);
        }
        const { data: pubData } = supabase.storage.from('documents').getPublicUrl(fileName);
        return { url: pubData.publicUrl };
    },
    uploadFile: async (file: File) => {
        // Validate File
        api.validateUpload(file, 10, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

        const session = await supabase.auth.getSession();
        const userId = session.data.session?.user.id;
        if (!userId) throw new Error('Unauthenticated upload');

        // Sanitize extension to prevent path traversal
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const { error } = await supabase.storage.from('private-docs').upload(fileName, file);
        if (error) {
            logger.error('Upload', 'Failed private document upload:', { error: error.message, fileName, size: file.size });
            throw new Error(error.message);
        }
        return { url: fileName };
    },
    deleteFile: async (fileName: string) => {
        const { error } = await supabase.storage.from('private-docs').remove([fileName]);
        if (error) {
            logger.error('Delete', 'Failed private document delete:', { error: error.message, fileName });
            throw new Error(error.message);
        }
        return { success: true };
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
                const sharedIds = shared.map((s: any) => s.conversation_id);
                const { data: directConvs } = await supabase
                    .from('conversations')
                    .select('id')
                    .in('id', sharedIds)
                    .eq('type', 'DIRECT')
                    .limit(1);

                if (directConvs && directConvs.length > 0) {
                    return directConvs[0].id;
                }
            }
        }

        // Create new conversation
        const convId = crypto.randomUUID();
        const { error: convError } = await supabase
            .from('conversations')
            .insert({ id: convId, type: 'DIRECT' });
            
        if (convError) throw new Error(convError.message);

        // Add both participants
        const { error: partError } = await supabase.from('conversation_participants').insert([
            { conversation_id: convId, user_id: myId },
            { conversation_id: convId, user_id: otherId },
        ]);
        
        if (partError) {
            // Attempt to rollback conversation to prevent orphans
            await supabase.from('conversations').delete().eq('id', convId);
            throw new Error(partError.message);
        }

        return convId;
    },

    /** Get all conversations for a user, with last message and unread count */
    getConversations: async (myId: string, role?: string) => {
        logger.log('[Chat] getConversations called, myId:', myId);

        // 1. Fetch conversations the user is a participant of
        const { data: parts, error } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', myId);
            
        if (error) {
            logger.error('[Chat] getConversations error (check RLS policies):', error.message);
            return [];
        }
        if (!parts || parts.length === 0) return [];
        const convIds = parts.map((p: any) => p.conversation_id);

        // 2. Fetch conversation details (type, name, project_id, status, department)
        const { data: convDetails, error: convErr } = await supabase
            .from('conversations')
            .select('id, type, name, department, project_id, status')
            .in('id', convIds);

        if (convErr || !convDetails) {
            logger.error('[Chat] convDetails error:', convErr?.message);
            return [];
        }

        // 3. For DIRECT conversations, get the other participant's details
        const directConvIds = convDetails.filter((c: any) => c.type === 'DIRECT').map((c: any) => c.id);
        let otherParts: any[] = [];
        let employeeMap: Record<string, any> = {};

        if (directConvIds.length > 0) {
            const { data: directParts } = await supabase
                .from('conversation_participants')
                .select('conversation_id, user_id')
                .in('conversation_id', directConvIds)
                .neq('user_id', myId);
            otherParts = directParts || [];

            const otherUserIds = Array.from(new Set(otherParts.map((p: any) => p.user_id)));
            if (otherUserIds.length > 0) {
                const { data: emps } = await supabase
                    .from('employees')
                    .select('id, firstName, lastName, profilePhoto, designation, roleId, status')
                    .in('id', otherUserIds);
                (emps || []).forEach((e: any) => { employeeMap[e.id] = e; });
            }
        }

        // 4. Fetch only the LATEST message for each conversation using a per-conv-id approach
        // Fetch last N messages and take first occurrence per conversation_id in JS (avoids N+1)
        const { data: latestMsgs } = await supabase
            .from('messages')
            .select('id, conversation_id, content, type, sender_id, created_at')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false })
            .limit(convIds.length * 3); // 3x conv count is enough to get last msg per conv

        const lastMessageMap: Record<string, any> = {};
        (latestMsgs || []).forEach((m: any) => {
            if (!lastMessageMap[m.conversation_id]) {
                lastMessageMap[m.conversation_id] = m;
            }
        });

        // 5. Get unread counts — only unseen messages not sent by me
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

        // 6. Assemble results
        const results = convDetails.map((conv: any) => {
            const isDirect = conv.type === 'DIRECT';
            let otherEmployee = null;
            if (isDirect) {
                const other = otherParts.find((p: any) => p.conversation_id === conv.id);
                otherEmployee = other ? employeeMap[other.user_id] : null;
            }

            return {
                conversationId: conv.id,
                type: conv.type,
                name: conv.name,
                department: conv.department,
                projectId: conv.project_id,
                status: conv.status,
                otherUser: otherEmployee ? {
                    id: otherEmployee.id,
                    firstName: otherEmployee.firstName,
                    lastName: otherEmployee.lastName,
                    profilePhoto: otherEmployee.profilePhoto,
                    designation: otherEmployee.designation,
                    roleId: otherEmployee.roleId,
                    status: otherEmployee.status
                } : null,
                lastMessage: lastMessageMap[conv.id] ? {
                    id: lastMessageMap[conv.id].id,
                    content: lastMessageMap[conv.id].content,
                    type: lastMessageMap[conv.id].type,
                    createdAt: lastMessageMap[conv.id].created_at,
                    senderId: lastMessageMap[conv.id].sender_id
                } : null,
                unreadCount: unreadCounts[conv.id] || 0,
            };
        }).filter((c: any) => {
            if (c.type === 'DIRECT' && c.otherUser?.status === 'SUSPENDED') {
                return false;
            }
            return true;
        });

        // Sort by admin-pinned (for DMs) first, then by latest message timestamp
        return results.sort((a, b) => {
            const aIsAdmin = a.type === 'DIRECT' && String(a.otherUser?.roleId || '').toUpperCase() === 'ADMIN';
            const bIsAdmin = b.type === 'DIRECT' && String(b.otherUser?.roleId || '').toUpperCase() === 'ADMIN';
            if (aIsAdmin && !bIsAdmin) return -1;
            if (!aIsAdmin && bIsAdmin) return 1;
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });
    },

    /** Fetch employees that are messageable for DM by a user */
    getMessageableContacts: async (myId: string): Promise<any[]> => {
        logger.log('[Chat] getMessageableContacts for:', myId);
        const { data, error } = await supabase.rpc('get_messageable_contacts', { my_id: myId });
        if (error) {
            logger.error('[Chat] getMessageableContacts error:', error.message);
            return [];
        }
        return data || [];
    },

    /** Create a new group conversation (PROJECT, DEPARTMENT, or COMPANY) */
    createGroupConversation: async (payload: {
        name: string;
        type: 'PROJECT' | 'DEPARTMENT' | 'COMPANY';
        memberIds: string[];
        projectId?: string;
        department?: string;
        myId: string;
    }): Promise<string> => {
        const convId = crypto.randomUUID();
        const { error: convError } = await supabase
            .from('conversations')
            .insert({
                id: convId,
                type: payload.type,
                name: payload.name,
                project_id: payload.projectId || null,
                department: payload.department || null,
                created_by: payload.myId
            });

        if (convError) throw new Error(convError.message);

        // Add all members
        const participants = payload.memberIds.map(uid => ({
            conversation_id: convId,
            user_id: uid,
            role: uid === payload.myId ? 'ADMIN' : 'MEMBER'
        }));

        const { error: partError } = await supabase
            .from('conversation_participants')
            .insert(participants);

        if (partError) {
            // Rollback
            await supabase.from('conversations').delete().eq('id', convId);
            throw new Error(partError.message);
        }

        return convId;
    },

    /** Update group details */
    updateGroupConversation: async (convId: string, payload: { name?: string; logo_url?: string | null }): Promise<void> => {
        const { error } = await supabase
            .from('conversations')
            .update(payload)
            .eq('id', convId);
        if (error) throw new Error(error.message);
    },

    /** Delete group */
    deleteGroupConversation: async (convId: string): Promise<void> => {
        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', convId);
        if (error) throw new Error(error.message);
    },

    /** Add members to a group */
    addGroupMembers: async (convId: string, memberIds: string[]): Promise<void> => {
        const participants = memberIds.map(uid => ({
            conversation_id: convId,
            user_id: uid,
            role: 'MEMBER'
        }));
        const { error } = await supabase
            .from('conversation_participants')
            .insert(participants);
        if (error) throw new Error(error.message);
    },

    /** Remove a member from a group */
    removeGroupMember: async (convId: string, userId: string): Promise<void> => {
        const { error } = await supabase
            .from('conversation_participants')
            .delete()
            .eq('conversation_id', convId)
            .eq('user_id', userId);
        if (error) throw new Error(error.message);
    },

    /** Archive or unarchive a conversation */
    archiveConversation: async (convId: string, status: 'ACTIVE' | 'ARCHIVED'): Promise<void> => {
        const { error } = await supabase
            .from('conversations')
            .update({ status })
            .eq('id', convId);

        if (error) throw new Error(error.message);
    },

    /** Update members of a project group */
    updateGroupMembers: async (convId: string, memberIds: string[], myId: string): Promise<void> => {
        // Delete all current participants
        const { error: delError } = await supabase
            .from('conversation_participants')
            .delete()
            .eq('conversation_id', convId);

        if (delError) throw new Error(delError.message);

        // Re-insert new participants
        const participants = memberIds.map(uid => ({
            conversation_id: convId,
            user_id: uid,
            role: uid === myId ? 'ADMIN' : 'MEMBER'
        }));

        const { error: insError } = await supabase
            .from('conversation_participants')
            .insert(participants);

        if (insError) throw new Error(insError.message);
    },


    /** Get messages for a conversation (newest last, with sender name) */
    getMessages: async (conversationId: string, limit = 50): Promise<any[]> => {
        logger.log('[Chat] getMessages for conv:', conversationId, 'limit:', limit);
        fetch('/api/debug-log', { method: 'POST', body: JSON.stringify({ type: 'getMessages' }) }).catch(() => {});
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
                mediaUrl: m.media_url,
                taskRef: m.task_ref,
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
            mediaUrl: m.media_url,
            taskRef: m.task_ref,
            taskId: m.task_id
        }));
    },

    /** Send a message */
    sendMessage: async (payload: {
        conversationId: string;
        senderId: string;
        content?: string;
        type?: 'text' | 'image' | 'pdf';
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
            senderId: data.sender_id,
            mediaUrl: data.media_url,
            taskRef: data.task_ref
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
    uploadChatMedia: async (file: File, conversationId: string): Promise<{ url: string }> => {
        // Validate File
        api.validateUpload(file, 5, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

        const session = await supabase.auth.getSession();
        const userId = session.data.session?.user.id;
        if (!userId) throw new Error('Unauthenticated upload');

        // Sanitize extension to prevent path traversal
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
        const fileName = `chat/${conversationId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        logger.log('[Chat] uploadChatMedia: uploading', fileName, 'size:', file.size);
        const { error } = await supabase.storage.from('chat-media').upload(fileName, file, { upsert: false });
        if (error) {
            logger.error('Upload', 'Failed chat media upload:', { error: error.message, fileName, conversationId, size: file.size });
            throw new Error(`Image upload failed: ${error.message}.`);
        }
        
        // Return ONLY the path to keep it private. The UI will request a Signed URL on demand.
        return { url: fileName };
    },

    /** Generate temporary signed URL for a chat media file */
    getSignedChatMediaUrl: async (path: string): Promise<string> => {
        if (!path || path.startsWith('http')) return path; // already a full URL
        const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600); // 1 hour
        if (error) {
            logger.error('[Chat] getSignedChatMediaUrl failed:', error.message);
            return path;
        }
        return data.signedUrl;
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
            ),
            tasks:tasks(id, status)
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

        const { data, error } = await query.order('created_at', { ascending: false });
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
        const { createdBy, ...rest } = payload as any;
        const dbPayload = { ...rest, ...(createdBy ? { created_by: createdBy } : {}) };
        const { data, error } = await supabase.from('projects').insert(dbPayload).select().single();
        handleSupabaseEvent(data, error, 'Create Project');
        return data as ProjectDTO;
    },

    updateProject: async (id: string, payload: Partial<ProjectDTO>) => {
        const { createdBy, ...rest } = payload as any;
        const dbPayload = { ...rest, ...(createdBy ? { created_by: createdBy } : {}) };
        const { data, error } = await supabase.from('projects').update(dbPayload).eq('id', id).select().single();
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

    // ==================== Notes ====================

    getNotes: async (employeeId?: string, projectId?: string) => {
        let query = supabase.from('notes').select(`
            *,
            employee:employees!"employeeId"(id, firstName, lastName, profilePhoto),
            project:projects!"projectId"(id, name)
        `);

        if (employeeId) {
            if (projectId) {
                // Get user's own notes for this project + team notes for this project
                query = query.eq('projectId', projectId).or(`employeeId.eq.${employeeId},visibility.eq.team`);
            } else {
                // Get user's own notes (all) + team notes from projects they belong to
                query = query.eq('employeeId', employeeId);
            }
        }

        const { data, error } = await query.order('pinned', { ascending: false }).order('updatedAt', { ascending: false });
        handleSupabaseEvent(data, error, 'Fetch Notes');
        return (data || []) as NoteDTO[];
    },

    getNoteById: async (id: string) => {
        const { data, error } = await supabase
            .from('notes')
            .select(`
                *,
                employee:employees!"employeeId"(id, firstName, lastName, profilePhoto),
                project:projects!"projectId"(id, name)
            `)
            .eq('id', id)
            .single();

        handleSupabaseEvent(data, error, 'Fetch Note Detail');
        return data as NoteDTO;
    },

    createNote: async (payload: Partial<NoteDTO>) => {
        const dbPayload: any = {
            title: payload.title || 'Untitled Note',
            content: payload.content || null,
            employeeId: payload.employeeId,
            projectId: payload.projectId || null,
            visibility: payload.visibility || 'private',
            pinned: payload.pinned || false,
            color: payload.color || null,
        };

        const { data, error } = await supabase.from('notes').insert(dbPayload).select().single();
        handleSupabaseEvent(data, error, 'Create Note');
        return data as NoteDTO;
    },

    updateNote: async (id: string, payload: Partial<NoteDTO>) => {
        const whitelist = ['title', 'content', 'projectId', 'visibility', 'pinned', 'color'];
        const dbPayload: any = {};
        Object.keys(payload).forEach(key => {
            if (whitelist.includes(key) && (payload as any)[key] !== undefined) {
                dbPayload[key] = (payload as any)[key];
            }
        });

        const { data, error } = await supabase.from('notes').update(dbPayload).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Note');
        return data as NoteDTO;
    },

    deleteNote: async (id: string) => {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Note');
        return { success: true };
    },

    getProjectNotes: async (projectId: string) => {
        const { data, error } = await supabase
            .from('notes')
            .select(`
                *,
                employee:employees!"employeeId"(id, firstName, lastName, profilePhoto),
                project:projects!"projectId"(id, name)
            `)
            .eq('projectId', projectId)
            .eq('visibility', 'team')
            .order('pinned', { ascending: false })
            .order('updatedAt', { ascending: false });

        handleSupabaseEvent(data, error, 'Fetch Project Notes');
        return (data || []) as NoteDTO[];
    },

    // ---------------------------------------------------------------------------
    // Boards
    // ---------------------------------------------------------------------------

    getBoards: async (myId?: string, isAdmin?: boolean) => {
        let query = supabase
            .from('boards')
            .select(`
                *,
                employee:employees!"employeeId"(id, firstName, lastName, profilePhoto),
                project:projects!"projectId"(id, name)
            `)
            .order('updatedAt', { ascending: false });

        if (myId && !isAdmin) {
            const { data: invites } = await supabase
                .from('board_invites')
                .select('board_id')
                .eq('invitee_id', myId)
                .eq('status', 'accepted');
            
            const invitedBoardIds = invites?.map((i: any) => i.board_id) || [];
            let orString = `visibility.eq.team,employeeId.eq.${myId}`;
            if (invitedBoardIds.length > 0) {
                orString += `,id.in.(${invitedBoardIds.join(',')})`;
            }
            query = query.or(orString);
        }

        const { data, error } = await query;
        handleSupabaseEvent(data, error, 'Fetch Boards');
        return (data || []) as BoardDTO[];
    },

    getBoardById: async (id: string) => {
        const { data, error } = await supabase
            .from('boards')
            .select(`
                *,
                employee:employees!"employeeId"(id, firstName, lastName, profilePhoto),
                project:projects!"projectId"(id, name)
            `)
            .eq('id', id)
            .single();

        handleSupabaseEvent(data, error, 'Fetch Board By ID');
        return data as BoardDTO;
    },

    createBoard: async (payload: Partial<BoardDTO>) => {
        const { data, error } = await supabase.from('boards').insert(payload).select().single();
        handleSupabaseEvent(data, error, 'Create Board');
        return data as BoardDTO;
    },

    updateBoardDocument: async (id: string, document: any) => {
        const { data, error } = await supabase.from('boards').update({ document, updatedAt: new Date().toISOString() }).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Board Document');
        return data as BoardDTO;
    },

    updateBoardVisibility: async (id: string, visibility: 'team' | 'private') => {
        const { data, error } = await supabase.from('boards').update({ visibility, updatedAt: new Date().toISOString() }).eq('id', id).select().single();
        handleSupabaseEvent(data, error, 'Update Board Visibility');
        return data as BoardDTO;
    },

    deleteBoard: async (id: string) => {
        const { error } = await supabase.from('boards').delete().eq('id', id);
        handleSupabaseEvent(null, error, 'Delete Board');
        return { success: true };
    },

    // ---------------------------------------------------------------------------
    // Board Invites
    // ---------------------------------------------------------------------------

    getBoardInvites: async (boardId: string) => {
        const { data, error } = await supabase
            .from('board_invites')
            .select(`
                *,
                inviter:employees!inviter_id(id, firstName, lastName, profilePhoto),
                invitee:employees!invitee_id(id, firstName, lastName, profilePhoto)
            `)
            .eq('board_id', boardId);
            
        handleSupabaseEvent(data, error, 'Fetch Board Invites');
        return data || [];
    },

    getMyPendingBoardInvites: async (userId: string) => {
        const { data, error } = await supabase
            .from('board_invites')
            .select(`
                *,
                board:boards(id, name),
                inviter:employees!inviter_id(id, firstName, lastName, profilePhoto)
            `)
            .eq('invitee_id', userId)
            .eq('status', 'pending');
            
        handleSupabaseEvent(data, error, 'Fetch Pending Board Invites');
        return data || [];
    },

    inviteToBoard: async (boardId: string, inviterId: string, inviteeId: string) => {
        const { data, error } = await supabase
            .from('board_invites')
            .insert({
                board_id: boardId,
                inviter_id: inviterId,
                invitee_id: inviteeId,
                status: 'pending'
            })
            .select()
            .single();
            
        handleSupabaseEvent(data, error, 'Invite to Board');
        return data;
    },

    updateBoardInviteStatus: async (inviteId: string, status: 'accepted' | 'declined') => {
        const { data, error } = await supabase
            .from('board_invites')
            .update({ status })
            .eq('id', inviteId)
            .select()
            .single();
            
        handleSupabaseEvent(data, error, 'Update Board Invite');
        return data;
    },
};
