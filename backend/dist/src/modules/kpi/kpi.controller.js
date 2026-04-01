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
exports.KpiController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const kpi_service_1 = require("./kpi.service");
const kpi_dto_1 = require("./dto/kpi.dto");
const roles_guard_1 = require("../../common/guards/roles.guard");
const auth_guard_1 = require("../../common/guards/auth.guard");
let KpiController = class KpiController {
    constructor(kpiService) {
        this.kpiService = kpiService;
    }
    async getEmployeeKPIs(employeeId) {
        return this.kpiService.findByEmployee(employeeId);
    }
    async triggerKpiCalculation() {
        return {
            message: 'KPI calculation triggered (Mocked for Phase 1 Testing)',
            timestamp: new Date().toISOString(),
        };
    }
};
exports.KpiController = KpiController;
__decorate([
    (0, common_1.Get)('employees/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get KPI metrics for a particular employee' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: [kpi_dto_1.KpiMetricResponseDto] }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "getEmployeeKPIs", null);
__decorate([
    (0, common_1.Post)('trigger'),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger a manual KPI calculation for test purposes' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'KPI calculation triggered successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KpiController.prototype, "triggerKpiCalculation", null);
exports.KpiController = KpiController = __decorate([
    (0, swagger_1.ApiTags)('KPI Metrics'),
    (0, common_1.Controller)('kpis'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [kpi_service_1.KpiService])
], KpiController);
//# sourceMappingURL=kpi.controller.js.map