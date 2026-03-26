import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) { }

  async logActivity(employeeId: string, action: string, metadata?: any) {
    return this.prisma.activityLog.create({
      data: {
        employeeId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    });
  }

  async findByEmployee(employeeId: string) {
    return this.prisma.activityLog.findMany({
      where: { employeeId },
      orderBy: { timestamp: 'desc' },
      take: 100 // Reasonable limit for the UI chronological list
    });
  }
}
