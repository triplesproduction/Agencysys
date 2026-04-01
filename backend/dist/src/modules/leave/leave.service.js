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
exports.LeaveService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let LeaveService = class LeaveService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(employeeId, data) {
        return this.prisma.leaveApplication.create({
            data: {
                employeeId,
                leaveType: data.leaveType,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                reason: data.reason,
            },
        });
    }
    async findByEmployee(employeeId) {
        return this.prisma.leaveApplication.findMany({
            where: { employeeId },
            orderBy: { appliedAt: 'desc' },
        });
    }
    async updateStatus(id, status, approverId) {
        const leave = await this.prisma.leaveApplication.findUnique({ where: { id } });
        if (!leave) {
            throw new common_1.NotFoundException(`Leave Application with ID ${id} not found`);
        }
        if (leave.status !== 'PENDING' && status !== 'CANCELLED') {
            throw new common_1.BadRequestException(`Cannot transition status from ${leave.status}`);
        }
        return this.prisma.leaveApplication.update({
            where: { id },
            data: {
                status,
                approverId: status === 'APPROVED' || status === 'REJECTED' ? approverId : undefined,
            },
        });
    }
};
exports.LeaveService = LeaveService;
exports.LeaveService = LeaveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeaveService);
//# sourceMappingURL=leave.service.js.map