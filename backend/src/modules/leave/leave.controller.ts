import { Controller, Get, Post, Patch, Body, Param, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, UpdateLeaveStatusDto, LeaveResponseDto } from './dto/leave.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('Leaves')
@Controller('leaves')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeaveController {
    constructor(private readonly leaveService: LeaveService) { }

    @Post()
    @ApiOperation({ summary: 'Apply for leave' })
    @ApiResponse({ status: 201, type: LeaveResponseDto })
    async applyLeave(
        @CurrentUser() user: any,
        @Body(new ValidationPipe()) createLeaveDto: CreateLeaveDto,
    ) {
        return this.leaveService.create(user.id, createLeaveDto);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get current user\'s leave applications' })
    @ApiResponse({ status: 200, type: [LeaveResponseDto] })
    async getMyLeaves(@CurrentUser() user: any) {
        return this.leaveService.findByEmployee(user.id);
    }

    @Get()
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Get all leave applications (Admin/Manager)' })
    @ApiResponse({ status: 200, type: [LeaveResponseDto] })
    async getAllLeaves() {
        return this.leaveService.findAll();
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update leave status (Approve/Reject/Cancel)' })
    @ApiResponse({ status: 200, type: LeaveResponseDto })
    async updateStatus(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body(new ValidationPipe()) updateDto: UpdateLeaveStatusDto,
    ) {
        return this.leaveService.updateStatus(id, updateDto.status, user.id);
    }

    @Patch(':id/approve')
    @ApiOperation({ summary: 'Approve or reject a leave (alias for PATCH /status)' })
    @ApiResponse({ status: 200, type: LeaveResponseDto })
    async approveLeave(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body(new ValidationPipe()) updateDto: UpdateLeaveStatusDto,
    ) {
        return this.leaveService.updateStatus(id, updateDto.status, user.id);
    }
}
