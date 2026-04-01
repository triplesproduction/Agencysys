import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveDto } from './dto/leave.dto';
export declare class LeaveService {
    private prisma;
    constructor(prisma: PrismaService);
    create(employeeId: string, data: CreateLeaveDto): Promise<{
        id: string;
        status: string;
        startDate: Date;
        employeeId: string;
        leaveType: string;
        endDate: Date;
        reason: string;
        appliedAt: Date;
        approverId: string | null;
    }>;
    findByEmployee(employeeId: string): Promise<{
        id: string;
        status: string;
        startDate: Date;
        employeeId: string;
        leaveType: string;
        endDate: Date;
        reason: string;
        appliedAt: Date;
        approverId: string | null;
    }[]>;
    updateStatus(id: string, status: string, approverId: string): Promise<{
        id: string;
        status: string;
        startDate: Date;
        employeeId: string;
        leaveType: string;
        endDate: Date;
        reason: string;
        appliedAt: Date;
        approverId: string | null;
    }>;
}
