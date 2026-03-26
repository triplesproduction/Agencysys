import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { AuthService } from './auth.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActivityService } from '../activity/activity.service';

class TestLoginDto {
    @ApiProperty({ description: 'The ID of the employee to spoof' })
    @IsString()
    @IsNotEmpty()
    employeeId: string;

    @ApiProperty({ description: 'The role to assign (e.g., ADMIN, MANAGER, EMPLOYEE)', default: 'EMPLOYEE' })
    @IsString()
    @IsNotEmpty()
    roleId: string;

    @ApiProperty({ description: 'Optional email for payload compatibility', required: false })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiProperty({ description: 'Optional password for payload compatibility', required: false })
    @IsString()
    @IsOptional()
    password?: string;
}

@ApiTags('Auth (Testing Mode)')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly activityService: ActivityService
    ) { }

    @Post('login')
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiResponse({ status: 201, description: 'JWT Token and employee info returned' })
    async login(@Body() body: { email: string; password: string }) {
        return this.authService.login(body.email, body.password);
    }

    @Post('test-login')
    @ApiOperation({ summary: 'Generate a test JWT token for a specific employee' })
    @ApiResponse({ status: 201, description: 'JWT Token generated' })
    async testLogin(@Body() body: TestLoginDto) {
        const token = await this.authService.generateTestToken(body.employeeId, body.roleId);

        // Asynchronously log the login event for the Employee Monitoring System
        this.activityService.logActivity(body.employeeId, 'LOGIN').catch(err =>
            console.error('Failed to log login activity:', err)
        );

        return token;
    }

    @Get('test-rbac')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Test endpoint requiring ADMIN role' })
    @ApiResponse({ status: 200, description: 'Success if user is ADMIN' })
    async testRbac(@Req() req: any) {
        return {
            message: 'RBAC Validation Passed',
            user: req.user
        };
    }
}
