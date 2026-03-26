import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/task.dto';
import { ActivityService } from '../activity/activity.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TaskService {
    constructor(
        private prisma: PrismaService,
        private activityService: ActivityService,
        private notificationService: NotificationService
    ) { }

    async findAll(assigneeId?: string, status?: string) {
        const where: any = {};
        if (assigneeId) where.assigneeId = assigneeId;
        if (status) where.status = status;

        return this.prisma.task.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                assignee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePhoto: true
                    }
                }
            }
        });
    }

    async create(creatorId: string, data: CreateTaskDto) {
        const createdTasks = [];

        for (const assigneeId of data.assigneeIds) {
            const task = await this.prisma.task.create({
                data: {
                    title: data.title,
                    description: data.description,
                    instructions: data.instructions,
                    assigneeId: assigneeId,
                    priority: data.priority,
                    expectedHours: data.expectedHours,
                    estimatedHours: data.estimatedHours,
                    startDate: data.startDate ? new Date(data.startDate) : undefined,
                    dueDate: new Date(data.dueDate),
                    creatorId: creatorId,
                    managerId: data.managerId,
                    status: data.status || 'TODO',
                    attachments: data.attachments || [],
                },
            });

            // Anti-Gravity real-time dispatch to the assigned employee
            this.notificationService.createNotification({
                recipientId: task.assigneeId,
                title: 'New Task Assigned',
                message: `You have been assigned: ${task.title}`,
                type: 'TASK_ASSIGNED',
                metadata: { taskId: task.id, priority: task.priority },
            }).catch(err => console.error('Failed to dispatch WS notification to Assignee:', err));

            // Anti-Gravity real-time dispatch to the Manager (if configured)
            if (task.managerId) {
                this.notificationService.createNotification({
                    recipientId: task.managerId,
                    title: 'Task Delegation Logged',
                    message: `Task assigned to Team Member for: ${task.title}`,
                    type: 'TASK_ASSIGNED',
                    metadata: { taskId: task.id },
                }).catch(err => console.error('Failed to dispatch WS notification to Manager:', err));
            }

            createdTasks.push(task);
        }

        return createdTasks;
    }

    async updateStatus(id: string, status: string) {
        const task = await this.prisma.task.findUnique({ where: { id } });
        if (!task) {
            throw new NotFoundException(`Task with ID ${id} not found`);
        }

        const updated = await this.prisma.task.update({
            where: { id },
            data: { status },
        });

        // Async dispatch to ActivityLog tracking
        this.activityService.logActivity(
            updated.assigneeId,
            'TASK_UPDATED',
            { taskId: id, newStatus: status, title: updated.title }
        ).catch(err => console.error('Failed to log task activity:', err));

        // Let the creator / manager know if it's SUBMITTED, APPROVED, or REJECTED
        if (['SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED_DEADLINE'].includes(status)) {
            const targetNotifierObj = updated.managerId ? updated.managerId : updated.creatorId;

            // Only trigger the reverse-dispatch if the submitter is NOT the notifier (i.e. if the admin is dragging a card, don't ping them)
            this.notificationService.createNotification({
                recipientId: targetNotifierObj,
                title: `Task Status: ${status}`,
                message: `Task execution updated to ${status}: ${updated.title}`,
                type: 'TASK_UPDATED',
                metadata: { taskId: updated.id, newStatus: status },
            }).catch(err => console.error('Failed to notify manager of task update', err));

            // Also ping the Assignee of the verdict
            this.notificationService.createNotification({
                recipientId: updated.assigneeId,
                title: `Task Moved to: ${status}`,
                message: `Manager updated your task to ${status}`,
                type: 'TASK_UPDATED',
                metadata: { taskId: updated.id, newStatus: status },
            }).catch(err => console.error('Failed to notify assignee of task update', err));

            // Update KPI for Missed Deadline vs On Time
            if (status === 'MISSED_DEADLINE') {
                // Fetch and decrease KPI (mock KPI deduction logic via Prisma transaction)
                this.prisma.kPIMetric.updateMany({
                    where: { employeeId: updated.assigneeId, metricName: 'Completion Rate' },
                    data: { currentValue: { decrement: 5 } }
                }).catch(err => console.error('Failed to decrement KPI metric based on MISSED_DEADLINE', err));

                this.notificationService.createNotification({
                    recipientId: updated.assigneeId,
                    title: `KPI Penalty: Deadline Missed`,
                    message: `Task ${updated.title} missed the deadline. -5 points.`,
                    type: 'DEADLINE_MISSED',
                }).catch(err => { });
            }

            if (status === 'APPROVED') {
                this.prisma.kPIMetric.updateMany({
                    where: { employeeId: updated.assigneeId, metricName: 'Completion Rate' },
                    data: { currentValue: { increment: 2 } }
                }).catch(err => console.error('Failed to increment KPI metric based on APPROVED status', err));
            }
        }

        return updated;
    }
}
