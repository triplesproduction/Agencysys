import { PrismaService } from '../../prisma/prisma.service';
import { CreateEodDto } from './dto/eod.dto';
import { ActivityService } from '../activity/activity.service';
export declare class EodService {
    private prisma;
    private activityService;
    constructor(prisma: PrismaService, activityService: ActivityService);
    create(employeeId: string, data: CreateEodDto): Promise<{
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
    findByEmployee(employeeId: string): Promise<({
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
