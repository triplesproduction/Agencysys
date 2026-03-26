import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveDto } from './dto/leave.dto';

@Injectable()
export class LeaveService {
    constructor(private prisma: PrismaService) { }

    async create(employeeId: string, data: CreateLeaveDto) {
        return this.prisma.leaveApplication.create({
            data: {
                employeeId,
                leaveType: data.leaveType,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                reason: data.reason,
            },
        });
    }

    async findByEmployee(employeeId: string) {
        return this.prisma.leaveApplication.findMany({
            where: { employeeId },
            orderBy: { appliedAt: 'desc' },
        });
    }

    async findAll() {
        return this.prisma.leaveApplication.findMany({
            orderBy: { appliedAt: 'desc' },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, department: true, roleId: true }
                }
            }
        });
    }

    async updateStatus(id: string, status: string, approverId: string) {
        const leave = await this.prisma.leaveApplication.findUnique({ where: { id } });
        if (!leave) {
            throw new NotFoundException(`Leave Application with ID ${id} not found`);
        }

        if (leave.status !== 'PENDING' && status !== 'CANCELLED') {
            throw new BadRequestException(`Cannot transition status from ${leave.status}`);
        }

        return this.prisma.leaveApplication.update({
            where: { id },
            data: {
                status,
                approverId: status === 'APPROVED' || status === 'REJECTED' ? approverId : undefined,
            },
        });
    }
}
