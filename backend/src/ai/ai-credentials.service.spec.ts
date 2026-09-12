import { Model, Types } from 'mongoose';

import { TokenCipher } from '../common/crypto/token-cipher.service';
import { AiCredentialsService } from './ai-credentials.service';
import { AiProviderRegistry } from './ai-provider-registry.service';
import { AiCredentialDocument } from './schemas/ai-credential.schema';

const userId = new Types.ObjectId().toHexString();

describe('AiCredentialsService', () => {
  const model = {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  };
  const cipher = { encrypt: jest.fn(), decrypt: jest.fn() };
  const providers = { validateKey: jest.fn(), models: jest.fn() };
  let service: AiCredentialsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiCredentialsService(
      model as unknown as Model<AiCredentialDocument>,
      cipher as unknown as TokenCipher,
      providers as unknown as AiProviderRegistry,
    );
  });

  it('validates and encrypts a key while returning only its hint', async () => {
    providers.validateKey.mockResolvedValue(undefined);
    cipher.encrypt.mockReturnValue('encrypted');
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        provider: 'openai',
        keyHint: '7890',
        defaultModel: 'gpt-5-mini',
        updatedAt: new Date('2026-01-01'),
        encryptedApiKey: 'encrypted',
      }),
    });

    const result = await service.save(userId, {
      apiKey: 'sk-test-1234567890',
      defaultModel: 'gpt-5-mini',
    });

    expect(providers.validateKey).toHaveBeenCalledWith('openai', 'sk-test-1234567890', 'gpt-5-mini');
    expect(cipher.encrypt).toHaveBeenCalledWith('sk-test-1234567890');
    expect(result).toMatchObject({ provider: 'openai', keyHint: '7890' });
    expect(result).not.toHaveProperty('encryptedApiKey');
    expect(result).not.toHaveProperty('apiKey');
  });

  it('decrypts the current user’s key only when resolving an AI request', async () => {
    cipher.decrypt.mockReturnValue('plain-key');
    model.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            provider: 'openai',
            encryptedApiKey: 'encrypted',
            defaultModel: 'gpt-5-mini',
          }),
        }),
      }),
    });

    await expect(service.resolve(userId, 'gpt-4.1-mini')).resolves.toEqual({
      apiKey: 'plain-key',
      model: 'gpt-4.1-mini',
      provider: 'openai',
    });
    expect(cipher.decrypt).toHaveBeenCalledWith('encrypted');
  });

  it('requires a saved user key', async () => {
    model.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      }),
    });

    await expect(service.resolve(userId)).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
  });
});
