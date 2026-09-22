import { Model, Types } from 'mongoose';

import { TokenCipher } from '../common/crypto/token-cipher.service';
import { AiCredentialsService } from './ai-credentials.service';
import { AiProviderRegistry } from './ai-provider-registry.service';
import { AiCredentialDocument } from './schemas/ai-credential.schema';

const userId = new Types.ObjectId().toHexString();

function listed(docs: unknown[]) {
  return { exec: jest.fn().mockResolvedValue(docs) };
}

function found(doc: unknown) {
  return {
    select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) }),
  };
}

describe('AiCredentialsService', () => {
  const model = {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
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
    model.find.mockReturnValue(listed([]));
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        provider: 'openai',
        keyHint: '7890',
        defaultModel: 'gpt-5-mini',
        preferred: true,
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
    expect(result).toMatchObject({ provider: 'openai', keyHint: '7890', preferred: true });
    expect(result).not.toHaveProperty('encryptedApiKey');
    expect(result).not.toHaveProperty('apiKey');
  });

  it('decrypts the current user’s key only when resolving an AI request', async () => {
    cipher.decrypt.mockReturnValue('plain-key');
    model.find.mockReturnValue(
      found([
        {
          provider: 'openai',
          encryptedApiKey: 'encrypted',
          defaultModel: 'gpt-5-mini',
        },
      ]),
    );

    await expect(service.resolve(userId, 'gpt-4.1-mini')).resolves.toEqual({
      apiKey: 'plain-key',
      model: 'gpt-4.1-mini',
      provider: 'openai',
    });
    expect(cipher.decrypt).toHaveBeenCalledWith('encrypted');
  });

  it('uses OpenAI over Gemini when no task default is set', async () => {
    cipher.decrypt.mockReturnValue('openai-key');
    model.find.mockReturnValue(
      found([
        { provider: 'gemini', encryptedApiKey: 'g', defaultModel: 'gemini-2.5-flash', preferred: false },
        { provider: 'openai', encryptedApiKey: 'o', defaultModel: 'gpt-5-mini', preferred: false },
      ]),
    );

    await expect(service.resolve(userId)).resolves.toEqual({
      apiKey: 'openai-key',
      model: 'gpt-5-mini',
      provider: 'openai',
    });
  });

  it('uses the preferred provider for tasks', async () => {
    cipher.decrypt.mockReturnValue('openai-key');
    model.find.mockReturnValue(
      found([
        { provider: 'gemini', encryptedApiKey: 'g', defaultModel: 'gemini-2.5-flash', preferred: false },
        { provider: 'openai', encryptedApiKey: 'o', defaultModel: 'gpt-4.1', preferred: true },
      ]),
    );

    await expect(service.resolve(userId)).resolves.toMatchObject({
      provider: 'openai',
      model: 'gpt-4.1',
    });
  });

  it('saves a task preference onto a connected provider', async () => {
    const credential = {
      provider: 'openai',
      keyHint: '7890',
      defaultModel: 'gpt-5-mini',
      preferred: false,
      updatedAt: new Date('2026-01-01'),
      save: jest.fn().mockResolvedValue(undefined),
    };
    model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(credential) });
    model.updateMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

    const result = await service.setTaskPreference(userId, { provider: 'openai', model: 'gpt-5' });

    expect(model.updateMany).toHaveBeenCalled();
    expect(credential.preferred).toBe(true);
    expect(credential.defaultModel).toBe('gpt-5');
    expect(credential.save).toHaveBeenCalled();
    expect(result).toMatchObject({ provider: 'openai', preferred: true, defaultModel: 'gpt-5' });
  });

  it('requires a saved user key', async () => {
    model.find.mockReturnValue(found([]));

    await expect(service.resolve(userId)).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
  });
});
