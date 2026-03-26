import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { KpiService } from './kpi.service';
import { KpiMetricResponseDto } from './dto/kpi.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('KPI Metrics')
@Controller('kpis')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class KpiController {
    constructor(private readonly kpiService: KpiService) { }

    @Get('employees/:id')
    @ApiOperation({ summary: 'Get KPI metrics for a particular employee' })
    @ApiResponse({ status: 200, type: [KpiMetricResponseDto] })
    async getEmployeeKPIs(@Param('id') employeeId: string) {
        return this.kpiService.findByEmployee(employeeId);
    }

    @Post('trigger')
    @ApiOperation({ summary: 'Trigger a manual KPI calculation for test purposes' })
    @ApiResponse({ status: 200, description: 'KPI calculation triggered successfully' })
    async triggerKpiCalculation() {
        return {
            message: 'KPI calculation triggered (Mocked for Phase 1 Testing)',
            timestamp: new Date().toISOString(),
        };
    }
}
