export declare class CreateEmployeeDto {
    id?: string;
    password?: string;
    firstName: string;
    lastName: string;
    email: string;
    roleId: string;
    department?: string;
}
export declare class EmployeeResponseDto {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roleId: string;
    department?: string;
    status: string;
    joinedAt: Date;
}
