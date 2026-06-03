export const dashboardKeys = {
    all: ['dashboard'] as const,
    rules: () => [...dashboardKeys.all, 'rules'] as const,
    announcements: () => [...dashboardKeys.all, 'announcements'] as const,
};
