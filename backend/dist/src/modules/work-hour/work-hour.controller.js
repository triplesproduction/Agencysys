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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkHourController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const work_hour_service_1 = require("./work-hour.service");
const work_hour_dto_1 = require("./dto/work-hour.dto");
const roles_guard_1 = require("../../common/guards/roles.guard");
const auth_guard_1 = require("../../common/guards/auth.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
let WorkHourController = class WorkHourController {
    constructor(workHourService) {
        this.workHourService = workHourService;
    }
    async logWorkHours(user, createWorkHourDto) {
        return this.workHourService.create(user.id, createWorkHourDto);
    }
};
exports.WorkHourController = WorkHourController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Log work hours' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: work_hour_dto_1.WorkHourResponseDto }),
    __param(0, (0, user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_hour_dto_1.CreateWorkHourDto]),
    __metadata("design:returntype", Promise)
], WorkHourController.prototype, "logWorkHours", null);
exports.WorkHourController = WorkHourController = __decorate([
    (0, swagger_1.ApiTags)('Work Hours'),
    (0, common_1.Controller)('work-hours'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [work_hour_service_1.WorkHourService])
], WorkHourController);
//# sourceMappingURL=work-hour.controller.js.map