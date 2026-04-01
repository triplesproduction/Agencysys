"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateActivityDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_activity_dto_1 = require("./create-activity.dto");
class UpdateActivityDto extends (0, swagger_1.PartialType)(create_activity_dto_1.CreateActivityDto) {
}
exports.UpdateActivityDto = UpdateActivityDto;
//# sourceMappingURL=update-activity.dto.js.map