import { LeaveService } from './leave.service';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/leave.dto';
export declare class LeaveController {
    private readonly leaveService;
    constructor(leaveService: LeaveService);
    applyLeave(user: any, createLeaveDto: CreateLeaveDto): Promise<{
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
    getMyLeaves(user: any): Promise<{
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
    updateStatus(user: any, id: string, updateDto: UpdateLeaveStatusDto): Promise<{
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
