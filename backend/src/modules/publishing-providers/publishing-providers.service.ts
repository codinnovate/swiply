import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TokenCipher } from '../../common/crypto/token-cipher.service';
import { ApiException } from '../../common/errors/api.exception';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import {
  SocialAccount,
  SocialAccountDocument,
} from '../social-accounts/schemas/social-account.schema';
import {
  DiscoverPublishingProviderDto,
  ImportProviderChannelsDto,
  SavePublishingProviderDto,
} from './dto/publishing-provider.dto';
import {
  DiscoveredChannel,
  GatewayPost,
  PublishingProviderGateway,
} from './publishing-provider.gateway';
import {
  PublishingProvider,
  PublishingProviderConnection,
  PublishingProviderConnectionDocument,
} from './schemas/publishing-provider-connection.schema';

@Injectable()
export class PublishingProvidersService {
  constructor(
    @InjectModel(PublishingProviderConnection.name)
    private readonly connections: Model<PublishingProviderConnectionDocument>,
    @InjectModel(SocialAccount.name) private readonly accounts: Model<SocialAccountDocument>,
    @InjectModel(Post.name) private readonly posts: Model<PostDocument>,
    private readonly cipher: TokenCipher,
    private readonly gateway: PublishingProviderGateway,
  ) {}

  async list(workspaceId: string) {
    const items = await this.connections
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ provider: 1 })
      .exec();
    return items.map((item) => this.present(item));
  }

  discover(provider: PublishingProvider, dto: DiscoverPublishingProviderDto) {
    return this.gateway.discover(provider, dto.apiKey.trim(), dto.baseUrl, dto.organizationId);
  }

  async save(
    workspaceId: string,
    userId: string,
    provider: PublishingProvider,
    dto: SavePublishingProviderDto,
  ) {
    const discovered = await this.gateway.discover(
      provider,
      dto.apiKey.trim(),
      dto.baseUrl,
      dto.organizationId,
    );
    if (provider === 'buffer' && !dto.organizationId) {
      throw ApiException.unprocessable(
        'PUBLISHING_PROVIDER_ORGANIZATION_REQUIRED',
        'Choose a Buffer organization',
        { organizations: discovered.organizations },
      );
    }
    const baseUrl =
      provider === 'postiz' ? await this.gateway.assertSafePostizOrigin(dto.baseUrl) : null;
    const organization = discovered.organizations.find((item) => item.id === dto.organizationId);
    const connection = await this.connections
      .findOneAndUpdate(
        { workspaceId: new Types.ObjectId(workspaceId), provider },
        {
          $set: {
            encryptedApiKey: this.cipher.encrypt(dto.apiKey.trim()),
            keyHint: dto.apiKey.trim().slice(-4),
            organizationId: dto.organizationId || null,
            organizationName: organization?.name || dto.organizationName || null,
            baseUrl,
            status: 'active',
            lastError: null,
            lastValidatedAt: new Date(),
            connectedByUserId: new Types.ObjectId(userId),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
    return this.present(connection);
  }

  async channels(workspaceId: string, provider: PublishingProvider) {
    const connection = await this.resolve(workspaceId, provider);
    return (
      await this.gateway.discover(
        provider,
        connection.apiKey,
        connection.baseUrl || undefined,
        connection.organizationId || undefined,
      )
    ).channels;
  }

  async importChannels(
    workspaceId: string,
    userId: string,
    provider: PublishingProvider,
    dto: ImportProviderChannelsDto,
  ) {
    const available = await this.channels(workspaceId, provider);
    const byId = new Map(available.map((item) => [item.id, item]));
    const imported = [] as SocialAccountDocument[];
    for (const requested of dto.channels) {
      const channel = byId.get(requested.id);
      if (!channel || channel.disabled)
        throw ApiException.unprocessable(
          'PUBLISHING_PROVIDER_CHANNEL_INVALID',
          'A selected channel is unavailable',
          { channelId: requested.id },
        );
      this.validateDefaults(channel, requested.publishingDefaults || {});
      imported.push(
        await this.accounts
          .findOneAndUpdate(
            {
              workspaceId: new Types.ObjectId(workspaceId),
              connectionProvider: provider,
              platformAccountId: channel.id,
            },
            {
              $set: {
                platform: channel.platform,
                providerChannelType: channel.providerType,
                displayName: channel.name,
                avatarUrl: channel.avatarUrl,
                status: 'active',
                lastError: null,
                publishingDefaults: requested.publishingDefaults || {},
                connectedByUserId: new Types.ObjectId(userId),
                scopes: [],
                tokenExpiresAt: null,
              },
              $setOnInsert: {
                accessToken: null,
                refreshToken: null,
                voiceProfileId: null,
                voiceIngestionConsentedAt: null,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          )
          .exec(),
      );
    }
    return imported;
  }

  async sync(workspaceId: string, provider: PublishingProvider) {
    const connection = await this.connections
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), provider })
      .select('+encryptedApiKey')
      .exec();
    if (!connection)
      throw ApiException.unprocessable(
        'PUBLISHING_PROVIDER_NOT_CONFIGURED',
        `Connect ${provider} before synchronizing`,
      );
    let remote: DiscoveredChannel[];
    try {
      remote = (
        await this.gateway.discover(
          provider,
          this.cipher.decrypt(connection.encryptedApiKey),
          connection.baseUrl || undefined,
          connection.organizationId || undefined,
        )
      ).channels;
    } catch (error) {
      connection.status = 'error';
      connection.lastError =
        error instanceof Error ? error.message : 'Publishing provider synchronization failed';
      await connection.save();
      throw error;
    }
    const remoteIds = remote.map((item) => item.id);
    await Promise.all(
      remote.map((channel) =>
        this.accounts
          .updateOne(
            {
              workspaceId: new Types.ObjectId(workspaceId),
              connectionProvider: provider,
              platformAccountId: channel.id,
            },
            {
              $set: {
                displayName: channel.name,
                avatarUrl: channel.avatarUrl,
                providerChannelType: channel.providerType,
                status: channel.disabled ? 'error' : 'active',
                lastError: channel.disabled
                  ? 'Channel is disabled by the publishing provider'
                  : null,
              },
            },
          )
          .exec(),
      ),
    );
    await this.accounts
      .updateMany(
        {
          workspaceId: new Types.ObjectId(workspaceId),
          connectionProvider: provider,
          platformAccountId: { $nin: remoteIds },
        },
        {
          $set: {
            status: 'revoked',
            lastError: 'Channel is no longer available from the publishing provider',
          },
        },
      )
      .exec();
    connection.status = 'active';
    connection.lastError = null;
    connection.lastValidatedAt = new Date();
    await connection.save();
    return { channels: remote, synchronizedAt: new Date() };
  }

  async syncAllConnections() {
    const connections = await this.connections.find({}).select('workspaceId provider').exec();
    let synchronized = 0;
    let failed = 0;
    for (const connection of connections) {
      try {
        await this.sync(connection.workspaceId.toString(), connection.provider);
        synchronized += 1;
      } catch {
        failed += 1;
      }
    }
    return { checked: connections.length, synchronized, failed };
  }

  async remove(workspaceId: string, provider: PublishingProvider) {
    const accountIds = await this.accounts
      .find({ workspaceId: new Types.ObjectId(workspaceId), connectionProvider: provider })
      .distinct('_id')
      .exec();
    const pending = await this.posts
      .countDocuments({
        workspaceId: new Types.ObjectId(workspaceId),
        socialAccountId: { $in: accountIds },
        status: { $in: ['queued', 'processing', 'pending_review'] },
        scheduledFor: { $gt: new Date() },
      })
      .exec();
    if (pending)
      throw ApiException.unprocessable(
        'PUBLISHING_PROVIDER_HAS_PENDING_POSTS',
        'Cancel future posts before removing this provider',
        { pending },
      );
    await this.accounts
      .updateMany(
        { workspaceId: new Types.ObjectId(workspaceId), connectionProvider: provider },
        { $set: { status: 'revoked', lastError: 'Publishing provider disconnected' } },
      )
      .exec();
    await this.connections
      .deleteOne({ workspaceId: new Types.ObjectId(workspaceId), provider })
      .exec();
  }

  async createPost(
    workspaceId: string,
    account: SocialAccountDocument,
    post: Omit<GatewayPost, 'channelId' | 'providerType' | 'defaults'>,
  ) {
    const provider = account.connectionProvider as PublishingProvider;
    const connection = await this.resolve(workspaceId, provider);
    return this.gateway.createPost(connection, {
      ...post,
      channelId: account.platformAccountId,
      providerType: account.providerChannelType || account.platform,
      defaults: account.publishingDefaults || {},
    });
  }

  async deletePost(workspaceId: string, provider: PublishingProvider, id: string) {
    return this.gateway.deletePost(await this.resolve(workspaceId, provider), id);
  }

  async getPostStatus(
    workspaceId: string,
    provider: PublishingProvider,
    id: string,
    scheduledFor: Date,
  ) {
    return this.gateway.getPostStatus(await this.resolve(workspaceId, provider), id, scheduledFor);
  }

  private async resolve(workspaceId: string, provider: PublishingProvider) {
    const connection = await this.connections
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), provider, status: 'active' })
      .select('+encryptedApiKey')
      .exec();
    if (!connection)
      throw ApiException.unprocessable(
        'PUBLISHING_PROVIDER_NOT_CONFIGURED',
        `Connect ${provider} before publishing`,
      );
    return {
      provider,
      apiKey: this.cipher.decrypt(connection.encryptedApiKey),
      baseUrl: connection.baseUrl,
      organizationId: connection.organizationId,
    };
  }

  private validateDefaults(channel: DiscoveredChannel, defaults: Record<string, unknown>) {
    if (channel.platform === 'pinterest' && !defaults.board)
      throw ApiException.unprocessable(
        'PUBLISHING_PROVIDER_DEFAULTS_REQUIRED',
        'Choose a Pinterest board before importing this channel',
      );
    if (channel.platform === 'tiktok') {
      const required = [
        'privacy_level',
        'duet',
        'stitch',
        'comment',
        'autoAddMusic',
        'brand_content_toggle',
        'brand_organic_toggle',
        'content_posting_method',
      ];
      if (required.some((key) => !(key in defaults)))
        throw ApiException.unprocessable(
          'PUBLISHING_PROVIDER_DEFAULTS_REQUIRED',
          'Complete the TikTok publishing defaults before importing this channel',
        );
    }
    if (channel.platform === 'instagram' && !defaults.post_type)
      throw ApiException.unprocessable(
        'PUBLISHING_PROVIDER_DEFAULTS_REQUIRED',
        'Choose an Instagram post type before importing this channel',
      );
  }

  private present(item: PublishingProviderConnectionDocument) {
    return {
      id: item.id,
      provider: item.provider,
      keyHint: item.keyHint,
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      baseUrl: item.baseUrl,
      status: item.status,
      lastError: item.lastError,
      lastValidatedAt: item.lastValidatedAt,
      updatedAt: item.updatedAt,
    };
  }
}
