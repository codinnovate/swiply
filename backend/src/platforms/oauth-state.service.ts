import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { TokenCipher } from '../common/crypto/token-cipher.service';
import { ApiException } from '../common/errors/api.exception';
import type { Platform } from '../modules/social-accounts/schemas/social-account.schema';

/** An authorization round trip is a redirect and a login — minutes, not hours. */
const STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStateClaims {
  workspaceId: string;
  userId: string;
  platform: Platform;
}

interface StatePayload extends OAuthStateClaims {
  codeVerifier: string;
  nonce: string;
  expiresAt: number;
}

export interface MintedOAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Section 12: OAuth state and PKCE.
 *
 * The callback is hit by the platform's redirect, not by the dashboard, so it
 * carries no bearer token — the state is the only thing proving which workspace
 * and user began the flow. It is therefore encrypted-and-authenticated with the
 * same AES-256-GCM key as stored tokens: a forged or edited state cannot
 * decrypt, so an attacker cannot bind their own social account to someone
 * else's workspace by tampering with the redirect.
 *
 * The PKCE verifier travels inside the encrypted state rather than in a server
 * side store. That keeps the flow stateless before Redis arrives in build step
 * 6, at the cost of not being single-use: replay is bounded by the 10 minute
 * expiry instead. Worth revisiting once the queue backend exists.
 */
@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);

  constructor(private readonly cipher: TokenCipher) {}

  mint(claims: OAuthStateClaims): MintedOAuthState {
    // RFC 7636: 43-128 chars from the unreserved set. 32 random bytes in
    // base64url lands at 43.
    const codeVerifier = randomBytes(32).toString('base64url');

    const payload: StatePayload = {
      ...claims,
      codeVerifier,
      nonce: randomBytes(16).toString('base64url'),
      expiresAt: Date.now() + STATE_TTL_MS,
    };

    return {
      state: this.cipher.encrypt(JSON.stringify(payload)),
      codeVerifier,
      codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    };
  }

  /**
   * `platform` is the one from the callback route. It must match what was
   * signed, so a state minted for one platform cannot be replayed against
   * another adapter's token exchange.
   */
  verify(state: string, platform: Platform): StatePayload {
    let payload: StatePayload;

    try {
      payload = JSON.parse(this.cipher.decrypt(state)) as StatePayload;
    } catch {
      throw this.invalid('state did not decrypt');
    }

    if (!payload?.workspaceId || !payload.userId || !payload.codeVerifier) {
      throw this.invalid('state was missing required claims');
    }

    if (payload.platform !== platform) {
      throw this.invalid(`state was minted for ${payload.platform}, replayed at ${platform}`);
    }

    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) {
      throw this.invalid('state expired');
    }

    return payload;
  }

  private invalid(reason: string): ApiException {
    this.logger.warn(`Rejected an OAuth callback: ${reason}`);
    // The caller is an untrusted redirect; the reason stays server-side.
    return ApiException.unprocessable(
      'OAUTH_STATE_INVALID',
      'This connection link is invalid or has expired. Start the connection again.',
    );
  }
}
