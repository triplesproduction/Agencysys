import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveKeys } from './keys';
import { api } from '@/lib/api';
import { LeaveApplicationDTO } from '@/types/dto';

export function useMyLeaves(userId?: string) {
    return useQuery({
        queryKey: userId ? leaveKeys.myLeaves(userId) : leaveKeys.all, // fallback to all if no user
        queryFn: async () => {
            if (!userId) return [];
            return await api.getMyLeaves(userId);
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useEmployeeLeaves(employeeId?: string) {
    return useQuery({
        queryKey: employeeId ? leaveKeys.employeeLeaves(employeeId) : leaveKeys.all,
        queryFn: async () => {
            if (!employeeId) return [];
            return await api.getEmployeeLeaves(employeeId);
        },
        enabled: !!employeeId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useAllLeaves() {
    return useQuery({
        queryKey: leaveKeys.lists(),
        queryFn: async () => {
            return await api.getLeaves();
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useApplyForLeave() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<LeaveApplicationDTO>) => {
            return await api.applyForLeave(data);
        },
        onSuccess: (_, variables) => {
            if (variables.employeeId) {
                queryClient.invalidateQueries({ queryKey: leaveKeys.myLeaves(variables.employeeId) });
            }
            queryClient.invalidateQueries({ queryKey: leaveKeys.lists() });
        },
    });
}

export function useApproveLeave() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status, approverId }: { id: string, status: 'APPROVED' | 'REJECTED', approverId: string }) => {
            return await api.approveLeave(id, status, approverId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: leaveKeys.all });
        },
    });
}
