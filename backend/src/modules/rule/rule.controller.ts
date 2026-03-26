import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RuleService } from './rule.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Rules')
@ApiBearerAuth()
@Controller('rules')
@UseGuards(AuthGuard, RolesGuard)
export class RuleController {
    constructor(private readonly ruleService: RuleService) { }

    @Post()
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Create a new rule (Admin Only)' })
    create(@Body() createRuleDto: CreateRuleDto, @Request() req: any) {
        // user object is attached by AuthGuard from jwt payload
        const userId = req.user.id || req.user.sub || req.user.employeeId;
        return this.ruleService.create(createRuleDto, userId);
    }

    @Get()
    @ApiOperation({ summary: 'Get all rules' })
    findAll() {
        return this.ruleService.findAll();
    }

    @Patch(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update a rule (Admin Only)' })
    update(@Param('id') id: string, @Body() updateRuleDto: UpdateRuleDto) {
        return this.ruleService.update(id, updateRuleDto);
    }

    @Delete(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Delete a rule (Admin Only)' })
    remove(@Param('id') id: string) {
        return this.ruleService.remove(id);
    }
}
