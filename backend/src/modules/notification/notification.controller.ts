import { Controller, Post, Body, UseGuards, Request, Get, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Post('broadcast')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Broadcast a notification to everyone (Admin Only)' })
    async broadcast(@Body() data: { title: string; message: string; type: string; metadata?: any }) {
        return this.notificationService.createBroadcastNotification(data);
    }

    @Get()
    @ApiOperation({ summary: 'Get unread notifications for the active user' })
    async getMyNotifications(@Request() req: any) {
        const userId = req.user.sub || req.user.employeeId;
        return this.notificationService.getUnreadForUser(userId);
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark a notification as read' })
    async markAsRead(@Param('id') id: string) {
        return this.notificationService.markAsRead(id);
    }
}
