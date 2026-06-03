import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceKeys } from './keys';
import { api } from '@/lib/api';
import { WorkHourLogDTO } from '@/types/dto';

export function useMonthlyAttendance(month: number, year: number) {
    return useQuery({
        queryKey: attendanceKeys.monthlyAttendance(month, year),
        queryFn: async () => {
            return await api.getMonthlyAttendance(month, year);
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useRecentWorkHours(employeeId?: string, limit: number = 5) {
    return useQuery({
        queryKey: employeeId ? attendanceKeys.recentWorkHours(employeeId) : attendanceKeys.workHours(),
        queryFn: async () => {
            if (!employeeId) return [];
            return await api.getRecentWorkHours(employeeId, limit);
        },
        enabled: !!employeeId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useClockIn() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (employeeId: string) => {
            return await api.clockIn(employeeId);
        },
        onSuccess: (_, employeeId) => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.recentWorkHours(employeeId) });
        },
    });
}

export function useClockOut() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (employeeId: string) => {
            return await api.clockOut(employeeId);
        },
        onSuccess: (_, employeeId) => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.recentWorkHours(employeeId) });
        },
    });
}

export function useAddWorkHourLog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<WorkHourLogDTO>) => {
            return await api.addWorkHourLog(data);
        },
        onSuccess: (_, variables) => {
            if (variables.employeeId) {
                queryClient.invalidateQueries({ queryKey: attendanceKeys.recentWorkHours(variables.employeeId) });
            }
        },
    });
}

export function useAttendanceReport(employeeId?: string, monthYear?: string) {
    return useQuery({
        queryKey: employeeId && monthYear ? attendanceKeys.report(employeeId, monthYear) : attendanceKeys.all,
        queryFn: async () => {
            if (!employeeId || !monthYear) return null;
            return await api.getAttendanceReport(employeeId, monthYear);
        },
        enabled: !!employeeId && !!monthYear,
        staleTime: 5 * 60 * 1000,
    });
}

export function useMonthlyWorkHours(employeeId?: string, monthYear?: string) {
    return useQuery({
        queryKey: employeeId ? attendanceKeys.monthlyWorkHours(employeeId, monthYear) : attendanceKeys.all,
        queryFn: async () => {
            if (!employeeId) return 0;
            return await api.getMonthlyWorkHours(employeeId, monthYear);
        },
        enabled: !!employeeId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useWorkHoursInRange(startDate: string, endDate: string, employeeId?: string) {
    return useQuery({
        queryKey: [...attendanceKeys.all, 'range', startDate, endDate, employeeId],
        queryFn: async () => {
            return await api.getWorkHoursInRange(startDate, endDate, employeeId);
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useAddHoliday() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: any) => {
            return await api.addHoliday(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
        },
    });
}

export function useDeleteHoliday() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return await api.deleteHoliday(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
        },
    });
}
