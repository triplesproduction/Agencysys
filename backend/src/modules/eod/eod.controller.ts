import { Controller, Get, Post, Body, UseGuards, ValidationPipe, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EodService } from './eod.service';
import { CreateEodDto, EodResponseDto } from './dto/eod.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('EOD Reports')
@Controller('eod-reports')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class EodController {
    constructor(private readonly eodService: EodService) { }

    @Post()
    @ApiOperation({ summary: 'Submit a new EOD report' })
    @ApiResponse({ status: 201, type: EodResponseDto })
    async submitEod(
        @CurrentUser() user: any,
        @Body(new ValidationPipe()) createEodDto: CreateEodDto,
    ) {
        return this.eodService.create(user.id, createEodDto);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get current users EOD reports' })
    @ApiResponse({ status: 200, type: [EodResponseDto] })
    async getMyEods(@CurrentUser() user: any) {
        return this.eodService.findByEmployee(user.id);
    }

    @Get()
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Get all EOD reports (Admin Only)' })
    async getAllEods() {
        return this.eodService.findAll();
    }

    @Patch(':id/sentiment')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update EOD sentiment rating (Admin Only)' })
    async updateSentiment(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body('sentiment') sentiment: string
    ) {
        return this.eodService.updateSentiment(id, sentiment);
    }
}
