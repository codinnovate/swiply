import { ConfigService } from '@nestjs/config';

import { TokenCipher } from '../common/crypto/token-cipher.service';
import { ApiException, ApiErrorBody } from '../common/errors/api.exception';
import { OAuthStateService } from './oauth-state.service';

const CLAIMS = {
  workspaceId: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012',
  platform: 'tiktok' as const,
};

function serviceWith(key: string): OAuthStateService {
  return new OAuthStateService(
    new TokenCipher({ get: () => key } as unknown as ConfigService),
  );
}

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return ((error as ApiException).getResponse() as ApiErrorBody).error.code;
  }
  throw new Error('expected the call to throw');
}

describe('OAuthStateService', () => {
  const service = serviceWith('a'.repeat(64));

  it('round-trips the claims that identify who started the flow', () => {
    const { state } = service.mint(CLAIMS);
    const verified = service.verify(state, 'tiktok');

    expect(verified.workspaceId).toBe(CLAIMS.workspaceId);
    expect(verified.userId).toBe(CLAIMS.userId);
  });

  it('does not expose the workspace or user id in the state itself', () => {
    const { state } = service.mint(CLAIMS);

    // The state travels through the platform and the user's browser history.
    expect(state).not.toContain(CLAIMS.workspaceId);
    expect(state).not.toContain(CLAIMS.userId);
  });

  it('mints an RFC 7636 verifier and its S256 challenge', () => {
    const { codeVerifier, codeChallenge } = service.mint(CLAIMS);

    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
    expect(codeVerifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(codeChallenge).not.toBe(codeVerifier);
  });

  it('returns the same verifier that the challenge was derived from', () => {
    const { state, codeVerifier } = service.mint(CLAIMS);
    expect(service.verify(state, 'tiktok').codeVerifier).toBe(codeVerifier);
  });

  it('gives two flows different state and verifiers', () => {
    const first = service.mint(CLAIMS);
    const second = service.mint(CLAIMS);

    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });

  it('rejects a state minted for another platform', () => {
    const { state } = service.mint(CLAIMS);
    // Otherwise a state for a platform the attacker controls could be replayed
    // into an adapter whose token exchange they want to drive.
    expect(codeOf(() => service.verify(state, 'instagram'))).toBe('OAUTH_STATE_INVALID');
  });

  it('rejects a state signed with a different key', () => {
    const { state } = serviceWith('b'.repeat(64)).mint(CLAIMS);
    expect(codeOf(() => service.verify(state, 'tiktok'))).toBe('OAUTH_STATE_INVALID');
  });

  it('rejects a tampered state rather than trusting its claims', () => {
    const { state } = service.mint(CLAIMS);
    const parts = state.split('.');
    const payload = Buffer.from(parts[3], 'base64url');
    payload[0] ^= 0xff;
    parts[3] = payload.toString('base64url');

    expect(codeOf(() => service.verify(parts.join('.'), 'tiktok'))).toBe('OAUTH_STATE_INVALID');
  });

  it.each([['garbage'], [''], ['v1.a.b.c']])('rejects the unparseable state %p', (value) => {
    expect(codeOf(() => service.verify(value, 'tiktok'))).toBe('OAUTH_STATE_INVALID');
  });

  it('rejects an expired state', () => {
    const { state } = service.mint(CLAIMS);

    jest.useFakeTimers().setSystemTime(Date.now() + 11 * 60 * 1000);
    try {
      expect(codeOf(() => service.verify(state, 'tiktok'))).toBe('OAUTH_STATE_INVALID');
    } finally {
      jest.useRealTimers();
    }
  });
});
