import { ApiException } from '../../../common/errors/api.exception';

export const TIKTOK_PRIVACY_LEVELS = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
] as const;
export type TikTokPrivacyLevel = (typeof TIKTOK_PRIVACY_LEVELS)[number];

/**
 * The choices TikTok's Direct Post guidelines require the creator to make on
 * every post: privacy has no default, interactions start unchecked, commercial
 * disclosure is explicit, and posting needs express consent. Swiply never
 * invents these values, so a post without them can't be published directly.
 */
export interface TikTokPostSettings {
  /** Photo posts only: TikTok caps the photo title at 90 runes. */
  title?: string | null;
  privacyLevel: TikTokPrivacyLevel;
  allowComment: boolean;
  /** Videos only; ignored for photo posts. */
  allowDuet: boolean;
  /** Videos only; ignored for photo posts. */
  allowStitch: boolean;
  /** "Your brand": labeled "Promotional content". */
  brandOrganic: boolean;
  /** "Branded content": labeled "Paid partnership". */
  brandContent: boolean;
  /** Photo posts only. */
  autoAddMusic: boolean;
  /** Labels the post as AI-generated content. */
  isAigc: boolean;
  /** When the creator accepted the Music Usage / Branded Content consent text. */
  consentedAt: Date;
}

/** `POST /v2/post/publish/creator_info/query/`, normalized. */
export interface TikTokCreatorInfo {
  username: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  privacyLevelOptions: TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
}

function invalid(message: string): ApiException {
  return ApiException.unprocessable('TIKTOK_POST_SETTINGS_INVALID', message);
}

/** Rules that hold regardless of the creator's account, checked when the post is saved. */
export function assertSettingsShape(settings: TikTokPostSettings): void {
  if (settings.brandContent && settings.privacyLevel === 'SELF_ONLY') {
    throw invalid('Branded content cannot be private. Choose a public or friends visibility.');
  }
  if (settings.title && [...settings.title].length > 90) {
    throw invalid('TikTok photo titles are limited to 90 characters.');
  }
}

/**
 * Rules that depend on the creator's current account state, checked against a
 * fresh creator_info response immediately before publishing.
 */
export function assertSettingsAllowed(
  settings: TikTokPostSettings,
  creator: TikTokCreatorInfo,
  media: { isVideo: boolean; durationSeconds?: number | null },
): void {
  assertSettingsShape(settings);
  if (!creator.privacyLevelOptions.includes(settings.privacyLevel)) {
    throw invalid(
      `This TikTok account can't post with "${settings.privacyLevel}" visibility. Choose one of: ${creator.privacyLevelOptions.join(', ')}.`,
    );
  }
  if (settings.allowComment && creator.commentDisabled) {
    throw invalid('Comments are turned off for this TikTok account.');
  }
  if (media.isVideo && settings.allowDuet && creator.duetDisabled) {
    throw invalid('Duet is turned off for this TikTok account.');
  }
  if (media.isVideo && settings.allowStitch && creator.stitchDisabled) {
    throw invalid('Stitch is turned off for this TikTok account.');
  }
  if (
    media.isVideo &&
    media.durationSeconds &&
    creator.maxVideoPostDurationSec &&
    media.durationSeconds > creator.maxVideoPostDurationSec
  ) {
    throw invalid(
      `This TikTok account can post videos up to ${creator.maxVideoPostDurationSec} seconds long.`,
    );
  }
}

/** Shared `post_info` fields for both the video and photo init endpoints. */
export function commonPostInfo(settings: TikTokPostSettings) {
  return {
    privacy_level: settings.privacyLevel,
    disable_comment: !settings.allowComment,
    brand_content_toggle: settings.brandContent,
    brand_organic_toggle: settings.brandOrganic,
  };
}
