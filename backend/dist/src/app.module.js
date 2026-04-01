"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("./prisma/prisma.module");
const employee_module_1 = require("./modules/employee/employee.module");
const task_module_1 = require("./modules/task/task.module");
const eod_module_1 = require("./modules/eod/eod.module");
const work_hour_module_1 = require("./modules/work-hour/work-hour.module");
const leave_module_1 = require("./modules/leave/leave.module");
const kpi_module_1 = require("./modules/kpi/kpi.module");
const auth_module_1 = require("./modules/auth/auth.module");
const health_controller_1 = require("./health/health.controller");
const activity_module_1 = require("./modules/activity/activity.module");
const chat_module_1 = require("./modules/chat/chat.module");
const notification_module_1 = require("./modules/notification/notification.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            employee_module_1.EmployeeModule,
            task_module_1.TaskModule,
            eod_module_1.EodModule,
            work_hour_module_1.WorkHourModule,
            leave_module_1.LeaveModule,
            kpi_module_1.KpiModule,
            auth_module_1.AuthModule,
            activity_module_1.ActivityModule,
            chat_module_1.ChatModule,
            notification_module_1.NotificationModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map