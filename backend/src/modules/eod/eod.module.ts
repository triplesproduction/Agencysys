import { Module } from '@nestjs/common';
import { EodService } from './eod.service';
import { EodController } from './eod.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [PrismaModule, ActivityModule, NotificationModule],
    providers: [EodService],
    controllers: [EodController]
})
export class EodModule { }
