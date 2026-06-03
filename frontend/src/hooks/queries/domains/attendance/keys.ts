export const attendanceKeys = {
    all: ['attendance'] as const,
    workHours: () => [...attendanceKeys.all, 'workHours'] as const,
    workHoursInRange: (employeeId?: string, startDate?: string, endDate?: string) => [...attendanceKeys.workHours(), { employeeId, startDate, endDate }] as const,
    workHoursByDate: (employeeId: string, date: string) => [...attendanceKeys.workHours(), employeeId, date] as const,
    recentWorkHours: (employeeId: string) => [...attendanceKeys.workHours(), 'recent', employeeId] as const,
    monthlyWorkHours: (employeeId: string, monthYear?: string) => [...attendanceKeys.workHours(), 'monthly', employeeId, monthYear] as const,
    monthlyAttendance: (month: number, year: number) => [...attendanceKeys.all, 'monthly', month, year] as const,
    overrides: (employeeId: string, monthYear: string) => [...attendanceKeys.all, 'overrides', employeeId, monthYear] as const,
    report: (employeeId: string, monthYear: string) => [...attendanceKeys.all, 'report', employeeId, monthYear] as const,
};
