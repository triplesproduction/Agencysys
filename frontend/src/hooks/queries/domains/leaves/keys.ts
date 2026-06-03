export const leaveKeys = {
    all: ['leaves'] as const,
    lists: () => [...leaveKeys.all, 'list'] as const,
    list: (filters: string) => [...leaveKeys.lists(), { filters }] as const,
    myLeaves: (userId: string) => [...leaveKeys.all, 'my', userId] as const,
    employeeLeaves: (employeeId: string) => [...leaveKeys.all, 'employee', employeeId] as const,
};
