import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';
export declare class TaskController {
    private readonly taskService;
    constructor(taskService: TaskService);
    getTasks(assigneeId?: string, status?: string): Promise<{
        id: string;
        status: string;
        title: string;
        description: string | null;
        instructions: string | null;
        priority: string;
        startDate: Date | null;
        dueDate: Date;
        expectedHours: number | null;
        estimatedHours: number | null;
        attachments: string[];
        createdAt: Date;
        assigneeId: string;
        creatorId: string;
        managerId: string | null;
    }[]>;
    createTask(user: any, createTaskDto: CreateTaskDto): Promise<{
        id: string;
        status: string;
        title: string;
        description: string | null;
        instructions: string | null;
        priority: string;
        startDate: Date | null;
        dueDate: Date;
        expectedHours: number | null;
        estimatedHours: number | null;
        attachments: string[];
        createdAt: Date;
        assigneeId: string;
        creatorId: string;
        managerId: string | null;
    }>;
    updateStatus(id: string, updateDto: UpdateTaskStatusDto): Promise<{
        id: string;
        status: string;
        title: string;
        description: string | null;
        instructions: string | null;
        priority: string;
        startDate: Date | null;
        dueDate: Date;
        expectedHours: number | null;
        estimatedHours: number | null;
        attachments: string[];
        createdAt: Date;
        assigneeId: string;
        creatorId: string;
        managerId: string | null;
    }>;
}
