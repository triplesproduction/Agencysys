"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const bcrypt = require("bcrypt");
let EmployeeService = class EmployeeService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.employee.findMany();
    }
    async findById(id) {
        return this.prisma.employee.findUnique({
            where: { id },
        });
    }
    async create(data) {
        let employeeId = data.id;
        if (!employeeId) {
            const count = await this.prisma.employee.count();
            employeeId = `EMP-${String(count + 1).padStart(3, '0')}`;
        }
        const existingEmail = await this.prisma.employee.findUnique({ where: { email: data.email } });
        if (existingEmail) {
            throw new common_1.ConflictException('An employee with this email already exists.');
        }
        const existingId = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (existingId) {
            throw new common_1.ConflictException(`An employee with ID ${employeeId} already exists.`);
        }
        let passwordHash = null;
        if (data.password) {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(data.password, salt);
        }
        return this.prisma.employee.create({
            data: {
                id: employeeId,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                roleId: data.roleId,
                department: data.department || null,
                passwordHash: passwordHash,
                requirePasswordReset: true
            }
        });
    }
};
exports.EmployeeService = EmployeeService;
exports.EmployeeService = EmployeeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmployeeService);
//# sourceMappingURL=employee.service.js.map