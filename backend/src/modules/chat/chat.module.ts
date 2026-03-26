import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, ActivityModule, NotificationModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule { }
