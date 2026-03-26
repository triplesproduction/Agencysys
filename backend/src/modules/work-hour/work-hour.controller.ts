import { Controller, Post, Body, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkHourService } from './work-hour.service';
import { CreateWorkHourDto, WorkHourResponseDto } from './dto/work-hour.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('Work Hours')
@Controller('work-hours')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class WorkHourController {
    constructor(private readonly workHourService: WorkHourService) { }

    @Post()
    @ApiOperation({ summary: 'Log work hours' })
    @ApiResponse({ status: 201, type: WorkHourResponseDto })
    async logWorkHours(
        @CurrentUser() user: any,
        @Body(new ValidationPipe()) createWorkHourDto: CreateWorkHourDto,
    ) {
        return this.workHourService.create(user.id, createWorkHourDto);
    }
}
