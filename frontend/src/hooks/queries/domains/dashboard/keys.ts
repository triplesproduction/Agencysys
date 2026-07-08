export const dashboardKeys = {
    all: ['dashboard'] as const,
    rules: () => [...dashboardKeys.all, 'rules'] as const,
    announcements: () => [...dashboardKeys.all, 'announcements'] as const,
    tasks: (role: string, employeeId?: string) => [...dashboardKeys.all, 'tasks', role, employeeId] as const,
    employees: () => [...dashboardKeys.all, 'employees'] as const,
    eods: (role: string, employeeId?: string) => [...dashboardKeys.all, 'eods', role, employeeId] as const,
    kpiProfiles: (role: string, employeeId?: string) => [...dashboardKeys.all, 'kpiProfiles', role, employeeId] as const,
    kpiAuditLogs: (role: string, employeeId?: string) => [...dashboardKeys.all, 'kpiAuditLogs', role, employeeId] as const,
    monthlyHours: (employeeId?: string) => [...dashboardKeys.all, 'monthlyHours', employeeId] as const,
    recentWorkHours: (employeeId?: string) => [...dashboardKeys.all, 'recentWorkHours', employeeId] as const,
    unreadCount: (employeeId?: string) => [...dashboardKeys.all, 'unreadCount', employeeId] as const,
};
