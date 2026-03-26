import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService
    ) { }

    async login(email: string, password: string) {
        // First try to find by email
        let employee = await this.prisma.employee.findUnique({ where: { email } }).catch(() => null);

        // Fallback: if not found by email, try finding by ID (for dev convenience)
        if (!employee) {
            employee = await this.prisma.employee.findUnique({ where: { id: email } }).catch(() => null);
        }

        if (!employee) throw new UnauthorizedException('Invalid credentials. Check your email address.');

        // If employee has a password hash, verify it
        if (employee.passwordHash) {
            const valid = await bcrypt.compare(password, employee.passwordHash);
            if (!valid) throw new UnauthorizedException('Incorrect password.');
        }
        // If no passwordHash exists, allow login (open dev environment)

        const payload = { sub: employee.id, roleId: employee.roleId };
        return {
            access_token: await this.jwtService.signAsync(payload),
            employee: { id: employee.id, firstName: employee.firstName, roleId: employee.roleId }
        };
    }

    async generateTestToken(employeeId: string, roleId: string) {
        const payload = { sub: employeeId, roleId };
        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }
}
