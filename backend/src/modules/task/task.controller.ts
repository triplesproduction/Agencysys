import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ValidationPipe, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskStatusDto, TaskResponseDto } from './dto/task.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class TaskController {
    constructor(private readonly taskService: TaskService) { }

    @Get()
    @ApiOperation({ summary: 'Get all tasks with optional filters' })
    @ApiQuery({ name: 'assigneeId', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] })
    @ApiResponse({ status: 200, type: [TaskResponseDto] })
    async getTasks(
        @Query('assigneeId') assigneeId?: string,
        @Query('status') status?: string,
    ) {
        return this.taskService.findAll(assigneeId, status);
    }

    private readonly logger = new Logger(TaskController.name);

    @Post()
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Create a new task (or multiple identical tasks based on assignees array)' })
    @ApiResponse({ status: 201, type: [TaskResponseDto] })
    async createTask(
        @CurrentUser() user: any,
        @Body(new ValidationPipe({ transform: true, whitelist: true })) createTaskDto: CreateTaskDto,
    ) {
        // Requirement 1: Log req.body in console.
        this.logger.log(`Incoming Assign Task Payload: ${JSON.stringify(createTaskDto)}`);

        try {
            // Default status fallback
            if (!createTaskDto.status) createTaskDto.status = 'TODO';

            // Optional Requirement 5: Quick check for missing assignments before hitting DB
            if (!createTaskDto.assigneeIds || createTaskDto.assigneeIds.length === 0) {
                throw new BadRequestException('At least one assignedTo (assigneeIds) is required');
            }

            return await this.taskService.create(user.id, createTaskDto);
        } catch (error: any) {
            // Requirement 3: Log error message in console
            this.logger.error(`Failed to assign task: ${error.message}`, error.stack);

            // Requirement 6: Return proper error response instead of crashing server
            if (error instanceof BadRequestException) {
                throw error;
            }
            if (error.code === 'P2003') { // Prisma Foreign Key constraint failed
                throw new BadRequestException('Invalid Entity ID provided (e.g. invalid Assignee or Manager).');
            }
            throw new InternalServerErrorException('An unexpected error occurred while assigning the task.');
        }
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update an existing task status' })
    @ApiResponse({ status: 200, type: TaskResponseDto })
    async updateStatus(
        @Param('id') id: string,
        @Body(new ValidationPipe()) updateDto: UpdateTaskStatusDto,
    ) {
        return this.taskService.updateStatus(id, updateDto.status);
    }
}
