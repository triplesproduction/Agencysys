'use client';

import { NotificationProvider } from '@/components/notifications/NotificationProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <NotificationProvider>
            {children}
        </NotificationProvider>
    );
}
