export const messagingKeys = {
    all: ['messaging'] as const,
    conversations: (userId: string) => [...messagingKeys.all, 'conversations', userId] as const,
    messages: (conversationId: string) => [...messagingKeys.all, 'messages', conversationId] as const,
};
