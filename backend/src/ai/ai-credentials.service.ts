import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TokenCipher } from '../common/crypto/token-cipher.service';
import { ApiException } from '../common/errors/api.exception';
import { SaveAiCredentialDto } from './dto/save-ai-credential.dto';
import { isOpenAiModel } from './openai-models';
import { AiProviderRegistry } from './ai-provider-registry.service';
import { AI_MODELS, AiProvider, isAiProvider } from './ai-providers';
import { SaveProviderCredentialDto } from './dto/save-provider-credential.dto';
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
    const credential = await this.model
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), provider },
        {
          $set: {
            encryptedApiKey: this.cipher.encrypt(apiKey),
            keyHint: apiKey.slice(-4),
            defaultModel: dto.defaultModel,
          },
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

  async resolve(userId: string, requestedModel?: string, requestedProvider?: AiProvider): Promise<ResolvedAiCredential> {
    const modelProvider = requestedModel
      ? AI_MODELS.find((model) => model.id === requestedModel)?.provider
      : undefined;
    const provider = requestedProvider ?? modelProvider;
    const credential = await this.model
      .findOne({ userId: new Types.ObjectId(userId), ...(provider ? { provider } : {}) })
      .sort({ provider: 1 })
      .select('+encryptedApiKey')
      .exec();
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
    await this.model.deleteOne({ userId: new Types.ObjectId(userId), provider }).exec();
  }

  private present(credential: AiCredentialDocument) {
    return {
      provider: credential.provider,
      keyHint: credential.keyHint,
      defaultModel: credential.defaultModel,
      updatedAt: credential.updatedAt,
    };
  }
}
