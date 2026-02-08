import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';

import { TokenCipher } from '../../common/crypto/token-cipher.service';
import { ApiException, ApiErrorBody } from '../../common/errors/api.exception';
import { OAuthStateService } from '../../platforms/oauth-state.service';
import {
  PlatformRegistry,
  type PlatformAvailability,
} from '../../platforms/platform-registry.service';
import {
  WorkspaceMember,
  WorkspaceMemberDocument,
} from '../workspaces/schemas/workspace-member.schema';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import {
  SocialAccount,
  SocialAccountDocument,
  type Platform,
} from './schemas/social-account.schema';

/** Refresh this far ahead of expiry so a publish never races the deadline. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface ConnectHandoff {
  authorizeUrl: string;
  platform: Platform;
}

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    @InjectModel(SocialAccount.name)
    private readonly accountModel: Model<SocialAccountDocument>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMemberDocument>,
    private readonly registry: PlatformRegistry,
    private readonly oauthState: OAuthStateService,
    private readonly cipher: TokenCipher,
    private readonly config: ConfigService,
  ) {}

  listPlatforms(): PlatformAvailability[] {
    return this.registry.list();
  }

  async list(workspaceId: string): Promise<SocialAccountDocument[]> {
    return this.accountModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * Mints the signed state and hands back the platform's authorize URL. The
   * dashboard navigates to it; we deliberately do not 302 from here, because
   * the caller is an XHR carrying a bearer token and a redirect would be
   * followed by fetch() rather than by the browser.
   */
  beginConnect(workspaceId: string, userId: string, platform: string): ConnectHandoff {
    const adapter = this.registry.get(platform);
    const resolved = adapter.capabilities.platform;

    const { state, codeChallenge } = this.oauthState.mint({ workspaceId, userId, platform: resolved });

    return {
      platform: resolved,
      authorizeUrl: adapter.getOAuthUrl({
        state,
        redirectUri: this.redirectUriFor(resolved),
        codeChallenge,
      }),
    };
  }

  /**
   * Runs unauthenticated — the platform redirects the user's browser here with
   * no bearer token, so the signed state is the only proof of who started this.
   * Always resolves to a frontend URL: the caller is a browser mid-redirect and
   * a JSON error body would strand the user on a blank page.
   */
  async completeConnect(platform: string, query: OAuthCallbackDto): Promise<string> {
    try {
      return await this.connectFromCallback(platform, query);
    } catch (error) {
      const code =
        error instanceof ApiException
          ? (error.getResponse() as ApiErrorBody).error.code
          : 'INTERNAL_ERROR';

      if (!(error instanceof ApiException)) {
        this.logger.error(`Unexpected failure completing a ${platform} connection`, error);
      }

      return this.frontendUrl({ status: 'error', platform, code });
    }
  }

  private async connectFromCallback(
    platform: string,
    query: OAuthCallbackDto,
  ): Promise<string> {
    // Verified before anything else — an invalid state means we cannot trust
    // the platform slug, the code, or which workspace this is even for.
    const claims = this.oauthState.verify(query.state, platform as Platform);

    if (query.error || query.error_reason) {
      throw ApiException.unprocessable(
        'OAUTH_ACCESS_DENIED',
        'The connection was declined on the platform',
        { platform },
      );
    }

    if (!query.code) {
      throw ApiException.unprocessable(
        'OAUTH_EXCHANGE_FAILED',
        'The platform returned no authorization code',
        { platform },
      );
    }

    // Membership is re-checked here rather than trusted from the state: minting
    // it may have been minutes ago, and the user could have been removed from
    // the workspace in between.
    await this.assertActiveMember(claims.workspaceId, claims.userId);

    const adapter = this.registry.get(platform);
    const connection = await adapter.handleOAuthCallback({
      code: query.code,
      redirectUri: this.redirectUriFor(claims.platform),
      codeVerifier: claims.codeVerifier,
    });

    const account = await this.accountModel
      .findOneAndUpdate(
        {
          workspaceId: new Types.ObjectId(claims.workspaceId),
          platform: claims.platform,
          platformAccountId: connection.accountId,
        },
        {
          $set: {
            displayName: connection.displayName,
            avatarUrl: connection.avatarUrl,
            accessToken: this.cipher.encrypt(connection.accessToken),
            refreshToken: this.cipher.encryptNullable(connection.refreshToken),
            tokenExpiresAt: connection.expiresAt,
            scopes: connection.scopes,
            status: 'active',
            // A reconnect is how a user fixes a revoked or errored account.
            lastError: null,
            connectedByUserId: new Types.ObjectId(claims.userId),
          },
          // Consent survives a reconnect; asking again would be the only way to
          // revoke it, and re-granting it silently would be worse.
          $setOnInsert: { voiceIngestionConsentedAt: null, voiceProfileId: null },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    this.logger.log(
      `Connected ${claims.platform} account ${account._id.toString()} to workspace ${claims.workspaceId}`,
    );

    return this.frontendUrl({
      status: 'connected',
      platform: claims.platform,
      accountId: account._id.toString(),
      // Section 7: the frontend owns the "learn your voice?" prompt, because
      // this endpoint cannot ask a question mid-redirect.
      ...(account.voiceIngestionConsentedAt ? {} : { askVoiceConsent: '1' }),
    });
  }

  async disconnect(workspaceId: string, accountId: string): Promise<void> {
    const account = await this.findOwnedOrFail(workspaceId, accountId);

    // Hard delete, not a soft one. The row's whole purpose is to hold
    // credentials, and Section 12 treats "still in the database somewhere"
    // as not deleted.
    await this.accountModel.deleteOne({ _id: account._id }).exec();

    this.logger.log(`Disconnected ${account.platform} account ${accountId}`);
  }

  async recordVoiceConsent(
    workspaceId: string,
    accountId: string,
    consent: boolean,
  ): Promise<SocialAccountDocument> {
    const account = await this.findOwnedOrFail(workspaceId, accountId);

    account.voiceIngestionConsentedAt = consent ? new Date() : null;
    return account.save();
  }

  /**
   * The single place a platform token is decrypted. Refreshes ahead of expiry
   * so callers in later build steps never have to reason about token lifetime.
   */
  async getUsableAccessToken(workspaceId: string, accountId: string): Promise<string> {
    const account = await this.accountModel
      .findOne({
        _id: this.toObjectId(accountId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .select('+accessToken +refreshToken')
      .exec();

    if (!account) throw this.notFound(accountId);

    const expiring =
      account.tokenExpiresAt !== null &&
      account.tokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

    if (expiring) {
      return this.refresh(account);
    }

    return this.cipher.decrypt(account.accessToken);
  }

  private async refresh(account: SocialAccountDocument): Promise<string> {
    const storedRefreshToken = this.cipher.decryptNullable(account.refreshToken);

    if (!storedRefreshToken) {
      await this.markUnusable(account, 'expired', 'Token expired and no refresh token is stored');
      throw ApiException.unprocessable(
        'TOKEN_REFRESH_FAILED',
        `Reconnect your ${account.platform} account`,
        { platform: account.platform, accountId: account._id.toString() },
      );
    }

    try {
      const adapter = this.registry.get(account.platform);
      const credentials = await adapter.refreshAccessToken(storedRefreshToken);

      account.accessToken = this.cipher.encrypt(credentials.accessToken);
      // Providers that rotate refresh tokens invalidate the old one, so a
      // missing value here means "keep", never "clear".
      if (credentials.refreshToken) {
        account.refreshToken = this.cipher.encrypt(credentials.refreshToken);
      }
      account.tokenExpiresAt = credentials.expiresAt;
      account.status = 'active';
      account.lastError = null;
      await account.save();

      return credentials.accessToken;
    } catch (error) {
      const reason =
        error instanceof ApiException
          ? (error.getResponse() as ApiErrorBody).error.message
          : 'Refresh failed';

      // Surfaced on the account so the dashboard shows a dead connection
      // instead of the publish worker rediscovering it on every run.
      await this.markUnusable(account, 'expired', reason);
      throw error;
    }
  }

  private async markUnusable(
    account: SocialAccountDocument,
    status: 'expired' | 'revoked' | 'error',
    reason: string,
  ): Promise<void> {
    await this.accountModel
      .updateOne({ _id: account._id }, { $set: { status, lastError: reason } })
      .exec();
  }

  private async findOwnedOrFail(
    workspaceId: string,
    accountId: string,
  ): Promise<SocialAccountDocument> {
    const account = await this.accountModel
      .findOne({
        _id: this.toObjectId(accountId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();

    if (!account) throw this.notFound(accountId);
    return account;
  }

  private async assertActiveMember(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.memberModel
      .findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        status: 'active',
      })
      .lean()
      .exec();

    if (!membership) {
      throw ApiException.forbidden(
        'WORKSPACE_ACCESS_DENIED',
        'You do not have access to this workspace',
      );
    }
  }

  private toObjectId(accountId: string): Types.ObjectId {
    // A malformed id is a miss, not a cast crash — and it must look identical
    // to an id belonging to another workspace.
    if (!isValidObjectId(accountId)) throw this.notFound(accountId);
    return new Types.ObjectId(accountId);
  }

  private notFound(accountId: string): ApiException {
    return new ApiException(
      'SOCIAL_ACCOUNT_NOT_FOUND',
      'Social account not found',
      404,
      { accountId },
    );
  }

  private redirectUriFor(platform: Platform): string {
    const base = this.config.get<string>('app.apiBaseUrl') ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/api/social-accounts/callback/${platform}`;
  }

  private frontendUrl(params: Record<string, string>): string {
    const base = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3001';
    const url = new URL('/settings/social-accounts', base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
}
