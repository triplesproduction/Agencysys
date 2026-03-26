import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEodDto } from './dto/eod.dto';
import { ActivityService } from '../activity/activity.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EodService {
    constructor(
        private prisma: PrismaService,
        private activityService: ActivityService,
        private notificationService: NotificationService
    ) { }

    async create(employeeId: string, data: CreateEodDto) {
        // Find tasks by title or assume they are IDs if they look like UUIDs
        // This makes it compatible with both UI mock titles and real backend IDs
        const findTasks = async (identifiers: string[]) => {
            if (!identifiers || identifiers.length === 0) return [];
            return this.prisma.task.findMany({
                where: { OR: [{ id: { in: identifiers } }, { title: { in: identifiers } }] },
                select: { id: true }
            });
        };

        const completedTasks = await findTasks(data.tasksCompleted);
        const inProgressTasks = await findTasks(data.tasksInProgress);

        const createdEod = await this.prisma.eODSubmission.create({
            data: {
                employeeId,
                reportDate: new Date(data.reportDate),
                blockers: data.blockers,
                sentiment: data.sentiment,
                completedText: data.tasksCompleted?.length > 0 ? JSON.stringify(data.tasksCompleted) : null,
                inProgressText: data.tasksInProgress?.length > 0 ? JSON.stringify(data.tasksInProgress) : null,
                tasksCompleted: {
                    connect: completedTasks,
                },
                tasksInProgress: {
                    connect: inProgressTasks,
                },
            },
            include: {
                tasksCompleted: true,
                tasksInProgress: true,
                employee: { select: { firstName: true, lastName: true } }
            }
        });

        // Async dispatch to ActivityLog tracking
        this.activityService.logActivity(
            employeeId,
            'EOD_SUBMITTED',
            { eodId: createdEod.id, sentiment: createdEod.sentiment }
        ).catch(err => console.error('Failed to log EOD activity:', err));

        // Async notify Admins
        this.prisma.employee.findMany({ where: { roleId: 'ADMIN' }, select: { id: true } })
            .then(admins => {
                const empName = `${createdEod.employee?.firstName || 'Unknown'} ${createdEod.employee?.lastName || 'Employee'}`;
                admins.forEach(admin => {
                    this.notificationService.createNotification({
                        recipientId: admin.id,
                        title: 'New EOD Submitted',
                        message: `${empName} has successfully submitted their End of Day report.`,
                        type: 'EOD_SUBMITTED',
                        metadata: { eodId: createdEod.id }
                    }).catch(err => console.error('Failed to send EOD notification:', err));
                });
            })
            .catch(err => console.error('Failed to lookup admins for EOD notification:', err));

        return createdEod;
    }

    async findByEmployee(employeeId: string) {
        return this.prisma.eODSubmission.findMany({
            where: { employeeId },
            orderBy: { reportDate: 'desc' },
            include: {
                tasksCompleted: true,
                tasksInProgress: true,
            }
        });
    }

    async updateSentiment(id: string, sentiment: string) {
        const updated = await this.prisma.eODSubmission.update({
            where: { id },
            data: { sentiment },
            include: {
                employee: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        // Notify employee
        if (updated.employeeId) {
            const reportDate = updated.reportDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            this.notificationService.createNotification({
                recipientId: updated.employeeId,
                title: 'EOD Performance Rated',
                message: `Your EOD report for ${reportDate} has been rated as ${sentiment} by an admin.`,
                type: 'SYSTEM',
                metadata: { eodId: updated.id }
            }).catch(err => console.error('Failed to notify employee of EOD rating:', err));
        }

        return updated;
    }

    async findAll() {
        return this.prisma.eODSubmission.findMany({
            orderBy: { reportDate: 'desc' },
            include: {
                tasksCompleted: { select: { id: true, title: true } },
                tasksInProgress: { select: { id: true, title: true } },
                employee: { select: { id: true, firstName: true, lastName: true, department: true, roleId: true } }
            }
        });
        // Note: completedText and inProgressText are scalar fields, so they are returned by default
    }
}
