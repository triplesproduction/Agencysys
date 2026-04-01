import { PrismaService } from '../../prisma/prisma.service';
export declare class ActivityService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    logActivity(employeeId: string, action: string, metadata?: any): Promise<{
        id: string;
        employeeId: string;
        action: string;
        metadata: string | null;
        timestamp: Date;
    }>;
    findByEmployee(employeeId: string): Promise<{
        id: string;
        employeeId: string;
        action: string;
        metadata: string | null;
        timestamp: Date;
    }[]>;
}
