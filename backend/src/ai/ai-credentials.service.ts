import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TokenCipher } from '../common/crypto/token-cipher.service';
import { ApiException } from '../common/errors/api.exception';
import { SaveAiCredentialDto } from './dto/save-ai-credential.dto';
import { isOpenAiModel } from './openai-models';
import { AiProviderRegistry } from './ai-provider-registry.service';
import {
  AI_MODELS,
  AI_PROVIDER_FALLBACK_ORDER,
  AiProvider,
  isAiProvider,
  isProviderModel,
} from './ai-providers';
import { SaveProviderCredentialDto } from './dto/save-provider-credential.dto';
import { SetAiPreferenceDto } from './dto/set-ai-preference.dto';
import { AiCredential, AiCredentialDocument } from './schemas/ai-credential.schema';

export interface ResolvedAiCredential {
  apiKey: string;
  model: string;
  provider: AiProvider;
}

@Injectable()
export class AiCredentialsService {
  constructor(
    @InjectModel(AiCredential.name) private readonly model: Model<AiCredentialDocument>,
    private readonly cipher: TokenCipher,
    private readonly providers: AiProviderRegistry,
  ) {}

  async save(userId: string, dto: SaveAiCredentialDto) {
    return this.saveProvider(userId, 'openai', dto);
  }

  async saveProvider(userId: string, provider: string, dto: SaveProviderCredentialDto) {
    if (!isAiProvider(provider)) throw ApiException.unprocessable('AI_MODEL_NOT_SUPPORTED', 'Unknown AI provider');
    const apiKey = dto.apiKey.trim();
    await this.providers.validateKey(provider, apiKey, dto.defaultModel);
    const owner = new Types.ObjectId(userId);
    const existing = await this.model.find({ userId: owner }).exec();
    const credential = await this.model
      .findOneAndUpdate(
        { userId: owner, provider },
        {
          $set: {
            encryptedApiKey: this.cipher.encrypt(apiKey),
            keyHint: apiKey.slice(-4),
            defaultModel: dto.defaultModel,
          },
          $setOnInsert: { preferred: existing.length === 0 },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    return this.present(credential);
  }

  async list(userId: string) {
    const credentials = await this.model.find({ userId: new Types.ObjectId(userId) }).exec();
    return credentials.map((credential) => this.present(credential));
  }

  async setTaskPreference(userId: string, dto: SetAiPreferenceDto) {
    if (!isProviderModel(dto.provider, dto.model)) {
      throw ApiException.unprocessable(
        'AI_MODEL_NOT_SUPPORTED',
        `The selected ${dto.provider} model is not supported`,
      );
    }
    const owner = new Types.ObjectId(userId);
    const credential = await this.model.findOne({ userId: owner, provider: dto.provider }).exec();
    if (!credential) {
      throw ApiException.unprocessable(
        'AI_NOT_CONFIGURED',
        `Add your ${dto.provider} key in AI settings before using it for tasks`,
      );
    }
    await this.model.updateMany({ userId: owner }, { $set: { preferred: false } }).exec();
    credential.preferred = true;
    credential.defaultModel = dto.model;
    await credential.save();
    return this.present(credential);
  }

  async resolve(userId: string, requestedModel?: string, requestedProvider?: AiProvider): Promise<ResolvedAiCredential> {
    const credentials = await this.model
      .find({ userId: new Types.ObjectId(userId) })
      .select('+encryptedApiKey')
      .exec();
    const modelProvider = requestedModel
      ? AI_MODELS.find((model) => model.id === requestedModel)?.provider
      : undefined;
    const provider = requestedProvider ?? modelProvider;
    const credential = provider
      ? credentials.find((item) => item.provider === provider)
      : credentials.find((item) => item.preferred) ?? pickFallback(credentials);
    if (!credential) {
      throw ApiException.unprocessable(
        'AI_NOT_CONFIGURED',
        `Add your ${provider ?? 'AI provider'} key in AI settings before using AI features`,
      );
    }
    const model = requestedModel ?? credential.defaultModel;
    if (credential.provider === 'openai' ? !isOpenAiModel(model) : !this.providers.models(credential.provider).some((item) => item.id === model)) {
      throw ApiException.unprocessable(
        'AI_MODEL_NOT_SUPPORTED',
        `The selected ${credential.provider} model is not supported`,
      );
    }
    return {
      apiKey: this.cipher.decrypt(credential.encryptedApiKey),
      model,
      provider: credential.provider,
    };
  }

  async remove(userId: string): Promise<void> {
    await this.removeProvider(userId, 'openai');
  }

  async removeProvider(userId: string, provider: string): Promise<void> {
    if (!isAiProvider(provider)) throw ApiException.unprocessable('AI_MODEL_NOT_SUPPORTED', 'Unknown AI provider');
    const owner = new Types.ObjectId(userId);
    await this.model.deleteOne({ userId: owner, provider }).exec();
    const remaining = await this.model.find({ userId: owner }).exec();
    if (remaining.length && !remaining.some((item) => item.preferred)) {
      const next = pickFallback(remaining);
      if (next) {
        next.preferred = true;
        await next.save();
      }
    }
  }

  private present(credential: AiCredentialDocument) {
    return {
      provider: credential.provider,
      keyHint: credential.keyHint,
      defaultModel: credential.defaultModel,
      preferred: Boolean(credential.preferred),
      updatedAt: credential.updatedAt,
    };
  }
}

function pickFallback(credentials: AiCredentialDocument[]) {
  for (const provider of AI_PROVIDER_FALLBACK_ORDER) {
    const match = credentials.find((item) => item.provider === provider);
    if (match) return match;
  }
  return credentials[0];
}
