import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

// Global tracker for mutation execution times
const mutationStartTimeMap = new Map<number, number>();

export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onSuccess: (data, query) => {
            logger.info('Query', `Success [${query.queryHash}]`, query.queryKey);
        },
        onError: (error, query) => {
            logger.error('Query', `Error [${query.queryHash}]`, query.queryKey, error);
        },
        onSettled: (data, error, query) => {
            // Optional: verbose settled logging
        }
    }),
    mutationCache: new MutationCache({
        onMutate: (variables, mutation) => {
            const key = mutation.options.mutationKey || 'Unnamed Mutation';
            mutationStartTimeMap.set(mutation.mutationId, Date.now());
            logger.info('Mutation', `[id=${mutation.mutationId}] Started ${key}`, variables);
        },
        onSuccess: (data, variables, context, mutation) => {
            const key = mutation.options.mutationKey || 'Unnamed Mutation';
            logger.info('Mutation', `[id=${mutation.mutationId}] Success ${key}`);
        },
        onError: (error, variables, context, mutation) => {
            const key = mutation.options.mutationKey || 'Unnamed Mutation';
            logger.error('Mutation', `[id=${mutation.mutationId}] Error ${key}`, { error, context });
        },
        onSettled: (data, error, variables, context, mutation) => {
            const key = mutation.options.mutationKey || 'Unnamed Mutation';
            const startTime = mutationStartTimeMap.get(mutation.mutationId);
            const duration = startTime ? Date.now() - startTime : null;
            
            if (duration && duration > 1500) {
                logger.warn('Mutation', `[id=${mutation.mutationId}] SLOW EXECUTION DETECTED: ${key} took ${duration}ms`);
            }
            
            logger.info('Mutation', `[id=${mutation.mutationId}] Settled ${key}`, duration ? `(${duration}ms)` : '');
            mutationStartTimeMap.delete(mutation.mutationId);
        }
    }),
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 30 * 60 * 1000,   // 30 minutes
            retry: (failureCount, error: any) => {
                // Don't retry auth errors or missing data errors
                if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false;
                return failureCount < 2;
            },
            refetchOnWindowFocus: false, // Prevents aggressive refetching
        }
    }
});
