import { Module } from '@nestjs/common';
import { WorkHourController } from './work-hour.controller';
import { WorkHourService } from './work-hour.service';

@Module({
    controllers: [WorkHourController],
    providers: [WorkHourService],
    exports: [WorkHourService],
})
export class WorkHourModule { }
