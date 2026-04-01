import { EodService } from './eod.service';
import { CreateEodDto } from './dto/eod.dto';
export declare class EodController {
    private readonly eodService;
    constructor(eodService: EodService);
    submitEod(user: any, createEodDto: CreateEodDto): Promise<{
        tasksCompleted: {
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
        }[];
        tasksInProgress: {
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
        }[];
    } & {
        id: string;
        employeeId: string;
        reportDate: Date;
        blockers: string | null;
        sentiment: string | null;
        submittedAt: Date;
    }>;
    getMyEods(user: any): Promise<({
        tasksCompleted: {
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
        }[];
        tasksInProgress: {
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
        }[];
    } & {
        id: string;
        employeeId: string;
        reportDate: Date;
        blockers: string | null;
        sentiment: string | null;
        submittedAt: Date;
    })[]>;
}
