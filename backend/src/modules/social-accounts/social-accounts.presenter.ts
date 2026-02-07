import type { Platform, SocialAccountDocument } from './schemas/social-account.schema';

export interface SocialAccountResponse {
  id: string;
  workspaceId: string;
  platform: Platform;
  platformAccountId: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  lastError: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  voiceProfileId: string | null;
  voiceIngestionConsentedAt: string | null;
  connectedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Section 12: tokens are stripped from anything serialized. This builds the
 * response field by field rather than spreading and deleting, so a token field
 * added to the schema later cannot leak by default.
 */
export function toSocialAccountResponse(
  account: SocialAccountDocument,
): SocialAccountResponse {
  return {
    id: account._id.toString(),
    workspaceId: account.workspaceId.toString(),
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    status: account.status,
    lastError: account.lastError,
    scopes: account.scopes,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    voiceProfileId: account.voiceProfileId?.toString() ?? null,
    voiceIngestionConsentedAt: account.voiceIngestionConsentedAt?.toISOString() ?? null,
    connectedByUserId: account.connectedByUserId.toString(),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}
