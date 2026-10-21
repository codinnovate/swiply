import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { TIKTOK_PRIVACY_LEVELS, type TikTokPrivacyLevel } from '../../../platforms/adapters/tiktok/tiktok-post-settings';

/**
 * What the TikTok post screen sends. Every field except the photo title is
 * required, so a client can't skip a choice TikTok expects the creator to make.
 */
export class TikTokPostSettingsDto {
  @IsOptional() @IsString() @MaxLength(90) title?: string;
  @IsIn(TIKTOK_PRIVACY_LEVELS) privacyLevel: TikTokPrivacyLevel;
  @IsBoolean() allowComment: boolean;
  @IsBoolean() allowDuet: boolean;
  @IsBoolean() allowStitch: boolean;
  @IsBoolean() brandOrganic: boolean;
  @IsBoolean() brandContent: boolean;
  @IsBoolean() autoAddMusic: boolean;
  @IsBoolean() isAigc: boolean;
  /** The creator ticked through TikTok's Music Usage / Branded Content consent. */
  @Equals(true) consent: true;
}

export class PublishNowDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TikTokPostSettingsDto)
  tiktok?: TikTokPostSettingsDto;
}
