import { ChatService } from './chat.service';
import { ActivityService } from '../activity/activity.service';
export declare class ChatController {
    private readonly chatService;
    private readonly activityService;
    constructor(chatService: ChatService, activityService: ActivityService);
    sendMessage(body: {
        senderId: string;
        receiverId: string;
        content: string;
    }): Promise<{
        id: string;
        attachments: string[];
        content: string;
        senderId: string;
        receiverId: string | null;
        channelId: string | null;
        sentAt: Date;
    }>;
    getAdminAllChats(req: any): Promise<{
        data: {
            content: string;
            id: string;
            attachments: string[];
            senderId: string;
            receiverId: string | null;
            channelId: string | null;
            sentAt: Date;
        }[];
        message: string;
    }>;
}
