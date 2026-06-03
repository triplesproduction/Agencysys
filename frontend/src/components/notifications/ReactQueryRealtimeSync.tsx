'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { projectKeys, taskKeys } from '@/hooks/queries/domains/projects/keys';
import { eodKeys } from '@/hooks/queries/domains/eod/keys';
import { employeeKeys } from '@/hooks/queries/domains/employees/keys';
import { logger } from '@/lib/logger';

export function ReactQueryRealtimeSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const processedEventIds = new Set<string>();

        const handleLiveUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            const notification = customEvent.detail;
            if (!notification || !notification.id) return;

            // Deduplication logic
            if (processedEventIds.has(notification.id)) {
                logger.warn('Realtime', `Duplicate event ignored [${notification.id}]`);
                return;
            }
            
            // Calculate Latency (if backend sends a timestamp metadata)
            const broadcastTime = notification.metadata?.timestamp || notification.timestamp;
            const latency = broadcastTime ? Date.now() - new Date(broadcastTime).getTime() : null;
            if (latency !== null) {
                logger.info('Realtime', `Event latency [${notification.type}]: ${latency}ms`);
            }

            processedEventIds.add(notification.id);
            // Cleanup set size to prevent memory leak
            if (processedEventIds.size > 100) {
                const iterator = processedEventIds.values();
                const nextVal = iterator.next().value;
                if (nextVal) processedEventIds.delete(nextVal);
            }

            let invalidatedKeys: any = null;

            // Invalidate based on notification type
            switch (notification.type) {
                case 'TASK_ASSIGNED':
                case 'TASK_UPDATED':
                case 'TASK_DELETED':
                    invalidatedKeys = taskKeys.all;
                    queryClient.invalidateQueries({ queryKey: taskKeys.all });
                    break;
                case 'PROJECT_CREATED':
                case 'PROJECT_UPDATED':
                case 'PROJECT_DELETED':
                    invalidatedKeys = projectKeys.all;
                    queryClient.invalidateQueries({ queryKey: projectKeys.all });
                    break;
                case 'EOD_SUBMITTED':
                case 'EOD_REVIEWED':
                    invalidatedKeys = eodKeys.all;
                    queryClient.invalidateQueries({ queryKey: eodKeys.all });
                    break;
                case 'EMPLOYEE_UPDATED':
                    invalidatedKeys = employeeKeys.all;
                    queryClient.invalidateQueries({ queryKey: employeeKeys.all });
                    break;
                default:
                    break;
            }

            if (invalidatedKeys) {
                logger.info('Query', `Invalidated by Realtime Broadcast [${notification.type}]`, invalidatedKeys);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('app:live-notification', handleLiveUpdate);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('app:live-notification', handleLiveUpdate);
            }
        };
    }, [queryClient]);

    return null; // This component doesn't render anything
}
