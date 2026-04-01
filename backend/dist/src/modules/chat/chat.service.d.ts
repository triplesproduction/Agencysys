import { PrismaService } from '../../prisma/prisma.service';
export declare class ChatService {
    private prisma;
    private readonly logger;
    private readonly algorithm;
    private readonly secretKey;
    constructor(prisma: PrismaService);
    encrypt(text: string): {
        encryptedText: string;
        iv: string;
        authTag: string;
    };
    decrypt(encryptedText: string, iv: string, authTag: string): string;
    sendMessage(senderId: string, receiverId: string, content: string): Promise<{
        id: string;
        attachments: string[];
        content: string;
        senderId: string;
        receiverId: string | null;
        channelId: string | null;
        sentAt: Date;
    }>;
    getAdminAllChats(): Promise<{
        content: string;
        id: string;
        attachments: string[];
        senderId: string;
        receiverId: string | null;
        channelId: string | null;
        sentAt: Date;
    }[]>;
}
