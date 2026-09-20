import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CONTENT_GOALS, CONTENT_TYPES } from '../schemas/content.schema';
import { AI_PROVIDERS } from '../../../ai/ai-providers';

export class CreateContentDto {
  @IsIn(CONTENT_TYPES) type: 'slideshow' | 'video' | 'post';
  @IsOptional() @IsString() @MaxLength(5000) topic?: string;
  @IsOptional() @IsString() @MaxLength(80) targetCountry?: string;
  @IsOptional() @IsString() socialAccountId?: string;
  @IsOptional() @IsString() voiceProfileId?: string;
  @IsOptional() @IsString() @MaxLength(120) aiModel?: string;
  @IsOptional() @IsIn(AI_PROVIDERS) aiProvider?: 'openai' | 'anthropic' | 'gemini';
  @IsOptional() @IsString() @MaxLength(2200) text?: string;
  @IsOptional() @IsIn(CONTENT_GOALS) goal?: (typeof CONTENT_GOALS)[number];
  @IsOptional() @IsString() @MaxLength(2200) postCaption?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) hashtags?: string[];
  @IsOptional() @IsInt() @Min(2) @Max(35) slideCount?: number;
  @ValidateIf((dto) => dto.type !== 'video') @IsIn(['user_provided', 'ai_generated']) imageSource:
    'user_provided' | 'ai_generated';
  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  providedImageUrls?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providedMediaAssetIds?: string[];
  @IsOptional()
  @IsUrl({ require_tld: false })
  providedVideoUrl?: string;
}
