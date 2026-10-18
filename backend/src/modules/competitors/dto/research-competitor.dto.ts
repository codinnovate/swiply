import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { COMPETITOR_NETWORKS, type CompetitorNetwork } from '../domain/competitor.types';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class ResearchCompetitorDto {
  @IsIn(COMPETITOR_NETWORKS)
  @IsOptional()
  network: CompetitorNetwork = 'tiktok';

  /** Company name, @handle, or profile URL. */
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  company: string;

  /** Overrides the handle guessed from the company name. */
  @trim()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  handle?: string;

  /** Skip the cached report and fetch fresh data. */
  @IsBoolean()
  @IsOptional()
  refresh?: boolean;
}
