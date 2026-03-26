import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateEmployeeDto {
    @ApiProperty({ required: false, description: 'Optional: Manually defined ID (e.g. EMP-001) or auto-generated if left blank.' })
    @IsString()
    @IsOptional()
    id?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    password?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    roleId: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    department?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    documents?: { name: string; fileType: string; content: string }[];
}

export class EmployeeResponseDto {
    @ApiProperty({ description: 'Unique identifier' })
    id: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    roleId: string;

    @ApiProperty({ required: false })
    department?: string;

    @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'] })
    status: string;

    @ApiProperty()
    joinedAt: Date;
}
