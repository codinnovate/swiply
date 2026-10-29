import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentWorkspace } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsOverviewQueryDto } from './dto/analytics-overview-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Views, likes, comments and shares for connected accounts, by publish day' })
  async overview(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Query() query: AnalyticsOverviewQueryDto,
  ) {
    return { data: await this.service.overview(workspaceId, query.days) };
  }
}
