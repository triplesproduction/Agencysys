import { PrismaService } from '../../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
export declare class NotificationService {
    private prisma;
    private gateway;
    private readonly logger;
    constructor(prisma: PrismaService, gateway: NotificationGateway);
    createNotification(data: {
        recipientId: string;
        title: string;
        message: string;
        type: string;
        metadata?: any;
    }): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        message: string;
        type: string;
        metadata: string | null;
        read: boolean;
        recipientId: string;
    }>;
    getUnreadForUser(userId: string): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        message: string;
        type: string;
        metadata: string | null;
        read: boolean;
        recipientId: string;
    }[]>;
    markAsRead(notificationId: string): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        message: string;
        type: string;
        metadata: string | null;
        read: boolean;
        recipientId: string;
    }>;
}
