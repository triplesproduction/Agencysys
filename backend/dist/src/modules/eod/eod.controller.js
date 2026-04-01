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
exports.EodController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const eod_service_1 = require("./eod.service");
const eod_dto_1 = require("./dto/eod.dto");
const roles_guard_1 = require("../../common/guards/roles.guard");
const auth_guard_1 = require("../../common/guards/auth.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
let EodController = class EodController {
    constructor(eodService) {
        this.eodService = eodService;
    }
    async submitEod(user, createEodDto) {
        return this.eodService.create(user.id, createEodDto);
    }
    async getMyEods(user) {
        return this.eodService.findByEmployee(user.id);
    }
};
exports.EodController = EodController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a new EOD report' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: eod_dto_1.EodResponseDto }),
    __param(0, (0, user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, eod_dto_1.CreateEodDto]),
    __metadata("design:returntype", Promise)
], EodController.prototype, "submitEod", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current users EOD reports' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: [eod_dto_1.EodResponseDto] }),
    __param(0, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EodController.prototype, "getMyEods", null);
exports.EodController = EodController = __decorate([
    (0, swagger_1.ApiTags)('EOD Reports'),
    (0, common_1.Controller)('eod-reports'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [eod_service_1.EodService])
], EodController);
//# sourceMappingURL=eod.controller.js.map