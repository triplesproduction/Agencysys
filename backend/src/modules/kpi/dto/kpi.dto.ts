import { ApiProperty } from '@nestjs/swagger';

export class KpiMetricResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    employeeId: string;

    @ApiProperty()
    metricName: string;

    @ApiProperty()
    targetValue: number;

    @ApiProperty()
    currentValue: number;

    @ApiProperty({ enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] })
    period: string;

    @ApiProperty()
    lastUpdated: Date;
}
