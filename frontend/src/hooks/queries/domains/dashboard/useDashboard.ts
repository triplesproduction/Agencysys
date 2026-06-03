import { useQuery } from '@tanstack/react-query';
import { dashboardKeys } from './keys';
import { api } from '@/lib/api';

export function useAnnouncements() {
    return useQuery({
        queryKey: dashboardKeys.announcements(),
        queryFn: async () => {
            // Using existing api.ts as the safe compatibility layer during migration
            return await api.getAnnouncements();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useRules() {
    return useQuery({
        queryKey: dashboardKeys.rules(),
        queryFn: async () => {
            // Using existing api.ts as the safe compatibility layer during migration
            return await api.getRules();
        },
        staleTime: 60 * 60 * 1000, // 1 hour for rules since they rarely change
    });
}
