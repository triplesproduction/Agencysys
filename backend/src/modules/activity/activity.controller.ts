import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Activity Logs')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) { }

  @Get(':employeeId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve the chronological activity timeline for a specific employee' })
  @ApiResponse({ status: 200, description: 'List of activity logs' })
  async findByEmployee(@Param('employeeId') employeeId: string) {
    const data = await this.activityService.findByEmployee(employeeId);
    return { data, message: 'Activity timeline retrieved successfully' };
  }
}
