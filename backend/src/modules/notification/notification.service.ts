import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private prisma: PrismaService,
        private gateway: NotificationGateway,
    ) { }

    async createNotification(data: {
        recipientId: string;
        title: string;
        message: string;
        type: string;
        metadata?: any;
    }) {
        // 1. Persist to Postgres
        const notification = await this.prisma.notification.create({
            data: {
                recipientId: data.recipientId,
                title: data.title,
                message: data.message,
                type: data.type,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            },
        });

        this.logger.log(`Created Notification [${notification.type}] for User ${notification.recipientId}`);

        // 2. Dispatch via WebSocket if the user is currently online
        this.gateway.sendNotificationToUser(data.recipientId, notification);

        return notification;
    }

    async createBroadcastNotification(data: {
        title: string;
        message: string;
        type: string;
        metadata?: any;
    }) {
        const employees = await this.prisma.employee.findMany();

        await this.prisma.notification.createMany({
            data: employees.map(emp => ({
                recipientId: emp.id,
                title: data.title,
                message: data.message,
                type: data.type,
                read: false,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            }))
        });

        this.logger.log(`Created Broadcast Notification [${data.type}] for ${employees.length} users`);

        this.gateway.broadcastNotification({
            id: `broadcast-${Date.now()}`,
            title: data.title,
            message: data.message,
            type: data.type,
            createdAt: new Date(),
            metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        });

        return { success: true, count: employees.length };
    }

    async getUnreadForUser(userId: string) {
        return this.prisma.notification.findMany({
            where: {
                recipientId: userId,
                read: false,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    async markAsRead(notificationId: string) {
        return this.prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
    }
}
