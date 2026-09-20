import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { AutomationService } from './automation.service';

@ApiTags('automation') @ApiBearerAuth() @UseGuards(WorkspaceGuard) @Controller('automation')
export class AutomationController {
  constructor(private readonly service: AutomationService) {}
  @Get('status') async status(@CurrentWorkspace('workspaceId') workspaceId: string) { return { data: await this.service.status(workspaceId) }; }
  @Get('audit-log') async audit(@CurrentWorkspace('workspaceId') workspaceId: string, @Query('socialAccountId') account?: string, @Query('from') from?: string, @Query('to') to?: string) { return { data: await this.service.list(workspaceId, account, from, to) }; }
  @Post('pause-all') @RequireRoles('editor') async pause(@CurrentWorkspace('workspaceId') workspaceId: string, @CurrentUser('userId') userId: string) { return { data: await this.service.pauseAll(workspaceId, userId) }; }
}
