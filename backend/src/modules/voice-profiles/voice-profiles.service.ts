import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { PlatformRegistry } from '../../platforms/platform-registry.service';
import {
  SocialAccount,
  SocialAccountDocument,
} from '../social-accounts/schemas/social-account.schema';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';
import { SourcePost, SourcePostDocument } from './schemas/source-post.schema';
import { VoiceProfile, VoiceProfileDocument } from './schemas/voice-profile.schema';
import { VoiceAnalysisService } from './voice-analysis.service';

const MAX_SAMPLES = 200;

@Injectable()
export class VoiceProfilesService {
  constructor(
    @InjectModel(SourcePost.name) private readonly sourcePostModel: Model<SourcePostDocument>,
    @InjectModel(VoiceProfile.name) private readonly profileModel: Model<VoiceProfileDocument>,
    @InjectModel(SocialAccount.name) private readonly accountModel: Model<SocialAccountDocument>,
    private readonly socialAccounts: SocialAccountsService,
    private readonly registry: PlatformRegistry,
    private readonly analysis: VoiceAnalysisService,
  ) {}

  async get(workspaceId: string, accountId: string): Promise<VoiceProfileDocument | null> {
    const account = await this.account(workspaceId, accountId);
    return this.profileModel
      .findOne({ workspaceId: account.workspaceId, socialAccountId: account._id })
      .exec();
  }

  async update(
    workspaceId: string,
    accountId: string,
    dto: UpdateVoiceProfileDto,
  ): Promise<VoiceProfileDocument> {
    const account = await this.account(workspaceId, accountId);
    const profile = await this.profileModel
      .findOneAndUpdate(
        { workspaceId: account.workspaceId, socialAccountId: account._id },
        { $set: { userSetTone: dto.userSetTone } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    return profile;
  }

  async ingest(
    workspaceId: string,
    accountId: string,
    userId: string,
  ): Promise<VoiceProfileDocument> {
    const account = await this.account(workspaceId, accountId);
    if (!account.voiceIngestionConsentedAt) {
      throw ApiException.forbidden(
        'VOICE_INGESTION_CONSENT_REQUIRED',
        'Voice learning consent is required for this account',
      );
    }

    const token = await this.socialAccounts.getUsableAccessToken(workspaceId, accountId);
    const posts = await this.registry.get(account.platform).fetchRecentPosts(token, MAX_SAMPLES);
    for (const post of posts) {
      await this.sourcePostModel
        .updateOne(
          { socialAccountId: account._id, platformPostId: post.platformPostId },
          {
            $set: {
              workspaceId: account.workspaceId,
              platform: account.platform,
              text: post.text,
              postedAt: post.postedAt,
              engagementScore: post.engagementScore,
              fetchedAt: new Date(),
            },
          },
          { upsert: true },
        )
        .exec();
    }
    const old = await this.sourcePostModel
      .find({ socialAccountId: account._id })
      .sort({ postedAt: -1 })
      .skip(MAX_SAMPLES)
      .select('_id')
      .exec();
    if (old.length)
      await this.sourcePostModel.deleteMany({ _id: { $in: old.map((post) => post._id) } }).exec();
    return this.analyzeStored(account, userId);
  }

  async listSourcePosts(workspaceId: string, accountId: string): Promise<SourcePostDocument[]> {
    const account = await this.account(workspaceId, accountId);
    return this.sourcePostModel
      .find({ workspaceId: account.workspaceId, socialAccountId: account._id })
      .sort({ postedAt: -1 })
      .exec();
  }

  async deleteSourcePost(
    workspaceId: string,
    accountId: string,
    sourcePostId: string,
    userId: string,
  ): Promise<void> {
    const account = await this.account(workspaceId, accountId);
    if (!isValidObjectId(sourcePostId)) throw ApiException.notFound('Source post');
    const result = await this.sourcePostModel
      .deleteOne({
        _id: new Types.ObjectId(sourcePostId),
        workspaceId: account.workspaceId,
        socialAccountId: account._id,
      })
      .exec();
    if (!result.deletedCount) throw ApiException.notFound('Source post');
    await this.analyzeStored(account, userId);
  }

  private async analyzeStored(
    account: SocialAccountDocument,
    userId: string,
  ): Promise<VoiceProfileDocument> {
    const posts = await this.sourcePostModel
      .find({ socialAccountId: account._id })
      .sort({ postedAt: -1 })
      .exec();
    const result = await this.analysis.analyzeVoice(userId, posts);
    const profile = await this.profileModel
      .findOneAndUpdate(
        { workspaceId: account.workspaceId, socialAccountId: account._id },
        {
          $set: {
            styleSummary: result.styleSummary,
            styleAttributes: result.styleAttributes,
            fewShotExampleIds: result.fewShotExampleIds.map((id) => new Types.ObjectId(id)),
            sampleCount: posts.length,
            lastAnalyzedAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    account.voiceProfileId = profile._id;
    await account.save();
    return profile;
  }

  private async account(workspaceId: string, accountId: string): Promise<SocialAccountDocument> {
    if (!isValidObjectId(accountId)) throw ApiException.notFound('Social account');
    const account = await this.accountModel
      .findOne({ _id: new Types.ObjectId(accountId), workspaceId: new Types.ObjectId(workspaceId) })
      .select('+accessToken +refreshToken')
      .exec();
    if (!account) throw ApiException.notFound('Social account');
    return account;
  }
}
