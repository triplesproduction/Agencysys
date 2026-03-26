import { Controller, Get, Post, Body, UseGuards, Req, Param, Delete, Query, ValidationPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { ActivityService } from '../activity/activity.service';
import { SendMessageDto } from './dto/chat.dto';

@ApiTags('Chat Oversight & Messaging')
@Controller('chats')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly activityService: ActivityService
  ) { }

  @Post('send')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a new encrypted message' })
  async sendMessage(
    @CurrentUser() user: any,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: SendMessageDto
  ) {
    try {
      if (!user?.id) {
        console.warn('SendMessage: User ID missing from token. User object:', user);
        throw new Error('Authentication context corrupted. User ID missing.');
      }
      return await this.chatService.sendMessage(user.id, body.receiverId, body.content.trim());
    } catch (err) {
      console.error('SendMessage API Error:', err.message);
      throw err;
    }
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user chats' })
  @ApiResponse({ status: 200, description: 'User personal message threads' })
  async getMyChats(@CurrentUser() user: any) {
    try {
      const chats = await this.chatService.getMyChats(user.id);
      return { data: chats };
    } catch (err: any) {
      console.error('Controller getMyChats error:', err);
      throw err;
    }
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin Read-Only Oversight view of all conversations. Pings the Audit Trail.' })
  @ApiResponse({ status: 200, description: 'All decrypted system-wide chats' })
  async getAdminAllChats(@Req() req: any) {
    const adminId = req.user?.userId; // Sourced from JWT guard mapping

    // Strictly track this invasive access
    if (adminId) {
      this.activityService.logActivity(adminId, 'ADMIN_CHAT_VIEW', `Manager/Admin accessed the global chat oversight dashboard.`).catch(err => console.error(err));
    }

    const chats = await this.chatService.getAdminAllChats();
    return { data: chats, message: 'Admin oversight activated. Messages decrypted.' };
  }

  @Post(':id/delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a message' })
  async deleteMessage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { forEveryone?: boolean }
  ) {
    const isForEveryone = body.forEveryone === true;
    return this.chatService.deleteMessage(id, user.id, isForEveryone);
  }
}
