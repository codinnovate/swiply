import { ConfigService } from '@nestjs/config';

import { ApiException, ApiErrorBody } from '../errors/api.exception';
import { TokenCipher } from './token-cipher.service';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

function cipherWith(key: string | undefined): TokenCipher {
  return new TokenCipher({ get: () => key } as unknown as ConfigService);
}

/** ApiException carries its message in the serialized body, not in `.message`. */
function bodyOf(run: () => unknown): ApiErrorBody['error'] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    return ((error as ApiException).getResponse() as ApiErrorBody).error;
  }
  throw new Error('expected the call to throw');
}

describe('TokenCipher', () => {
  const cipher = cipherWith(KEY);

  it('round-trips a token', () => {
    const token = 'act.1234567890abcdef';
    expect(cipher.decrypt(cipher.encrypt(token))).toBe(token);
  });

  it('round-trips multi-byte characters', () => {
    const token = 'ключ-🔐-トークン';
    expect(cipher.decrypt(cipher.encrypt(token))).toBe(token);
  });

  it('never emits the plaintext in the stored value', () => {
    const stored = cipher.encrypt('super-secret-access-token');
    expect(stored).not.toContain('super-secret-access-token');
    expect(stored.startsWith('v1.')).toBe(true);
  });

  it('produces a different ciphertext each time (fresh IV)', () => {
    const a = cipher.encrypt('same-token');
    const b = cipher.encrypt('same-token');

    // Equal ciphertexts would leak which accounts share a token.
    expect(a).not.toBe(b);
    expect(cipher.decrypt(a)).toBe(cipher.decrypt(b));
  });

  it('refuses a value encrypted under a different key', () => {
    const stored = cipherWith(OTHER_KEY).encrypt('token');
    expect(bodyOf(() => cipher.decrypt(stored)).code).toBe('ENCRYPTION_NOT_CONFIGURED');
  });

  it('refuses a tampered payload rather than returning garbage', () => {
    const [version, iv, tag, payload] = cipher.encrypt('token').split('.');
    const flipped = Buffer.from(payload, 'base64url');
    flipped[0] ^= 0xff;

    expect(
      bodyOf(() => cipher.decrypt([version, iv, tag, flipped.toString('base64url')].join('.')))
        .code,
    ).toBe('ENCRYPTION_NOT_CONFIGURED');
  });

  it.each([
    ['no version prefix', 'aaa.bbb.ccc'],
    ['unknown version', 'v9.aaa.bbb.ccc'],
    ['missing segments', 'v1.aaa'],
    ['empty', ''],
  ])('refuses %s', (_label, value) => {
    expect(bodyOf(() => cipher.decrypt(value)).code).toBe('ENCRYPTION_NOT_CONFIGURED');
  });

  it('does not leak the failure reason to the caller', () => {
    // The message must be identical for a wrong key and for a malformed row,
    // otherwise it is a decryption oracle.
    const wrongKey = bodyOf(() => cipher.decrypt(cipherWith(OTHER_KEY).encrypt('token')));
    const malformed = bodyOf(() => cipher.decrypt('v1.aaa'));

    expect(wrongKey).toEqual(malformed);
    expect(wrongKey.message).toBe('A stored credential could not be read');
  });

  it('passes null through both directions', () => {
    expect(cipher.encryptNullable(null)).toBeNull();
    expect(cipher.encryptNullable('')).toBeNull();
    expect(cipher.decryptNullable(null)).toBeNull();
  });

  it('refuses to construct without a key', () => {
    expect(() => cipherWith(undefined)).toThrow(/ENCRYPTION_KEY is required/);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => cipherWith('abcd')).toThrow(/must decode to 32 bytes/);
  });

  it('compares secrets without leaking length-independent timing', () => {
    expect(TokenCipher.safeEqual('abc', 'abc')).toBe(true);
    expect(TokenCipher.safeEqual('abc', 'abd')).toBe(false);
    expect(TokenCipher.safeEqual('abc', 'abcd')).toBe(false);
  });
});
