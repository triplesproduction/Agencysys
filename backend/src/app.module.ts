import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { TaskModule } from './modules/task/task.module';
import { EodModule } from './modules/eod/eod.module';
import { WorkHourModule } from './modules/work-hour/work-hour.module';
import { LeaveModule } from './modules/leave/leave.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './health/health.controller';
import { ActivityModule } from './modules/activity/activity.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { RuleModule } from './modules/rule/rule.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
    imports: [
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
        PrismaModule,
        EmployeeModule,
        TaskModule,
        EodModule,
        WorkHourModule,
        LeaveModule,
        KpiModule,
        AuthModule,
        ActivityModule,
        ChatModule,
        NotificationModule,
        RuleModule,
        AnnouncementModule,
        UploadModule,
    ],
    controllers: [HealthController],
    providers: [],
})
export class AppModule { }
