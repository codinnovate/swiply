import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { normalizeUsername } from '../../posting-consistency/dto/posting-profile.dto';

const XUsername = () =>
  applyDecorators(
    Transform(({ value }) => normalizeUsername(value)),
    IsString(),
    Matches(/^[a-z0-9_]{1,15}$/, {
      message:
        'username must contain only letters, numbers, or underscores and be at most 15 characters',
    }),
  );

const Niche = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value)),
    IsString(),
    MaxLength(60),
  );

export class SyncHistoryDto {
  @XUsername() username: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @Niche() niche?: string;
}

export class UsernameQueryDto {
  @XUsername() username: string;
}

export class LeaderboardParticipationDto {
  @XUsername() username: string;
  @IsUUID() installId: string;
  @IsBoolean() optedIn: boolean;
  @Niche() niche?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
}

export class LeaderboardQueryDto {
  @IsOptional() @IsIn(['all', 'featured', 'users']) category?: 'all' | 'featured' | 'users';
  /** Which post count to rank by: today, this week, or the full 30-day window. Defaults to 'all'. */
  @IsOptional() @IsIn(['day', 'week', 'all']) period?: 'day' | 'week' | 'all';
  @Niche() niche?: string;
  @IsOptional() @XUsername() username?: string;
}

export class LeaderboardBreakdownQueryDto {
  @XUsername() username: string;
  /** Which period's posts to explain. Defaults to 'day'. */
  @IsOptional() @IsIn(['day', 'week', 'all']) period?: 'day' | 'week' | 'all';
}

export class FeaturedAccountDto {
  @XUsername() username: string;
  @Niche() niche?: string;
}

export class CreatePostingChallengeDto {
  @XUsername() challengerUsername: string;
  @IsUUID() challengerInstallId: string;
  @XUsername() opponentUsername: string;
  @IsIn(['day', 'week']) duration: 'day' | 'week';
}

export class PostingChallengesQueryDto {
  @XUsername() username: string;
  @IsUUID() installId: string;
}

export class RespondPostingChallengeDto extends PostingChallengesQueryDto {
  @IsIn(['accept', 'decline']) action: 'accept' | 'decline';
}

const XpWeight = () =>
  applyDecorators(
    IsOptional(),
    IsNumber({ allowNaN: false, allowInfinity: false }),
    Min(-1000),
    Max(1000),
  );

/** Any weight left out keeps its current value. */
export class XpWeightsDto {
  @XpWeight() like?: number;
  @XpWeight() repost?: number;
  @XpWeight() replyReceived?: number;
  @XpWeight() profileClickToEngagement?: number;
  @XpWeight() conversationClickEngagement?: number;
  @XpWeight() authorReplyToReply?: number;
  @XpWeight() mutedOrBlocked?: number;
  @XpWeight() reported?: number;
}

export class XpConfigDto {
  @IsOptional() @ValidateNested() @Type(() => XpWeightsDto) weights?: XpWeightsDto;
  @IsOptional() @IsNumber() @Min(1) @Max(100_000) levelBaseXp?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) replierDecayWindowDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) duplicateWindowDays?: number;
}
