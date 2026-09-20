import { IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class EngagementFiltersDto {
  @IsArray() @IsString({ each: true }) excludeKeywords: string[];
  @IsBoolean() skipNegativeSentiment: boolean;
  @IsBoolean() skipLikelyBots: boolean;
  @IsBoolean() onlyFromFollowers: boolean;
}

export class UpsertEngagementRuleDto {
  @IsMongoId() socialAccountId: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsArray() @IsIn(['mentions', 'comments'], { each: true }) scope: string[];
  @IsIn(['auto_publish', 'review_queue']) mode: string;
  @ValidateNested() @Type(() => EngagementFiltersDto) filters: EngagementFiltersDto;
  @IsInt() @Min(0) @Max(500) maxRepliesPerDay: number;
}

export class UpdateInteractionDto {
  @IsString() generatedReplyText: string;
}
