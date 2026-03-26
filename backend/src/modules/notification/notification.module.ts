import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [NotificationController],
    providers: [NotificationGateway, NotificationService],
    exports: [NotificationService, NotificationGateway],
})
export class NotificationModule { }
