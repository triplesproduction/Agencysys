import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { messagingKeys } from './messagingKeys';

/**
 * Fetches all conversations for the current user.
 * Automatically dedupes requests and caches the result.
 */
export function useConversations(userId: string | undefined, roleId?: string) {
    return useQuery({
        queryKey: userId ? messagingKeys.conversations(userId) : ['messaging', 'conversations', 'fallback'],
        queryFn: async () => {
            if (!userId) return [];
            return await api.getConversations(userId, roleId || '');
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });
}

/**
 * Fetches all messages for a specific conversation.
 * Caches messages separately per conversation ID.
 */
export function useMessages(conversationId: string | undefined) {
    return useQuery({
        queryKey: conversationId ? messagingKeys.messages(conversationId) : ['messaging', 'messages', 'fallback'],
        queryFn: async () => {
            if (!conversationId) return [];
            return await api.getMessages(conversationId);
        },
        enabled: !!conversationId,
        staleTime: 5 * 60 * 1000,
    });
}
