import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { employeeKeys } from './keys';
import { EmployeeDTO } from '@/types/dto';

export function useEmployees(options?: { page?: number, limit?: number, search?: string, roleId?: string, status?: string, department?: string, sortBy?: string, excludeAdmin?: boolean }, queryOptions?: { enabled?: boolean }) {
    return useQuery({
        queryKey: employeeKeys.list(options || {}),
        queryFn: async () => {
            const response = await api.getEmployees(options);
            // Handling the case where api.getEmployees returns either an array or an object { data: EmployeeDTO[] }
            if (Array.isArray(response)) return response;
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...queryOptions,
    });
}

export function useEmployee(id?: string) {
    return useQuery({
        queryKey: employeeKeys.detail(id!),
        queryFn: () => api.getEmployeeById(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}
