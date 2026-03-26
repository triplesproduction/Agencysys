import { MessageDTO, KPIMetricDTO } from '../types/dto';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/api/v1/ws';

type EventCallback = (data: any) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private subscribers: Map<string, Set<EventCallback>> = new Map();

    connect(token?: string) {
        if (typeof window === 'undefined') return; // Do not run on SSR

        const url = token ? `${WS_URL}?token=${token}` : WS_URL;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.eventName && payload.data) {
                    this.notifySubscribers(payload.eventName, payload.data);
                }
            } catch (err) {
                console.error('Failed to parse WS message', err);
            }
        };

        this.ws.onclose = () => {
            this.attemptReconnect(token);
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }

    private attemptReconnect(token?: string) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                this.connect(token);
            }, 1000 * Math.pow(2, this.reconnectAttempts));
        }
    }

    subscribe(eventName: string, callback: EventCallback) {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, new Set());
        }
        this.subscribers.get(eventName)!.add(callback);

        // return unsubscribe function
        return () => {
            const subs = this.subscribers.get(eventName);
            if (subs) {
                subs.delete(callback);
            }
        };
    }

    private notifySubscribers(eventName: string, data: any) {
        const subs = this.subscribers.get(eventName);
        if (subs) {
            subs.forEach(cb => cb(data));
        }
    }

    sendMessage(payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        } else {
            console.warn('WebSocket is not connected. Message dropped.');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const wsClient = new WebSocketClient();

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
