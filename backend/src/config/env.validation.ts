import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Every variable in Section 13 of AGENTS.md lives here. Only the ones the
 * currently-built modules actually read are required; the rest are declared
 * optional so a partially-configured environment still boots, and each build
 * step flips its own vars to required as it lands.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // Env values arrive as strings; converted explicitly rather than relying on
  // implicit conversion, which would also coerce the string fields below.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  // --- Auth (Section 2) ---
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN = '7d';

  @IsString()
  @IsOptional()
  GOOGLE_OAUTH_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_OAUTH_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_OAUTH_CALLBACK_URL?: string;

  /** Where the dashboard lives — used to bounce the user back after Google OAuth. */
  @IsString()
  @IsOptional()
  FRONTEND_URL = 'http://localhost:3001';

  /**
   * Public origin of this API, used to build platform OAuth redirect URIs.
   * Not in Section 13's list — added by build step 2, which cannot register a
   * relative redirect URI with TikTok/Meta/X.
   */
  @IsString()
  @IsOptional()
  API_BASE_URL = 'http://localhost:3000';

  /**
   * AES-256-GCM key for SocialAccount tokens (Section 12). 64 hex chars = 32
   * bytes. Required as of build step 2, which stores platform tokens.
   */
  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message: 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
  })
  ENCRYPTION_KEY: string;

  // --- Declared now, required by later build steps ---
  @IsString() @IsOptional() ANTHROPIC_API_KEY?: string;
  @IsString() @IsOptional() IMAGE_GEN_API_KEY?: string;
  @IsString() @IsOptional() VIDEO_GEN_API_KEY?: string;
  @IsString() @IsOptional() TTS_API_KEY?: string;
  @IsString() @IsOptional() CLOUDINARY_URL?: string;
  @IsString() @IsOptional() STRIPE_SECRET_KEY?: string;
  @IsString() @IsOptional() STRIPE_WEBHOOK_SECRET?: string;
  @IsString() @IsOptional() REDIS_URL?: string;
  // --- Platform OAuth (Section 6). Optional: an unconfigured platform is
  // refused at connect time, it does not stop the app booting. ---
  @IsString() @IsOptional() TIKTOK_CLIENT_KEY?: string;
  @IsString() @IsOptional() TIKTOK_CLIENT_SECRET?: string;
  @IsString() @IsOptional() META_APP_ID?: string;
  @IsString() @IsOptional() META_APP_SECRET?: string;
  @IsString() @IsOptional() META_WEBHOOK_VERIFY_TOKEN?: string;
  @IsString() @IsOptional() PINTEREST_APP_ID?: string;
  @IsString() @IsOptional() PINTEREST_APP_SECRET?: string;
  @IsString() @IsOptional() TWITTER_CLIENT_ID?: string;
  @IsString() @IsOptional() TWITTER_CLIENT_SECRET?: string;
  @IsIn(['free', 'basic', 'pro']) @IsOptional() TWITTER_API_TIER?: 'free' | 'basic' | 'pro';
  @IsString() @IsOptional() LINKEDIN_CLIENT_ID?: string;
  @IsString() @IsOptional() LINKEDIN_CLIENT_SECRET?: string;
  @IsString() @IsOptional() RESEND_API_KEY?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return config;
}
