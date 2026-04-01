export declare class CreateEodDto {
    employeeId?: string;
    reportDate: string;
    tasksCompleted: string[];
    tasksInProgress: string[];
    blockers?: string;
    sentiment?: string;
}
export declare class EodResponseDto extends CreateEodDto {
    id: string;
    employeeId: string;
    submittedAt: Date;
}
