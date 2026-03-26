import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto, UpdateAnnouncementStatusDto } from './dto/announcement.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
@UseGuards(AuthGuard, RolesGuard)
export class AnnouncementController {
    constructor(private readonly announcementService: AnnouncementService) { }

    @Post()
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Create a new announcement (Admin Only)' })
    create(@Body() createDto: CreateAnnouncementDto, @Request() req: any) {
        const userId = req.user.id || req.user.sub;
        return this.announcementService.create(createDto, userId);
    }

    @Get()
    @ApiOperation({ summary: 'Get all announcements' })
    findAll() {
        return this.announcementService.findAll();
    }

    @Patch(':id/status')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Toggle announcement status (Admin Only)' })
    updateStatus(@Param('id') id: string, @Body() dto: UpdateAnnouncementStatusDto) {
        return this.announcementService.updateStatus(id, dto.status as 'active' | 'inactive');
    }

    @Delete(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Delete an announcement (Admin Only)' })
    remove(@Param('id') id: string) {
        return this.announcementService.remove(id);
    }
}
