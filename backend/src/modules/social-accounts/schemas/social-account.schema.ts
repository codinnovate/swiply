import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const PLATFORMS = [
  'tiktok',
  'instagram',
  'facebook',
  'pinterest',
  'twitter',
  'linkedin',
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const SOCIAL_ACCOUNT_STATUSES = ['active', 'expired', 'revoked', 'error'] as const;
export type SocialAccountStatus = (typeof SOCIAL_ACCOUNT_STATUSES)[number];

/** Section 4.4 */
@Schema({ timestamps: true, collection: 'socialaccounts' })
export class SocialAccount {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: PLATFORMS, required: true })
  platform: Platform;

  /** The platform's own id for the account — stable across reconnects. */
  @Prop({ required: true })
  platformAccountId: string;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  /**
   * AES-256-GCM ciphertext, never the raw token (Section 12). `select: false`
   * so a plain find() cannot accidentally carry it into a response — reading it
   * takes an explicit .select('+accessToken').
   */
  @Prop({ required: true, select: false })
  accessToken: string;

  @Prop({ type: String, default: null, select: false })
  refreshToken: string | null;

  @Prop({ type: Date, default: null })
  tokenExpiresAt: Date | null;

  @Prop({ type: [String], default: [] })
  scopes: string[];

  @Prop({ type: String, enum: SOCIAL_ACCOUNT_STATUSES, default: 'active', index: true })
  status: SocialAccountStatus;

  /** Last platform-reported failure, surfaced in the dashboard so a dead
   * connection is visible before the publish worker trips over it. */
  @Prop({ type: String, default: null })
  lastError: string | null;

  @Prop({ type: Types.ObjectId, ref: 'VoiceProfile', default: null })
  voiceProfileId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  connectedByUserId: Types.ObjectId;

  /**
   * Section 7: voice learning is explicit opt-in, asked after the OAuth
   * callback returns. Null means the user has not answered yet — build step 3
   * reads this to decide whether `ingest-voice-samples` may run at all, so the
   * consent decision outlives the request that captured it.
   */
  @Prop({ type: Date, default: null })
  voiceIngestionConsentedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type SocialAccountDocument = HydratedDocument<SocialAccount>;
export const SocialAccountSchema = SchemaFactory.createForClass(SocialAccount);

// Section 4.18: one row per platform account per workspace. Reconnecting the
// same account updates the existing row rather than accumulating duplicates
// with stale tokens that the refresh sweep would keep trying to renew.
SocialAccountSchema.index(
  { workspaceId: 1, platform: 1, platformAccountId: 1 },
  { unique: true },
);

// The token refresh sweep (Section 9.4) scans for tokens nearing expiry.
SocialAccountSchema.index({ status: 1, tokenExpiresAt: 1 });
