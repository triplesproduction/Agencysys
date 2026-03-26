import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class CreateTaskDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'title is required.' })
    title: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'description is required.' })
    description: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    instructions?: string;

    @ApiProperty({ description: 'List of Employee IDs to assign the task to' })
    @IsArray({ message: 'assignedTo must be an array of IDs.' })
    @IsString({ each: true, message: 'Each assignedTo ID must be a string.' })
    @ArrayMinSize(1, { message: 'assignedTo is required and cannot be empty.' })
    assigneeIds: string[];

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    creatorId?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    managerId?: string;

    @ApiPropertyOptional({ enum: ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED_DEADLINE'] })
    @IsEnum(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED_DEADLINE'])
    @IsOptional()
    status?: string;

    @ApiProperty({ description: 'Priority level', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
    @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], { message: 'priority must be LOW, MEDIUM, HIGH, or CRITICAL.' })
    @IsNotEmpty({ message: 'priority is required.' })
    priority: string;

    @ApiProperty({ description: 'Start Date (ISO String)', required: false })
    @IsOptional()
    @IsDateString({}, { message: 'startDate must be a valid ISO date string.' })
    startDate?: string;

    @ApiProperty({ description: 'Due Date (ISO String)' })
    @IsDateString({}, { message: 'deadline must be a valid ISO date string.' })
    @IsNotEmpty({ message: 'deadline is required.' })
    dueDate: string;

    @ApiProperty({ description: 'Expected completion time in hours', required: false })
    @IsOptional()
    @IsNumber()
    expectedHours?: number;

    @ApiProperty({ description: 'Estimated hours originally set', required: false })
    @IsOptional()
    @IsNumber()
    estimatedHours?: number;

    @ApiProperty({ description: 'Array of attachment URLs or filenames', required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    attachments?: string[];
}

export class UpdateTaskStatusDto {
    @ApiProperty({ enum: ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED_DEADLINE'] })
    @IsEnum(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED_DEADLINE'])
    @IsNotEmpty()
    status: string;
}

export class TaskResponseDto extends CreateTaskDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    createdAt: Date;
}
