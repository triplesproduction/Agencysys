"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EodModule = void 0;
const common_1 = require("@nestjs/common");
const eod_service_1 = require("./eod.service");
const eod_controller_1 = require("./eod.controller");
const prisma_module_1 = require("../../prisma/prisma.module");
const activity_module_1 = require("../activity/activity.module");
let EodModule = class EodModule {
};
exports.EodModule = EodModule;
exports.EodModule = EodModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, activity_module_1.ActivityModule],
        providers: [eod_service_1.EodService],
        controllers: [eod_controller_1.EodController]
    })
], EodModule);
//# sourceMappingURL=eod.module.js.map