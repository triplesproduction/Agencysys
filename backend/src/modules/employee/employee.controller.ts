import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards, NotFoundException, ValidationPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { EmployeeResponseDto, CreateEmployeeDto } from './dto/employee.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) { }

    @Post()
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Create a new employee (Admin Only)' })
    @ApiResponse({ status: 201, type: EmployeeResponseDto })
    async create(@Body(new ValidationPipe()) createEmployeeDto: CreateEmployeeDto) {
        return this.employeeService.create(createEmployeeDto);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get total employee statistics' })
    async getStats() {
        return this.employeeService.getStats();
    }

    @Get()
    @ApiOperation({ summary: 'Get all employees (paginated and filtered)' })
    async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('roleId') roleId?: string,
        @Query('status') status?: string,
        @Query('department') department?: string,
        @Query('sortBy') sortBy?: string,
    ) {
        const take = limit ? parseInt(limit) : undefined;
        const skip = page && take ? (parseInt(page) - 1) * take : undefined;

        return this.employeeService.findAll({
            skip,
            take,
            search,
            roleId,
            status,
            department,
            sortBy
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get an employee by ID' })
    @ApiResponse({ status: 200, type: EmployeeResponseDto })
    async findOne(@Param('id') id: string) {
        const employee = await this.employeeService.findById(id);
        if (!employee) {
            throw new NotFoundException(`Employee with ID ${id} not found`);
        }
        return employee;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update employee details (Self or Admin)' })
    async update(
        @Param('id') id: string,
        @Body() body: any
    ) {
        const employee = await this.employeeService.findById(id);
        if (!employee) throw new NotFoundException(`Employee ${id} not found`);
        return this.employeeService.update(id, body);
    }

    @Patch(':id/status')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update employee status (Admin Only)' })
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string }
    ) {
        const employee = await this.employeeService.findById(id);
        if (!employee) throw new NotFoundException(`Employee ${id} not found`);
        return this.employeeService.updateStatus(id, body.status);
    }

    @Delete(':id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an employee (Admin Only)' })
    async remove(@Param('id') id: string) {
        const employee = await this.employeeService.findById(id);
        if (!employee) throw new NotFoundException(`Employee ${id} not found`);
        await this.employeeService.delete(id);
    }
}
