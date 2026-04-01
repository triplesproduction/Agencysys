import { MessageDTO } from '../types/dto';
import { supabase } from './supabase';

const REALTIME_CHANNEL = 'system_events';

class SupabaseRealtimeClient {
    private channel = supabase.channel(REALTIME_CHANNEL);

    constructor() {
        if (typeof window !== 'undefined') {
            this.channel.subscribe();
        }
    }

    subscribe(eventName: string, callback: (data: any) => void) {
        if (typeof window === 'undefined') return () => {};

        this.channel.on('broadcast', { event: eventName }, (payload) => {
            callback(payload.payload);
        });

        return () => {
            // Cleanup broadcast listener if Supabase supports direct off() for specific handlers 
        };
    }

    sendMessage(payload: { eventName: string, data: any }) {
        this.channel.send({
            type: 'broadcast',
            event: payload.eventName,
            payload: payload.data,
        });
    }

    // Proxy connect/disconnect for backward compatibility with WebSocketClient signature
    connect(token?: string) { /* Supabase handles this via subscribe() */ }
    disconnect() { this.channel.unsubscribe(); }
}

export const wsClient = new SupabaseRealtimeClient();

// High level wrappers for specific domains
export const messagingLayer = {
    onMessageReceived: (callback: (msg: MessageDTO) => void) => {
        return wsClient.subscribe('message.sent', callback);
    },
    sendMessage: (content: string, receiverId?: string, channelId?: string) => {
        wsClient.sendMessage({
            eventName: 'message.send',
            data: { content, receiverId, channelId }
        });
    }
};

export const kpiEvents = {
    onKpiUpdated: (callback: (kpi: { kpiId: string, employeeId: string, metricName: string, currentValue: number }) => void) => {
        return wsClient.subscribe('kpi.updated', callback);
    }
};
