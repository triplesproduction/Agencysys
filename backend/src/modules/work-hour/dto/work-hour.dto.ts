import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateWorkHourDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    taskId?: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    date: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    hoursLogged: number;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;
}

export class WorkHourResponseDto extends CreateWorkHourDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    employeeId: string;

    @ApiProperty()
    loggedAt: Date;
}
