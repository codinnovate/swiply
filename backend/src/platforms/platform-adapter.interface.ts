import type { Platform } from '../modules/social-accounts/schemas/social-account.schema';

export const CONTENT_TYPES = ['slideshow', 'video', 'post'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** What an adapter needs to build an authorize URL. */
export interface OAuthAuthorizeRequest {
  /** Opaque signed state minted by OAuthStateService — adapters never build it. */
  state: string;
  /** Absolute, must match the URI registered in the provider's console. */
  redirectUri: string;
  /** S256 challenge; only read by adapters whose capabilities set `usesPkce`. */
  codeChallenge: string;
}

/** What an adapter needs to exchange an authorization code. */
export interface OAuthExchangeRequest {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface PlatformCredentials {
  accessToken: string;
  refreshToken: string | null;
  /** null when the platform issues non-expiring tokens. */
  expiresAt: Date | null;
  scopes: string[];
}

export interface PlatformIdentity {
  accountId: string;
  displayName: string;
  avatarUrl: string | null;
}

export type PlatformConnection = PlatformCredentials & PlatformIdentity;

/**
 * The Section 6 capability table as data. `validateContent` reads it, and so
 * will the volume distributor (Section 9) when it needs to know which accounts
 * can take which content type.
 */
export interface PlatformCapabilities {
  platform: Platform;
  usesPkce: boolean;
  supportsSlideshow: boolean;
  /** Inclusive bounds on images in a slideshow; null when unsupported. */
  slideshowImageRange: [min: number, max: number] | null;
  supportsVideo: boolean;
  supportsPost: boolean;
  /** Whether a post/slideshow may carry no image at all. */
  allowsTextOnlyPost: boolean;
  supportsMentions: boolean;
  supportsReplies: boolean;
  maxTextLength: number | null;
}

/**
 * The minimum shape `validateContent` needs. The `Content` document from
 * build step 4 satisfies it structurally, so nothing has to be adapted when it
 * lands.
 */
export interface ValidatableContent {
  type: ContentType;
  imageCount: number;
  text?: string | null;
}

export interface ContentValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Section 6. Build step 2 implements the OAuth half plus `validateContent`;
 * `fetchRecentPosts` lands with voice ingestion (step 3) and the publish and
 * mention methods with steps 6 and 10. `BasePlatformAdapter` supplies the
 * not-yet-built ones so an accidental early call fails loudly instead of
 * silently returning nothing.
 *
 * Deviations from the interface as written in Section 6, all so that no adapter
 * ever holds a decrypted token longer than the call that needs it and no
 * adapter can mint its own OAuth state:
 *   - `getOAuthUrl` takes the pre-signed state and PKCE challenge rather than a
 *     raw workspaceId, so the workspace binding is signed in one place.
 *   - `handleOAuthCallback` also takes the redirect URI and PKCE verifier,
 *     both of which the token exchange requires.
 *   - `refreshAccessToken` takes the refresh token, not the SocialAccount, so
 *     decryption stays in SocialAccountsService.
 */
export interface PlatformAdapter {
  readonly capabilities: PlatformCapabilities;

  /** False when the platform's credentials are absent from the environment. */
  isConfigured(): boolean;

  getOAuthUrl(request: OAuthAuthorizeRequest): string;
  handleOAuthCallback(request: OAuthExchangeRequest): Promise<PlatformConnection>;
  refreshAccessToken(refreshToken: string): Promise<PlatformCredentials>;

  validateContent(content: ValidatableContent): ContentValidationResult;
}

/** Injection token for the platform registry. */
export const PLATFORM_ADAPTERS = Symbol('PLATFORM_ADAPTERS');
