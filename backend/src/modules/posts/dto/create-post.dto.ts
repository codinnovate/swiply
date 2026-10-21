import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsMongoId, IsOptional, ValidateNested } from 'class-validator';
import { TikTokPostSettingsDto } from './tiktok-post-settings.dto';

export class CreatePostDto {
  @IsMongoId() contentId: string;
  @IsMongoId() socialAccountId: string;
  @IsDateString() scheduledFor: string;
  @IsOptional() @IsMongoId() scheduleId?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  publishNow?: boolean;
  /** Required to publish to a directly connected TikTok account. */
  @IsOptional()
  @ValidateNested()
  @Type(() => TikTokPostSettingsDto)
  tiktok?: TikTokPostSettingsDto;
}
