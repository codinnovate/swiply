import { validateEnv } from './env.validation';

const MINIMUM = {
  MONGODB_URI: 'mongodb://localhost:27017/swiply',
  JWT_SECRET: 'a-secret-that-is-definitely-32-chars',
};

describe('validateEnv', () => {
  it('accepts a minimal configuration and applies defaults', () => {
    const config = validateEnv({ ...MINIMUM });

    expect(config.PORT).toBe(3000);
    expect(config.JWT_EXPIRES_IN).toBe('7d');
    expect(config.NODE_ENV).toBe('development');
  });

  it('coerces numeric strings from the environment', () => {
    const config = validateEnv({ ...MINIMUM, PORT: '8080' });
    expect(config.PORT).toBe(8080);
  });

  it.each([
    ['MONGODB_URI', {}],
    ['JWT_SECRET', { MONGODB_URI: MINIMUM.MONGODB_URI }],
  ])('fails fast when %s is missing', (missing, provided) => {
    expect(() => validateEnv(provided)).toThrow(new RegExp(missing));
  });

  it('rejects a JWT secret short enough to brute-force', () => {
    expect(() => validateEnv({ ...MINIMUM, JWT_SECRET: 'too-short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('rejects an ENCRYPTION_KEY that is not 32 bytes of hex (Section 12)', () => {
    expect(() => validateEnv({ ...MINIMUM, ENCRYPTION_KEY: 'abc123' })).toThrow(
      /64 hex characters/,
    );
    expect(() => validateEnv({ ...MINIMUM, ENCRYPTION_KEY: 'a'.repeat(64) })).not.toThrow();
  });

  it('rejects an unknown TWITTER_API_TIER, which gates mention polling (Section 6)', () => {
    expect(() => validateEnv({ ...MINIMUM, TWITTER_API_TIER: 'enterprise' })).toThrow(
      /TWITTER_API_TIER/,
    );
    expect(() => validateEnv({ ...MINIMUM, TWITTER_API_TIER: 'basic' })).not.toThrow();
  });

  it('reports every problem at once rather than one per boot', () => {
    expect(() => validateEnv({ JWT_SECRET: 'short', PORT: '70000' })).toThrow(
      /MONGODB_URI[\s\S]*JWT_SECRET|JWT_SECRET[\s\S]*MONGODB_URI/,
    );
  });
});
