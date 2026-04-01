import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/employee.dto';
export declare class EmployeeController {
    private readonly employeeService;
    constructor(employeeService: EmployeeService);
    create(createEmployeeDto: CreateEmployeeDto): Promise<{
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
    findOne(id: string): Promise<{
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
