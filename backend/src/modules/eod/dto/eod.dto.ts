import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsEnum, IsArray, IsNotEmpty } from 'class-validator';

export class CreateEodDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    reportDate: string;

    @ApiProperty({ type: [String] })
    @IsArray()
    @IsString({ each: true })
    tasksCompleted: string[];

    @ApiProperty({ type: [String] })
    @IsArray()
    @IsString({ each: true })
    tasksInProgress: string[];

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    blockers?: string;

    @ApiPropertyOptional({ enum: ['GREAT', 'GOOD', 'OKAY', 'BAD', 'TERRIBLE'] })
    @IsEnum(['GREAT', 'GOOD', 'OKAY', 'BAD', 'TERRIBLE'])
    @IsOptional()
    sentiment?: string;
}

export class EodResponseDto extends CreateEodDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    employeeId: string;

    @ApiProperty()
    submittedAt: Date;
}
