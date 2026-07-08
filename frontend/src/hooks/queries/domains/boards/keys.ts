export const boardKeys = {
    all: ['boards'] as const,
    list: () => [...boardKeys.all, 'list'] as const,
    detail: (id: string) => [...boardKeys.all, 'detail', id] as const,
};
