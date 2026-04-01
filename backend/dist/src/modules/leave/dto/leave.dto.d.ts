export declare class CreateLeaveDto {
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
}
export declare class UpdateLeaveStatusDto {
    status: string;
}
export declare class LeaveResponseDto extends CreateLeaveDto {
    id: string;
    employeeId: string;
    status: string;
    approverId?: string;
    appliedAt: Date;
}
