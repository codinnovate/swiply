import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  /**
   * Public origin of this API. Platform OAuth redirect URIs must be absolute
   * and must match what is registered in each provider's developer console,
   * so they are built from this rather than from the inbound request Host —
   * a forged Host header would otherwise redirect codes somewhere else.
   */
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
}));

export const databaseConfig = registerAs('database', () => ({
  uri: process.env.MONGODB_URI as string,
}));

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackUrl:
      process.env.GOOGLE_OAUTH_CALLBACK_URL ??
      'http://localhost:3000/api/auth/google/callback',
  },
}));

/** AES-256-GCM key material for SocialAccount tokens at rest (Section 12). */
export const encryptionConfig = registerAs('encryption', () => ({
  key: process.env.ENCRYPTION_KEY as string,
}));

/**
 * Per-platform OAuth credentials (Section 6). Every platform is optional: an
 * unconfigured one fails with PLATFORM_NOT_CONFIGURED at connect time rather
 * than preventing boot, matching how Google sign-in degrades in step 1.
 */
export const platformsConfig = registerAs('platforms', () => ({
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  },
  // Instagram and Facebook are both Meta Graph API apps and share credentials.
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  },
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    /**
     * Section 16 open decision: mention polling needs a paid tier. Adapters read
     * this to decide whether to advertise `supportsMentions` at all, instead of
     * failing at runtime inside the engagement engine (build step 10).
     */
    apiTier: (process.env.TWITTER_API_TIER ?? 'free') as 'free' | 'basic' | 'pro',
  },
}));

export const configurations = [
  appConfig,
  databaseConfig,
  authConfig,
  encryptionConfig,
  platformsConfig,
];
