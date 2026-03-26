import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';

@Injectable()
export class RuleService {
    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService
    ) { }

    async create(data: CreateRuleDto, createdBy: string) {
        let employeeId = createdBy;
        // The token gives us the user ID. We need to find the connected Employee record.
        let employee = await this.prisma.employee.findUnique({ where: { id: createdBy } });

        if (!employee) {
            // If no Employee record is found for this ID (e.g., generic Admin UUID),
            // we will simply proceed using the raw ID for the 'createdBy' relation.
        }

        const rule = await this.prisma.rule.create({
            data: {
                title: data.title,
                description: data.description,
                category: data.category,
                priority: data.priority,
                effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
                createdBy: createdBy
            },
            include: { author: { select: { firstName: true, lastName: true } } }
        });

        // Broadcast notification
        await this.notificationService.createBroadcastNotification({
            title: 'New Rule Added',
            message: `A new rule "${rule.title}" has been published by Admin.`,
            type: 'RULE_ADDED',
            metadata: { ruleId: rule.id }
        });

        return rule;
    }

    async findAll() {
        return this.prisma.rule.findMany({
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { firstName: true, lastName: true, id: true } } }
        });
    }

    async update(id: string, data: UpdateRuleDto) {
        const existingRule = await this.prisma.rule.findUnique({ where: { id } });
        if (!existingRule) throw new NotFoundException(`Rule with ID ${id} not found`);

        const isContentChanged =
            existingRule.title !== data.title ||
            existingRule.description !== data.description ||
            existingRule.category !== data.category ||
            existingRule.priority !== data.priority ||
            (existingRule.effectiveDate?.toISOString() !== (data.effectiveDate ? new Date(data.effectiveDate).toISOString() : null));

        const updatedRule = await this.prisma.rule.update({
            where: { id },
            data: {
                ...data,
                effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined
            },
            include: { author: { select: { firstName: true, lastName: true } } }
        });

        if (isContentChanged) {
            await this.notificationService.createBroadcastNotification({
                title: 'Rule Updated',
                message: `The rule "${updatedRule.title}" has been updated by Admin.`,
                type: 'RULE_UPDATED',
                metadata: { ruleId: updatedRule.id }
            });
        }

        return updatedRule;
    }

    async remove(id: string) {
        return this.prisma.rule.delete({
            where: { id }
        });
    }
}
