import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private jwtService;
    constructor(jwtService: JwtService);
    generateTestToken(employeeId: string, roleId: string): Promise<{
        access_token: string;
    }>;
}
