"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const activity_service_1 = require("../activity/activity.service");
const notification_service_1 = require("../notification/notification.service");
let TaskService = class TaskService {
    constructor(prisma, activityService, notificationService) {
        this.prisma = prisma;
        this.activityService = activityService;
        this.notificationService = notificationService;
    }
    async findAll(assigneeId, status) {
        const where = {};
        if (assigneeId)
            where.assigneeId = assigneeId;
        if (status)
            where.status = status;
        return this.prisma.task.findMany({ where });
    }
    async create(creatorId, data) {
        const task = await this.prisma.task.create({
            data: {
                title: data.title,
                description: data.description,
                instructions: data.instructions,
                assigneeId: data.assigneeId,
                priority: data.priority,
                expectedHours: data.expectedHours,
                estimatedHours: data.estimatedHours,
                dueDate: new Date(data.dueDate),
                creatorId: creatorId,
                managerId: data.managerId,
                status: data.status || 'TODO',
                attachments: data.attachments || [],
            },
        });
        this.notificationService.createNotification({
            recipientId: task.assigneeId,
            title: 'New Task Assigned',
            message: `You have been assigned: ${task.title}`,
            type: 'TASK_ASSIGNED',
            metadata: { taskId: task.id, priority: task.priority },
        }).catch(err => console.error('Failed to dispatch WS notification to Assignee:', err));
        if (task.managerId) {
            this.notificationService.createNotification({
                recipientId: task.managerId,
                title: 'Task Delegation Logged',
                message: `Task assigned to Team Member for: ${task.title}`,
                type: 'TASK_ASSIGNED',
                metadata: { taskId: task.id },
            }).catch(err => console.error('Failed to dispatch WS notification to Manager:', err));
        }
        return task;
    }
    async updateStatus(id, status) {
        const task = await this.prisma.task.findUnique({ where: { id } });
        if (!task) {
            throw new common_1.NotFoundException(`Task with ID ${id} not found`);
        }
        const updated = await this.prisma.task.update({
            where: { id },
            data: { status },
        });
        this.activityService.logActivity(updated.assigneeId, 'TASK_UPDATED', { taskId: id, newStatus: status, title: updated.title }).catch(err => console.error('Failed to log task activity:', err));
        if (['SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED_DEADLINE'].includes(status)) {
            const targetNotifierObj = updated.managerId ? updated.managerId : updated.creatorId;
            this.notificationService.createNotification({
                recipientId: targetNotifierObj,
                title: `Task Status: ${status}`,
                message: `Task execution updated to ${status}: ${updated.title}`,
                type: 'TASK_UPDATED',
                metadata: { taskId: updated.id, newStatus: status },
            }).catch(err => console.error('Failed to notify manager of task update', err));
            this.notificationService.createNotification({
                recipientId: updated.assigneeId,
                title: `Task Moved to: ${status}`,
                message: `Manager updated your task to ${status}`,
                type: 'TASK_UPDATED',
                metadata: { taskId: updated.id, newStatus: status },
            }).catch(err => console.error('Failed to notify assignee of task update', err));
            if (status === 'MISSED_DEADLINE') {
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
};
exports.TaskService = TaskService;
exports.TaskService = TaskService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        notification_service_1.NotificationService])
], TaskService);
//# sourceMappingURL=task.service.js.map