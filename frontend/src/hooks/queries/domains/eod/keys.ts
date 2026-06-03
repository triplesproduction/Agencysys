export const eodKeys = {
    all: ['eod'] as const,
    myEODs: (employeeId?: string) => [...eodKeys.all, 'my', employeeId] as const,
    logs: (startDate: string, endDate: string, employeeId?: string) => [...eodKeys.all, 'logs', startDate, endDate, employeeId] as const,
};
