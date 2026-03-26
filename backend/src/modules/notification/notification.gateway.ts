import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationGateway.name);

    // Map to store connected clients: Map<userId, socketId>
    // In a multi-instance scaling setup, consider Redis adapter
    private userSockets = new Map<string, string>();

    handleConnection(client: Socket) {
        // Expected Client setup: socket.connect({ query: { userId: 'xxx' } })
        const userId = client.handshake.query.userId as string;

        if (userId) {
            this.userSockets.set(userId, client.id);
            this.logger.log(`Client Connected: ${userId} -> SocketID: ${client.id}`);
        } else {
            this.logger.warn(`Client connected without userId payload: ${client.id}`);
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.handshake.query.userId as string;
        if (userId) {
            this.userSockets.delete(userId);
            this.logger.log(`Client Disconnected: ${userId}`);
        }
    }

    sendNotificationToUser(userId: string, payload: any) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('notification', payload);
            this.logger.debug(`Real-time dispatch to ${userId} successful.`);
        } else {
            // User is offline; they will pull the DB on next login
            this.logger.debug(`User ${userId} offline. Skipping live emit.`);
        }
    }

    broadcastNotification(payload: any) {
        this.server.emit('notification', payload);
        this.logger.debug(`Broadcasted real-time notification to all connected clients.`);
    }
}
