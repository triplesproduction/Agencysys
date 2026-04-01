import { AuthService } from './auth.service';
import { ActivityService } from '../activity/activity.service';
declare class TestLoginDto {
    employeeId: string;
    roleId: string;
    email?: string;
    password?: string;
}
export declare class AuthController {
    private readonly authService;
    private readonly activityService;
    constructor(authService: AuthService, activityService: ActivityService);
    testLogin(body: TestLoginDto): Promise<{
        access_token: string;
    }>;
    testRbac(req: any): Promise<{
        message: string;
        user: any;
    }>;
}
export {};
