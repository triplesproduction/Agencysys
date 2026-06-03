'use client';

import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/hooks/queries/core/queryClient';
import { ReactQueryRealtimeSync } from '@/components/notifications/ReactQueryRealtimeSync';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const throttleReload = () => {
            try {
                const lastReload = sessionStorage.getItem('last_chunk_load_reload');
                const now = Date.now();
                if (lastReload && now - parseInt(lastReload, 10) < 10000) {
                    logger.warn('CRASH_CAPTURE', 'Prevented infinite reload loop due to ChunkLoadError');
                    return;
                }
                sessionStorage.setItem('last_chunk_load_reload', String(now));
            } catch (e) {
                // Fail-safe if sessionStorage is blocked
            }
            window.location.reload();
        };

        const handleCrash = (event: ErrorEvent) => {
            logger.error('CRASH_CAPTURE', 'Unhandled Client Runtime Exception:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error?.stack || event.error
            });
            if (event.message?.includes('Loading chunk') || event.error?.name === 'ChunkLoadError') {
                throttleReload();
            }
        };

        const handlePromiseRejection = (event: PromiseRejectionEvent) => {
            logger.error('CRASH_CAPTURE', 'Unhandled Promise Rejection:', {
                reason: event.reason?.stack || event.reason?.message || event.reason
            });
            if (event.reason?.name === 'ChunkLoadError' || String(event.reason).includes('Loading chunk')) {
                throttleReload();
            }
        };

        window.addEventListener('error', handleCrash);
        window.addEventListener('unhandledrejection', handlePromiseRejection);

        return () => {
            window.removeEventListener('error', handleCrash);
            window.removeEventListener('unhandledrejection', handlePromiseRejection);
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <AuthProvider>
                    <NotificationProvider>
                        <ReactQueryRealtimeSync />
                        {children}
                    </NotificationProvider>
                </AuthProvider>
            </ErrorBoundary>
            {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
    );
}
