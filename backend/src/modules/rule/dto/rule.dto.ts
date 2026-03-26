import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum RuleCategory {
    HR = 'HR',
    Attendance = 'Attendance',
    Work_Policy = 'Work Policy',
    Leave = 'Leave',
    Security = 'Security',
}

export enum RulePriority {
    Normal = 'Normal',
    Important = 'Important',
    Critical = 'Critical',
}

export class CreateRuleDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ enum: RuleCategory })
    @IsEnum(RuleCategory)
    @IsNotEmpty()
    category: string;

    @ApiProperty({ enum: RulePriority })
    @IsEnum(RulePriority)
    @IsNotEmpty()
    priority: string;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    effectiveDate?: string;
}

export class UpdateRuleDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false, enum: RuleCategory })
    @IsEnum(RuleCategory)
    @IsOptional()
    category?: string;

    @ApiProperty({ required: false, enum: RulePriority })
    @IsEnum(RulePriority)
    @IsOptional()
    priority?: string;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    effectiveDate?: string;
}
