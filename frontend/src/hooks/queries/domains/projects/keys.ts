export const projectKeys = {
    all: ['projects'] as const,
    list: (userId?: string) => [...projectKeys.all, 'list', userId] as const,
    detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

export const taskKeys = {
    all: ['tasks'] as const,
    list: (assigneeId?: string, status?: string, projectId?: string, limit?: number) => [...taskKeys.all, 'list', assigneeId, status, projectId, limit] as const,
};
