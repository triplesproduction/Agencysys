import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { dashboardKeys } from './keys';
import { useAuth } from '@/context/AuthContext';
import { useMemo, useEffect } from 'react';

export function useDashboardData() {
    const queryClient = useQueryClient();
    const { employee: authEmployee, loading: authLoading } = useAuth();
    
    // Derive role
    const activeRole = useMemo(() => {
        if (!authEmployee) return 'EMPLOYEE';
        let role = authEmployee.roleId || 'EMPLOYEE';
        role = role.toUpperCase();
        if (role.includes('ADMIN')) return 'ADMIN';
        if (role.includes('MANAGER')) return 'MANAGER';
        return 'EMPLOYEE';
    }, [authEmployee]);

    const activeEmpId = authEmployee?.id;
    const isEnabled = !!activeEmpId && !authLoading;

    // Core Dashboard Data (Blocking render)
    const tasksQuery = useQuery({
        queryKey: dashboardKeys.tasks(activeRole, activeEmpId),
        queryFn: async () => {
            if (activeRole === 'ADMIN' || activeRole === 'MANAGER') {
                return api.getTasks(undefined, undefined, 100);
            }
            return api.getTasks(activeEmpId, undefined, 15);
        },
        enabled: isEnabled,
    });

    const employeesQuery = useQuery({
        queryKey: dashboardKeys.employees(),
        queryFn: () => api.getEmployees({ limit: 100, status: 'ACTIVE' }),
        enabled: isEnabled,
    });

    // Secondary Data
    const monthlyHoursQuery = useQuery({
        queryKey: dashboardKeys.monthlyHours(activeEmpId),
        queryFn: () => api.getMonthlyWorkHours(activeEmpId!),
        enabled: isEnabled && activeRole !== 'ADMIN',
    });

    const recentWorkHoursQuery = useQuery({
        queryKey: dashboardKeys.recentWorkHours(activeEmpId),
        queryFn: () => api.getRecentWorkHours(activeEmpId!, 5),
        enabled: isEnabled && activeRole === 'EMPLOYEE',
    });

    const myEodsQuery = useQuery({
        queryKey: dashboardKeys.eods('EMPLOYEE', activeEmpId),
        queryFn: () => api.getMyEODs(activeEmpId!),
        enabled: isEnabled && activeRole === 'EMPLOYEE',
    });

    const allEodsQuery = useQuery({
        queryKey: dashboardKeys.eods('ADMIN', activeEmpId),
        queryFn: () => api.getAllEODs({ limit: 12 }),
        enabled: isEnabled && activeRole === 'ADMIN',
    });

    const myKpiQuery = useQuery({
        queryKey: dashboardKeys.kpiProfiles('EMPLOYEE', activeEmpId),
        queryFn: () => api.getKpiProfile(activeEmpId!),
        enabled: isEnabled && activeRole === 'EMPLOYEE',
    });

    const allKpisQuery = useQuery({
        queryKey: dashboardKeys.kpiProfiles('ALL', activeEmpId),
        queryFn: () => api.getAllKpiProfiles(undefined, 100),
        enabled: isEnabled && (activeRole === 'ADMIN' || activeRole === 'MANAGER'),
    });

    const allWorkHoursQuery = useQuery({
        queryKey: ['dashboard', 'allWorkHours', activeEmpId],
        queryFn: async () => {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0,0,0,0);
            
            const endOfMonth = new Date(startOfMonth);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            
            const { data, error } = await supabase
                .from('work_hours')
                .select('employeeId, hoursLogged')
                .gte('date', startOfMonth.toISOString().split('T')[0])
                .lt('date', endOfMonth.toISOString().split('T')[0]);
                
            if (error) throw error;
            return data || [];
        },
        enabled: isEnabled && (activeRole === 'ADMIN' || activeRole === 'MANAGER'),
    });

    const kpiAuditLogsQuery = useQuery({
        queryKey: dashboardKeys.kpiAuditLogs(activeRole, activeEmpId),
        queryFn: () => api.getAllKpiAuditLogs(activeRole === 'ADMIN' ? 10 : 8),
        enabled: isEnabled && (activeRole === 'ADMIN' || activeRole === 'MANAGER'),
    });

    // Unread count (initial load, realtime + 10s polling fallback)
    const unreadCountQuery = useQuery({
        queryKey: dashboardKeys.unreadCount(activeEmpId),
        queryFn: () => api.getUnreadCount(String(activeEmpId)),
        enabled: isEnabled,
        refetchInterval: 10000, // Robust polling fallback
    });

    // Real-time synchronization of unread count
    useEffect(() => {
        if (!activeEmpId) return;

        const refetchUnread = () => {
            queryClient.invalidateQueries({ queryKey: dashboardKeys.unreadCount(activeEmpId) });
        };

        window.addEventListener('messagesMarkedRead', refetchUnread);

        const channel = supabase
            .channel('dashboard-unread-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                },
                () => {
                    refetchUnread();
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('messagesMarkedRead', refetchUnread);
            supabase.removeChannel(channel);
        };
    }, [activeEmpId, queryClient]);

    // Hydration & derived state
    const rawTasks = tasksQuery.data || [];
    const employeesList = employeesQuery.data?.data || [];
    const totalEmployees = employeesQuery.data?.total || employeesList.length;

    const hydratedTasks = useMemo(() => {
        return rawTasks.map((task: any) => {
            const assigned = employeesList.filter((e: any) =>
                (task.assigneeIds && task.assigneeIds.includes(e.id)) || task.assigneeId === e.id
            );
            return {
                ...task,
                assignees: assigned.length > 0 ? assigned.map((e: any) => ({
                    id: e.id,
                    firstName: e.firstName,
                    lastName: e.lastName,
                    profilePhoto: e.profilePhoto
                })) : (task.assignee ? [task.assignee] : [])
            };
        });
    }, [rawTasks, employeesList]);

    const realMonthlyHours = monthlyHoursQuery.data || 0;
    const fetchedKpis = myKpiQuery.data;
    const finalKpis = useMemo(() => {
        if (activeRole === 'EMPLOYEE') {
            if (fetchedKpis) {
                return { ...fetchedKpis, total_hours_worked: realMonthlyHours };
            }
            return { total_hours_worked: realMonthlyHours };
        }
        return null;
    }, [activeRole, fetchedKpis, realMonthlyHours]);

    const recentEods = activeRole === 'EMPLOYEE' ? (myEodsQuery.data || []) : (allEodsQuery.data || []);
    const allKpis = allKpisQuery.data || [];
    const recentKpiLogs = kpiAuditLogsQuery.data || [];
    const recentLogs = recentWorkHoursQuery.data || [];
    const unreadCount = unreadCountQuery.data || 0;

    const isCoreLoading = tasksQuery.isLoading || employeesQuery.isLoading || authLoading;
    const isEmployeeLoading = activeRole === 'EMPLOYEE' && (
        monthlyHoursQuery.isLoading ||
        recentWorkHoursQuery.isLoading ||
        myEodsQuery.isLoading ||
        myKpiQuery.isLoading
    );
    const isAdminLoading = (activeRole === 'ADMIN' || activeRole === 'MANAGER') && (
        allEodsQuery.isLoading ||
        allKpisQuery.isLoading ||
        allWorkHoursQuery.isLoading ||
        kpiAuditLogsQuery.isLoading
    );

    const isLoading = isCoreLoading || isEmployeeLoading || isAdminLoading || unreadCountQuery.isLoading;

    return {
        userRole: activeRole,
        employee: authEmployee,
        tasks: hydratedTasks,
        allEmployees: employeesList,
        totalEmployees,
        kpis: finalKpis,
        allKpis,
        allWorkHours: allWorkHoursQuery.data || [],
        recentKpiLogs,
        recentEods,
        recentLogs,
        monthlyHours: realMonthlyHours,
        unreadCount,
        isLoading,
        _rawKpiScore: (finalKpis as any)?.current_score,
        isError: tasksQuery.isError || employeesQuery.isError || allWorkHoursQuery.isError,
    };
}
