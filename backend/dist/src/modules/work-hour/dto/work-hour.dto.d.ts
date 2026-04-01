export declare class CreateWorkHourDto {
    taskId?: string;
    date: string;
    hoursLogged: number;
    description?: string;
}
export declare class WorkHourResponseDto extends CreateWorkHourDto {
    id: string;
    employeeId: string;
    loggedAt: Date;
}
