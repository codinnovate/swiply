import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import {
  FeaturedAccountDto,
  LeaderboardParticipationDto,
  LeaderboardQueryDto,
  SyncHistoryDto,
  UsernameQueryDto,
} from './dto/virality.dto';
import { AdminTokenGuard } from './guards/admin-token.guard';
import { LeaderboardService } from './services/leaderboard.service';
import { PostHistoryService } from './services/post-history.service';
import { PostSuggestionsService } from './services/post-suggestions.service';

@ApiTags('postlock-virality')
@Controller('v1/postlock')
export class ViralityController {
  constructor(
    private readonly history: PostHistoryService,
    private readonly leaderboard: LeaderboardService,
    private readonly suggestions: PostSuggestionsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('suggestions')
  @ApiOperation({ summary: 'Niche-specific post ideas grounded in recent X search sources' })
  suggest(@Body() dto: SyncHistoryDto) {
    return this.suggestions.suggest(dto.niche);
  }

  @Public()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('history/sync')
  @ApiOperation({ summary: 'Pull recent public posts and start scoring new ones' })
  syncHistory(@Body() dto: SyncHistoryDto) {
    return this.history.syncUser(dto.username, { niche: dto.niche, timezone: dto.timezone });
  }

  @Public()
  @Get('history')
  @ApiOperation({ summary: 'Scored post history and pattern insights for a username' })
  getHistory(@Query() query: UsernameQueryDto) {
    return this.history.getHistory(query.username);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('posts/:postId/rewrite')
  @ApiOperation({ summary: 'Two improved variants of a scored post' })
  rewrite(@Param('postId') postId: string, @Body() dto: UsernameQueryDto) {
    return this.history.rewrite(dto.username, postId);
  }

  @Public()
  @Get('leaderboard')
  @ApiOperation({ summary: 'Latest leaderboard ranking, optionally filtered' })
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboard.getLeaderboard(query);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Put('leaderboard/participation')
  @ApiOperation({ summary: 'Opt a username in to, or out of, the leaderboard' })
  setParticipation(@Body() dto: LeaderboardParticipationDto) {
    return this.leaderboard.setParticipation(dto);
  }
}

@ApiTags('postlock-admin')
@ApiHeader({ name: 'X-Postlock-Admin-Token', required: true })
@Public()
@UseGuards(AdminTokenGuard)
@Controller('v1/postlock/admin')
export class ViralityAdminController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get('featured-accounts')
  listFeatured() {
    return this.leaderboard.listFeatured();
  }

  @Post('featured-accounts')
  addFeatured(@Body() dto: FeaturedAccountDto) {
    return this.leaderboard.addFeatured(dto);
  }

  @Delete('featured-accounts/:username')
  removeFeatured(@Param('username') username: string) {
    return this.leaderboard.removeFeatured(username.toLowerCase().replace(/^@/, ''));
  }

  @Post('leaderboard/refresh')
  @ApiOperation({ summary: 'Refresh featured and opted-in accounts and re-rank now' })
  async refresh() {
    await this.leaderboard.refreshAll();
    return { refreshed: true };
  }
}
