export declare class CreateTaskDto {
    title: string;
    description?: string;
    instructions?: string;
    assigneeId: string;
    creatorId?: string;
    managerId?: string;
    status?: string;
    priority: string;
    dueDate: string;
    expectedHours?: number;
    estimatedHours?: number;
    attachments?: string[];
}
export declare class UpdateTaskStatusDto {
    status: string;
}
export declare class TaskResponseDto extends CreateTaskDto {
    id: string;
    createdAt: Date;
}
