'use client';

import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import ErrorBoundary from '@/components/ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <NotificationProvider>
                {children}
            </NotificationProvider>
        </ErrorBoundary>
    );
}
