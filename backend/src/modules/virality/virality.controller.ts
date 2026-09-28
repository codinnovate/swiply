import {
  Body,
  Controller,
  Delete,
  Get,
  type MessageEvent,
  Param,
  Post,
  Put,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Observable } from 'rxjs';

import { Public } from '../../common/decorators/public.decorator';
import {
  FeaturedAccountDto,
  LeaderboardBreakdownQueryDto,
  LeaderboardParticipationDto,
  LeaderboardQueryDto,
  SyncHistoryDto,
  UsernameQueryDto,
  CreatePostingChallengeDto,
  PostingChallengesQueryDto,
  RegisterPushDeviceDto,
  RespondPostingChallengeDto,
  UnregisterPushDeviceDto,
  XpConfigDto,
} from './dto/virality.dto';
import { AdminTokenGuard } from './guards/admin-token.guard';
import { LeaderboardService } from './services/leaderboard.service';
import { PostHistoryService } from './services/post-history.service';
import { PostingChallengesService } from './services/posting-challenges.service';
import { PushDevicesService } from './services/push-devices.service';
import { XpConfigService } from './services/xp-config.service';
// Paused: live X research requires xAI; the current setup uses OpenAI only.
// import { PostSuggestionsService } from './services/post-suggestions.service';

@ApiTags('postlock-virality')
@Controller('v1/postlock')
export class ViralityController {
  constructor(
    private readonly history: PostHistoryService,
    private readonly leaderboard: LeaderboardService,
    private readonly challenges: PostingChallengesService,
    private readonly pushDevices: PushDevicesService,
    // private readonly suggestions: PostSuggestionsService,
  ) {}

  /* Re-enable with PostSuggestionsService registration when X research is available.
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('suggestions')
  @ApiOperation({ summary: 'Niche-specific post ideas grounded in recent X search sources' })
  suggest(@Body() dto: SyncHistoryDto) {
    return this.suggestions.suggest(dto.niche);
  }
  */

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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('leaderboard/breakdown')
  @ApiOperation({ summary: "How a ranked account's XP adds up, post by post, for one period" })
  getLeaderboardBreakdown(@Query() query: LeaderboardBreakdownQueryDto) {
    return this.leaderboard.getBreakdown(query);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Put('leaderboard/participation')
  @ApiOperation({ summary: 'Opt a username in to, or out of, the leaderboard' })
  setParticipation(@Body() dto: LeaderboardParticipationDto) {
    return this.leaderboard.setParticipation(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('challenges')
  @ApiOperation({ summary: 'Challenge any public X account to a posting duel' })
  createChallenge(@Body() dto: CreatePostingChallengeDto) {
    return this.challenges.create(dto);
  }

  @Public()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Get('challenges')
  @ApiOperation({ summary: 'Challenge invitations and active challenges for an install' })
  listChallenges(@Query() query: PostingChallengesQueryDto) {
    return this.challenges.list(query);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Sse('challenges/stream')
  @ApiOperation({
    summary: 'Server-sent challenge updates for an install',
    description:
      'Sends a `challenges` event with the full visible list on connect and whenever one changes (new posts, accept/decline, expiry), and a `ping` every 25 seconds.',
  })
  streamChallenges(@Query() query: PostingChallengesQueryDto): Observable<MessageEvent> {
    return this.challenges.stream(query);
  }

  @Public()
  @Put('challenges/:id/respond')
  @ApiOperation({ summary: 'Accept or decline a challenge invitation' })
  respondToChallenge(@Param('id') id: string, @Body() dto: RespondPostingChallengeDto) {
    return this.challenges.respond(id, dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Put('push/devices')
  @ApiOperation({
    summary: "Register an install's APNs token for duel alerts",
    description: 'Alerts go out when a duel rival posts or takes the lead.',
  })
  registerPushDevice(@Body() dto: RegisterPushDeviceDto) {
    return this.pushDevices.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Delete('push/devices')
  @ApiOperation({ summary: 'Stop duel alerts for an install' })
  unregisterPushDevice(@Body() dto: UnregisterPushDeviceDto) {
    return this.pushDevices.unregister(dto.installId);
  }
}

@ApiTags('postlock-admin')
@ApiHeader({ name: 'X-Postlock-Admin-Token', required: true })
@Public()
@UseGuards(AdminTokenGuard)
@Controller('v1/postlock/admin')
export class ViralityAdminController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly xpConfig: XpConfigService,
  ) {}

  @Get('xp-config')
  @ApiOperation({ summary: 'Current XP weights, level curve, and anti-gaming windows' })
  getXpConfig() {
    return this.xpConfig.get();
  }

  @Put('xp-config')
  @ApiOperation({ summary: 'Retune XP; unset fields keep their value. Re-ranks the leaderboard.' })
  async updateXpConfig(@Body() dto: XpConfigDto) {
    const config = await this.xpConfig.update(dto);
    await this.leaderboard.recompute();
    return config;
  }

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
