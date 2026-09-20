import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { EngagementService } from './engagement.service';
import { UpdateInteractionDto, UpsertEngagementRuleDto } from './dto/upsert-engagement-rule.dto';

@ApiTags('engagement') @ApiBearerAuth() @UseGuards(WorkspaceGuard) @Controller('engagement')
export class EngagementController {
  constructor(private readonly service: EngagementService) {}
  @Get('rules') async rules(@CurrentWorkspace('workspaceId') workspaceId: string) { return { data: await this.service.listRules(workspaceId) }; }
  @Post('rules') @RequireRoles('editor') async create(@CurrentWorkspace('workspaceId') workspaceId: string, @Body() dto: UpsertEngagementRuleDto) { return { data: await this.service.createRule(workspaceId, dto) }; }
  @Patch('rules/:id') @RequireRoles('editor') async update(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string, @Body() dto: UpsertEngagementRuleDto) { return { data: await this.service.updateRule(workspaceId, id, dto) }; }
  @Post('rules/:id/pause') @RequireRoles('editor') async pause(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) { return { data: await this.service.pauseRule(workspaceId, id) }; }
  @Get('interactions') async interactions(@CurrentWorkspace('workspaceId') workspaceId: string, @Query('status') status?: string, @Query('socialAccountId') socialAccountId?: string) { return { data: await this.service.listInteractions(workspaceId, status, socialAccountId) }; }
  @Patch('interactions/:id') @RequireRoles('editor') async edit(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string, @Body() dto: UpdateInteractionDto) { return { data: await this.service.updateInteraction(workspaceId, id, dto.generatedReplyText) }; }
  @Post('interactions/:id/approve') @RequireRoles('editor') async approve(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) { return { data: await this.service.approveInteraction(workspaceId, id) }; }
  @Post('interactions/:id/skip') @RequireRoles('editor') async skip(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) { return { data: await this.service.skipInteraction(workspaceId, id) }; }
}
