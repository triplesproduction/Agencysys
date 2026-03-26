import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ActivityModule } from '../activity/activity.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET || 'test_secret',
            signOptions: { expiresIn: '1d' },
        }),
        ActivityModule,
        PrismaModule,
    ],
    providers: [AuthService],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }
