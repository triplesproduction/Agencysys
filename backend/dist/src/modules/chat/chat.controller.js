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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const swagger_1 = require("@nestjs/swagger");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const activity_service_1 = require("../activity/activity.service");
let ChatController = class ChatController {
    constructor(chatService, activityService) {
        this.chatService = chatService;
        this.activityService = activityService;
    }
    async sendMessage(body) {
        return this.chatService.sendMessage(body.senderId, body.receiverId, body.content);
    }
    async getAdminAllChats(req) {
        const adminId = req.user?.userId;
        if (adminId) {
            this.activityService.logActivity(adminId, 'ADMIN_CHAT_VIEW', 'Admin accessed the global chat oversight dashboard.').catch(err => console.error(err));
        }
        const chats = await this.chatService.getAdminAllChats();
        return { data: chats, message: 'Admin oversight activated. Messages decrypted.' };
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('send'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Send a new encrypted message' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)('admin'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Admin Read-Only Oversight view of all conversations. Pings the Audit Trail.' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'All decrypted system-wide chats' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getAdminAllChats", null);
exports.ChatController = ChatController = __decorate([
    (0, swagger_1.ApiTags)('Chat Oversight & Messaging'),
    (0, common_1.Controller)('chats'),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        activity_service_1.ActivityService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map