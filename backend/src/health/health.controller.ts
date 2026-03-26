import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {

    @Get()
    @ApiOperation({ summary: 'Runtime Health Check' })
    @ApiResponse({ status: 200, description: 'Backend is fully operational' })
    checkHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'TripleS OS Backend - Phase 1',
        };
    }
}
