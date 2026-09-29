import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

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
  @Niche() niche?: string;
  @IsOptional() @XUsername() username?: string;
}

export class FeaturedAccountDto {
  @XUsername() username: string;
  @Niche() niche?: string;
}
