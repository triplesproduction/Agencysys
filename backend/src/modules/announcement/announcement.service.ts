import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementService {
    constructor(private prisma: PrismaService) { }

    async create(data: CreateAnnouncementDto, createdBy: string) {
        return this.prisma.announcement.create({
            data: {
                title: data.title,
                message: data.message,
                type: data.type || 'ANNOUNCEMENT',
                status: 'active', // Always active on creation — never changes automatically
                createdBy,
            },
            include: { author: { select: { firstName: true, lastName: true } } }
        });
    }

    async findAll() {
        return this.prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { firstName: true, lastName: true } } }
        });
    }

    async updateStatus(id: string, status: 'active' | 'inactive') {
        const existing = await this.prisma.announcement.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

        return this.prisma.announcement.update({
            where: { id },
            data: { status },
            include: { author: { select: { firstName: true, lastName: true } } }
        });
    }

    async remove(id: string) {
        const existing = await this.prisma.announcement.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Announcement ${id} not found`);
        return this.prisma.announcement.delete({ where: { id } });
    }
}
