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
exports.EodService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const activity_service_1 = require("../activity/activity.service");
let EodService = class EodService {
    constructor(prisma, activityService) {
        this.prisma = prisma;
        this.activityService = activityService;
    }
    async create(employeeId, data) {
        const findTasks = async (identifiers) => {
            if (!identifiers || identifiers.length === 0)
                return [];
            return this.prisma.task.findMany({
                where: { OR: [{ id: { in: identifiers } }, { title: { in: identifiers } }] },
                select: { id: true }
            });
        };
        const completedTasks = await findTasks(data.tasksCompleted);
        const inProgressTasks = await findTasks(data.tasksInProgress);
        const createdEod = await this.prisma.eODSubmission.create({
            data: {
                employeeId,
                reportDate: new Date(data.reportDate),
                blockers: data.blockers,
                sentiment: data.sentiment,
                tasksCompleted: {
                    connect: completedTasks,
                },
                tasksInProgress: {
                    connect: inProgressTasks,
                },
            },
            include: {
                tasksCompleted: true,
                tasksInProgress: true,
            }
        });
        this.activityService.logActivity(employeeId, 'EOD_SUBMITTED', { eodId: createdEod.id, sentiment: createdEod.sentiment }).catch(err => console.error('Failed to log EOD activity:', err));
        return createdEod;
    }
    async findByEmployee(employeeId) {
        return this.prisma.eODSubmission.findMany({
            where: { employeeId },
            orderBy: { reportDate: 'desc' },
            include: {
                tasksCompleted: true,
                tasksInProgress: true,
            }
        });
    }
};
exports.EodService = EodService;
exports.EodService = EodService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService])
], EodService);
//# sourceMappingURL=eod.service.js.map