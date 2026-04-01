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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const auth_service_1 = require("./auth.service");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const activity_service_1 = require("../activity/activity.service");
class TestLoginDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The ID of the employee to spoof' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], TestLoginDto.prototype, "employeeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The role to assign (e.g., ADMIN, MANAGER, EMPLOYEE)', default: 'EMPLOYEE' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], TestLoginDto.prototype, "roleId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Optional email for payload compatibility', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TestLoginDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Optional password for payload compatibility', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TestLoginDto.prototype, "password", void 0);
let AuthController = class AuthController {
    constructor(authService, activityService) {
        this.authService = authService;
        this.activityService = activityService;
    }
    async testLogin(body) {
        const token = await this.authService.generateTestToken(body.employeeId, body.roleId);
        this.activityService.logActivity(body.employeeId, 'LOGIN').catch(err => console.error('Failed to log login activity:', err));
        return token;
    }
    async testRbac(req) {
        return {
            message: 'RBAC Validation Passed',
            user: req.user
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('test-login'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a test JWT token for a specific employee' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'JWT Token generated' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TestLoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "testLogin", null);
__decorate([
    (0, common_1.Get)('test-rbac'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Test endpoint requiring ADMIN role' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success if user is ADMIN' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "testRbac", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth (Testing Mode)'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        activity_service_1.ActivityService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map