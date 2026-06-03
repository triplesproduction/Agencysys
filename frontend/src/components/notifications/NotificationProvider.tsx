'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/lib/logger';
import GlassCard from '../GlassCard';
import './Notifications.css';

// Global tracker for leak detection
let activeConnectionsCount = 0;

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
    const { user, loading: authLoading } = useAuth();
    const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
    const router = useRouter();

    useEffect(() => {
        if (authLoading || !user) return;

        // Initialize Supabase Channel for Realtime Notifications
        const channel = supabase.channel('system_events');
        
        activeConnectionsCount++;
        if (activeConnectionsCount > 1) {
            logger.warn('Realtime', `Memory Leak Warning: ${activeConnectionsCount} active realtime connections detected!`);
        }

        channel
            .on('broadcast', { event: 'notification' }, ({ payload }: { payload: NotificationMessage }) => {
                logger.info('Realtime', `Received Broadcast [${payload.type}]`, payload);
                
                // Assign ephemeral ID if missing from transit
                const liveMessage = { ...payload, id: payload.id || `live-${Date.now()}` };

                setNotifications((prev) => [...prev, liveMessage]);

                // Dispatch global event for instant UI refreshing across active pages 
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('app:live-notification', { detail: liveMessage }));
                }

                // Auto-dismiss after 6 seconds
                setTimeout(() => {
                    setNotifications((prev) => prev.filter((n) => n.id !== liveMessage.id));
                }, 6000);
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    logger.info('Realtime', 'Connected to system_events channel');
                } else if (status === 'CLOSED') {
                    logger.warn('Realtime', 'Disconnected from system_events channel');
                } else if (status === 'CHANNEL_ERROR') {
                    logger.error('Realtime', 'Error in system_events channel:', err);
                }
            });

        return () => {
            activeConnectionsCount--;
            logger.info('Realtime', 'Cleaning up system_events channel');
            supabase.removeChannel(channel);
        };
    }, [user, authLoading]);

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
            router.push('/rulebook');
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
