import { PrismaService } from '../../prisma/prisma.service';
export declare class KpiService {
    private prisma;
    constructor(prisma: PrismaService);
    findByEmployee(employeeId: string): Promise<{
        id: string;
        employeeId: string;
        metricName: string;
        targetValue: number;
        currentValue: number;
        period: string;
        lastUpdated: Date;
    }[]>;
}
