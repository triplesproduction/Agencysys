export const noteKeys = {
    all: ['notes'] as const,
    list: (employeeId?: string, projectId?: string) => [...noteKeys.all, 'list', employeeId, projectId] as const,
    detail: (id: string) => [...noteKeys.all, 'detail', id] as const,
    projectNotes: (projectId: string) => [...noteKeys.all, 'project', projectId] as const,
};
