import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eodKeys } from './keys';
import { api } from '@/lib/api';
import { EODSubmissionDTO } from '@/types/dto';

export function useMyEODs(employeeId?: string) {
    return useQuery({
        queryKey: eodKeys.myEODs(employeeId),
        queryFn: async () => {
            if (!employeeId) return [];
            return await api.getMyEODs(employeeId);
        },
        enabled: !!employeeId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useEODLogs(startDate: string, endDate: string, employeeId?: string) {
    return useQuery({
        queryKey: eodKeys.logs(startDate, endDate, employeeId),
        queryFn: async () => {
            return await api.getAllEODs({ startDate, endDate, employeeId, limit: 500 });
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useSubmitEOD() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<EODSubmissionDTO>) => {
            return await api.submitEOD(data);
        },
        onSuccess: (_, variables) => {
            if (variables.employeeId) {
                queryClient.invalidateQueries({ queryKey: eodKeys.myEODs(variables.employeeId) });
            }
            queryClient.invalidateQueries({ queryKey: eodKeys.all });
        },
    });
}

export function useReviewEOD() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string, payload: { employeeId: string; date: string; workHours: number; adminNote?: string; status: string } }) => {
            return await api.reviewEOD(id, payload);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: eodKeys.myEODs(variables.payload.employeeId) });
            queryClient.invalidateQueries({ queryKey: eodKeys.all });
        },
    });
}
