import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CompetitorsService } from './competitors.service';
import { ResearchCompetitorDto } from './dto/research-competitor.dto';

@ApiTags('competitors')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('competitors')
export class CompetitorsController {
  constructor(private readonly service: CompetitorsService) {}

  @Get()
  @ApiOperation({ summary: 'Competitors researched in this workspace, newest first' })
  async list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return { data: await this.service.list(workspaceId) };
  }

  @Get('sources')
  @ApiOperation({ summary: 'Which competitor data sources the server has credentials for' })
  sources() {
    return { data: this.service.sources() };
  }

  @Post('research')
  @RequireRoles('editor')
  // Each fresh run spends scraper credit, so cap it per caller.
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Research a company's TikTok videos, hashtags, performance and ads" })
  async research(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ResearchCompetitorDto,
  ) {
    return { data: await this.service.research(workspaceId, userId, dto) };
  }

  @Get(':id')
  async get(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) {
    return { data: await this.service.get(workspaceId, id) };
  }

  @Delete(':id')
  @RequireRoles('editor')
  @HttpCode(204)
  async remove(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) {
    await this.service.remove(workspaceId, id);
  }
}
