import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDateString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateLeaveDto {
    @ApiProperty({ enum: ['SICK', 'CASUAL', 'EARNED', 'UNPAID'] })
    @IsEnum(['SICK', 'CASUAL', 'EARNED', 'UNPAID'])
    @IsNotEmpty()
    leaveType: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    endDate: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    reason: string;
}

export class UpdateLeaveStatusDto {
    @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'CANCELLED'] })
    @IsEnum(['APPROVED', 'REJECTED', 'CANCELLED'])
    @IsNotEmpty()
    status: string;
}

export class LeaveResponseDto extends CreateLeaveDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    employeeId: string;

    @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] })
    status: string;

    @ApiPropertyOptional()
    approverId?: string;

    @ApiProperty()
    appliedAt: Date;
}
