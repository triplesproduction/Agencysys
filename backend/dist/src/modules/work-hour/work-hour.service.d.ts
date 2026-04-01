import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkHourDto } from './dto/work-hour.dto';
export declare class WorkHourService {
    private prisma;
    constructor(prisma: PrismaService);
    create(employeeId: string, data: CreateWorkHourDto): Promise<{
        id: string;
        description: string | null;
        date: Date;
        hoursLogged: number;
        loggedAt: Date;
        employeeId: string;
        taskId: string | null;
    }>;
}
