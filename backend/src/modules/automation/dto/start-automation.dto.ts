import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min } from 'class-validator';

function clipEach(max: number) {
  return Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.slice(0, max) : item))
      : value,
  );
}

function clipString(max: number) {
  return Transform(({ value }) => (typeof value === 'string' ? value.slice(0, max) : value));
}

export class ResearchBrandDto {
  @IsUrl({ require_tld: false }) websiteUrl: string;
}

export class SuggestPostingTimesDto {
  @IsIn(['daily', 'weekly']) cadence: 'daily' | 'weekly';
  @Type(() => Number) @IsInt() @Min(1) @Max(7) postsPerPeriod: number;
  @IsString() @MaxLength(80) targetCountry: string;
  @IsOptional() @IsString() @MaxLength(4000) tiktokInsights?: string;
  @IsOptional() @IsString() @MaxLength(80) timeZone?: string;
}

export class SaveAutomationDraftDto {
  @IsOptional() @IsMongoId() scheduleId?: string;
  @IsUrl({ require_tld: false }) websiteUrl: string;
  @IsOptional() @IsString() @MaxLength(8000) websiteBrief?: string;
  @IsOptional() @IsString() @MaxLength(4000) tiktokInsights?: string;
  @IsOptional() @clipString(160) @IsString() @MaxLength(160) productName?: string;
  @IsOptional() @clipString(400) @IsString() @MaxLength(400) oneLiner?: string;
  @IsOptional()
  @clipEach(500)
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  suggestedAngles?: string[];
  @IsOptional() @clipEach(120) @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(120, { each: true }) competitors?: string[];
  @IsOptional() @clipEach(80) @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(80, { each: true }) competitorAccounts?: string[];
  @IsOptional() @clipString(2000) @IsString() @MaxLength(2000) audience?: string;
  @IsOptional() @clipEach(400) @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(400, { each: true }) valueProps?: string[];
  @IsOptional() @IsMongoId() socialAccountId?: string;
  @IsOptional() @IsIn(['daily', 'weekly']) cadence?: 'daily' | 'weekly';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) postsPerPeriod?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsString({ each: true })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  timesOfDay?: string[];
  @IsOptional() @IsString() @MaxLength(80) targetCountry?: string;
  @IsOptional() @IsString() @MaxLength(80) language?: string;
  @IsOptional() @IsString() @MaxLength(80) timeZone?: string;
}

export class StartAutomationDto {
  @IsOptional() @IsMongoId() scheduleId?: string;
  @IsUrl({ require_tld: false }) websiteUrl: string;
  @IsOptional() @IsString() @MaxLength(8000) websiteBrief?: string;
  @IsOptional() @IsString() @MaxLength(4000) tiktokInsights?: string;
  @IsOptional() @clipString(160) @IsString() @MaxLength(160) productName?: string;
  @IsOptional() @clipString(400) @IsString() @MaxLength(400) oneLiner?: string;
  @IsOptional()
  @clipEach(500)
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  suggestedAngles?: string[];
  @IsOptional() @clipEach(120) @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(120, { each: true }) competitors?: string[];
  @IsOptional() @clipEach(80) @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(80, { each: true }) competitorAccounts?: string[];
  @IsOptional() @clipString(2000) @IsString() @MaxLength(2000) audience?: string;
  @IsOptional() @clipEach(400) @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(400, { each: true }) valueProps?: string[];
  @IsMongoId() socialAccountId: string;
  @IsIn(['daily', 'weekly']) cadence: 'daily' | 'weekly';
  @Type(() => Number) @IsInt() @Min(1) @Max(7) postsPerPeriod: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsString({ each: true })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  timesOfDay: string[];
  @IsOptional() @IsString() @MaxLength(80) targetCountry?: string;
  @IsOptional() @IsString() @MaxLength(80) language?: string;
  @IsOptional() @IsString() @MaxLength(80) timeZone?: string;
  @IsOptional() @IsString() @MaxLength(120) aiModel?: string;
}
