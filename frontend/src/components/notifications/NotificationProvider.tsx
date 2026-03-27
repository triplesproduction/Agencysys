'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserFromToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import GlassCard from '../GlassCard';
import './Notifications.css';

interface NotificationMessage {
    id: string;
    title: string;
    message: string;
    type: string;
    metadata?: any;
}

interface NotificationContextProps {
    notifications: NotificationMessage[];
    addNotification: (notification: Omit<NotificationMessage, 'id'>) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextProps>({
    notifications: [],
    addNotification: () => { },
    removeNotification: () => { },
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
    const router = useRouter();

    useEffect(() => {
        const user = getUserFromToken();
        const activeUserId = user?.sub || user?.employeeId;
        if (!activeUserId) return;

        // Initialize Supabase Channel for Realtime Notifications
        const channel = supabase.channel('system_events');

        channel
            .on('broadcast', { event: 'notification' }, ({ payload }: { payload: NotificationMessage }) => {
                // Assign ephemeral ID if missing from transit
                const liveMessage = { ...payload, id: payload.id || `live-${Date.now()}` };

                setNotifications((prev) => [...prev, liveMessage]);

                // Dispatch global event for instant UI refreshing across active pages 
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('app:live-notification', { detail: liveMessage }));
                }

                // Auto-dismiss after 6 seconds
                setTimeout(() => {
                    removeNotification(liveMessage.id);
                }, 6000);
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    const removeNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const addNotification = (notification: Omit<NotificationMessage, 'id'>) => {
        const liveMessage = { ...notification, id: `local-${Date.now()}` };
        setNotifications((prev) => [...prev, liveMessage]);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
            removeNotification(liveMessage.id);
        }, 6000);
    };

    const handleNotificationClick = (notif: NotificationMessage) => {
        if (notif.type === 'TASK_ASSIGNED' || notif.type === 'TASK_UPDATED') {
            router.push('/dashboard');
        } else if (notif.type === 'RULE_ADDED') {
            router.push('/wiki');
        } else if (notif.type === 'EOD_SUBMITTED') {
            router.push('/eod/reviews');
        } else if (notif.type === 'CHAT_MESSAGE') {
            router.push('/messaging');
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}

            {/* Global Absolute Overlay Container */}
            <div className="floating-notification-container">
                {notifications.map((notif) => (
                    <div key={notif.id} className="notification-wrapper slide-up">
                        <GlassCard className="notification-card" data-type={notif.type}>
                            <div className="notification-glow-ring" />
                            <div
                                className="notification-content"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleNotificationClick(notif)}
                            >
                                <strong>{notif.title}</strong>
                                <p>{notif.message}</p>
                            </div>
                            <button className="notification-close" onClick={() => removeNotification(notif.id)}>
                                ×
                            </button>
                        </GlassCard>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
