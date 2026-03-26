import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KpiService {
    constructor(private prisma: PrismaService) { }

    async findByEmployee(employeeId: string) {
        return this.prisma.kPIMetric.findMany({
            where: { employeeId },
            orderBy: { lastUpdated: 'desc' },
        });
    }
}
