import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../errors/api.exception';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the GCM-recommended nonce size
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** Version prefix so a future key rotation can decrypt old values by format. */
const FORMAT_VERSION = 'v1';

/**
 * Section 12: platform access/refresh tokens are encrypted at rest. A dump of
 * the `socialaccounts` collection must not be enough to post as the user.
 *
 * Ciphertext is stored as `v1.<iv>.<tag>.<payload>`, all base64url. GCM is
 * authenticated, so a tampered row fails to decrypt rather than yielding
 * attacker-chosen plaintext.
 */
@Injectable()
export class TokenCipher {
  private readonly logger = new Logger(TokenCipher.name);
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const hex = configService.get<string>('encryption.key');

    if (!hex) {
      throw new Error('ENCRYPTION_KEY is required to encrypt platform tokens (Section 12)');
    }

    this.key = Buffer.from(hex, 'hex');

    // env.validation.ts already enforces the format; this catches a key injected
    // by some other path (a test, a rogue ConfigService override) before it can
    // produce silently weak ciphertext.
    if (this.key.length !== KEY_BYTES) {
      throw new Error(
        `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${this.key.length}`,
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const payload = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return [
      FORMAT_VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      payload.toString('base64url'),
    ].join('.');
  }

  decrypt(ciphertext: string): string {
    const [version, ivPart, tagPart, payloadPart] = ciphertext.split('.');

    if (version !== FORMAT_VERSION || !ivPart || !tagPart || !payloadPart) {
      throw this.undecryptable('malformed ciphertext');
    }

    const iv = Buffer.from(ivPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');

    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw this.undecryptable('malformed ciphertext');
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(payloadPart, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Wrong key or tampered row. The reason is deliberately not echoed to the
      // caller — it would be an oracle for anyone who can reach an endpoint
      // that decrypts.
      throw this.undecryptable('authentication failed');
    }
  }

  encryptNullable(plaintext: string | null | undefined): string | null {
    return plaintext ? this.encrypt(plaintext) : null;
  }

  decryptNullable(ciphertext: string | null | undefined): string | null {
    return ciphertext ? this.decrypt(ciphertext) : null;
  }

  /** Constant-time compare for secrets that arrive from outside (webhook signatures). */
  static safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private undecryptable(reason: string): ApiException {
    this.logger.error(`Failed to decrypt a stored token: ${reason}`);
    return new ApiException(
      'ENCRYPTION_NOT_CONFIGURED',
      'A stored credential could not be read',
      500,
    );
  }
}
