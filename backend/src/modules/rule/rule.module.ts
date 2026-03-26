import { Module } from '@nestjs/common';
import { RuleController } from './rule.controller';
import { RuleService } from './rule.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [PrismaModule, NotificationModule],
    controllers: [RuleController],
    providers: [RuleService],
})
export class RuleModule { }
