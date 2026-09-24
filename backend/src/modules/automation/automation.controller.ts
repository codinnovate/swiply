import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { AutomationService } from './automation.service';
import { ResearchBrandDto, SaveAutomationDraftDto, StartAutomationDto, SuggestPostingTimesDto } from './dto/start-automation.dto';

@ApiTags('automation')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly service: AutomationService) {}

  @Get('status')
  async status(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return { data: await this.service.status(workspaceId) };
  }

  @Get('audit-log')
  async audit(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Query('socialAccountId') account?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return { data: await this.service.list(workspaceId, account, from, to) };
  }

  @Post('pause-all')
  @RequireRoles('editor')
  async pause(@CurrentWorkspace('workspaceId') workspaceId: string, @CurrentUser('userId') userId: string) {
    return { data: await this.service.pauseAll(workspaceId, userId) };
  }

  @Post('research')
  @RequireRoles('editor')
  async research(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ResearchBrandDto,
  ) {
    return { data: await this.service.researchBrand(workspaceId, userId, dto) };
  }

  @Post('draft')
  @RequireRoles('editor')
  async draft(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: SaveAutomationDraftDto,
  ) {
    return { data: await this.service.saveDraft(workspaceId, userId, dto) };
  }

  @Post('posting-times')
  @RequireRoles('editor')
  async postingTimes(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: SuggestPostingTimesDto,
  ) {
    return { data: await this.service.suggestPostingTimes(workspaceId, userId, dto) };
  }

  @Post('start')
  @RequireRoles('editor')
  async start(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: StartAutomationDto,
  ) {
    return { data: await this.service.start(workspaceId, userId, dto) };
  }

  @Post(':id/test-post')
  @RequireRoles('editor')
  async testPost(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return { data: await this.service.sendTestPost(workspaceId, userId, id) };
  }
}
