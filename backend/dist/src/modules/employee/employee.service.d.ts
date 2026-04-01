import { PrismaService } from '../../prisma/prisma.service';
export declare class EmployeeService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        passwordHash: string | null;
        requirePasswordReset: boolean;
        roleId: string;
        department: string | null;
        status: string;
        joinedAt: Date;
    }[]>;
    findById(id: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        passwordHash: string | null;
        requirePasswordReset: boolean;
        roleId: string;
        department: string | null;
        status: string;
        joinedAt: Date;
    }>;
    create(data: any): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        passwordHash: string | null;
        requirePasswordReset: boolean;
        roleId: string;
        department: string | null;
        status: string;
        joinedAt: Date;
    }>;
}
