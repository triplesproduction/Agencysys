import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkHourDto } from './dto/work-hour.dto';

@Injectable()
export class WorkHourService {
    constructor(private prisma: PrismaService) { }

    async create(employeeId: string, data: CreateWorkHourDto) {
        return this.prisma.workHourLog.create({
            data: {
                employeeId,
                date: new Date(data.date),
                hoursLogged: data.hoursLogged,
                description: data.description,
                taskId: data.taskId,
            },
        });
    }
}
