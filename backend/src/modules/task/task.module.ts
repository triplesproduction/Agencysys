import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [PrismaModule, ActivityModule, NotificationModule],
    providers: [TaskService],
    controllers: [TaskController],
})
export class TaskModule { }
