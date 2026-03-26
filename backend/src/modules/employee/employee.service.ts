import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
    constructor(private prisma: PrismaService) { }

    async getStats() {
        const total = await this.prisma.employee.count();
        const active = await this.prisma.employee.count({ where: { status: 'ACTIVE' } });
        return { total, active };
    }

    async findAll(options?: { skip?: number; take?: number; search?: string; roleId?: string; status?: string; department?: string; sortBy?: string }) {
        const { skip, take, search, roleId, status, department, sortBy } = options || {};

        const where: any = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { id: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (roleId) where.roleId = roleId;
        if (status) where.status = status;
        if (department) where.department = department;

        let orderBy: any = { joinedAt: 'desc' };
        if (sortBy === 'name') orderBy = { firstName: 'asc' };
        if (sortBy === 'kpi') orderBy = { kpis: { _count: 'desc' } }; // Simplified for now
        if (sortBy === 'role') orderBy = { roleId: 'asc' };

        const [data, total] = await Promise.all([
            this.prisma.employee.findMany({
                where,
                skip: skip ? Number(skip) : undefined,
                take: take ? Number(take) : undefined,
                orderBy,
                include: {
                    tasksAssigned: { where: { status: { notIn: ['APPROVED', 'COMPLETED'] } } },
                    kpis: { take: 1, orderBy: { lastUpdated: 'desc' } },
                    leaves: { where: { status: 'APPROVED' } },
                }
            }),
            this.prisma.employee.count({ where })
        ]);

        return { data, total, page: skip && take ? Math.floor(skip / take) + 1 : 1 };
    }

    async findById(id: string) {
        return this.prisma.employee.findUnique({
            where: { id },
            include: {
                documents: true,
                tasksAssigned: true,
                kpis: true,
                leaves: true
            }
        });
    }

    async create(data: any) {
        let employeeId = data.id;

        // Auto-generate ID if not provided manually
        if (!employeeId) {
            const count = await this.prisma.employee.count();
            employeeId = `EMP-${Uint32Array.from([Math.floor(Math.random() * 1000)])[0]}`; // Using random to avoid conflicts in concurrent seeds
        }

        // Check uniqueness constraints
        const existingEmail = await this.prisma.employee.findUnique({ where: { email: data.email } });
        if (existingEmail) {
            throw new ConflictException('An employee with this email already exists.');
        }

        const existingId = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (existingId) {
            throw new ConflictException(`An employee with ID ${employeeId} already exists.`);
        }

        let passwordHash = null;
        if (data.password) {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(data.password, salt);
        }

        return this.prisma.employee.create({
            data: {
                id: employeeId,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                roleId: data.roleId,
                department: data.department || null,
                passwordHash: passwordHash,
                requirePasswordReset: true,
                status: data.status || 'ACTIVE',
                dob: data.dob ? new Date(data.dob) : null,
                gender: data.gender,
                phone: data.phone,
                address: data.address,
                emergencyContact: data.emergencyContact,
                designation: data.designation,
                workLocation: data.workLocation || 'OFFICE',
                joinedAt: data.joinedAt ? new Date(data.joinedAt) : new Date(),
                documents: data.documents ? {
                    create: data.documents.map((doc: any) => ({
                        name: doc.name,
                        fileType: doc.fileType,
                        content: doc.content
                    }))
                } : undefined
            }
        });
    }
    async updateStatus(id: string, status: string) {
        return this.prisma.employee.update({
            where: { id },
            data: { status }
        });
    }

    async update(id: string, data: any) {
        // Remove password from generic update for safety
        const { password, passwordHash, ...safeData } = data;
        return this.prisma.employee.update({
            where: { id },
            data: safeData
        });
    }

    async delete(id: string) {
        return this.prisma.employee.delete({ where: { id } });
    }
}
