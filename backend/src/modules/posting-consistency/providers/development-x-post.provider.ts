import { Injectable } from '@nestjs/common';

import type { XPost, XPostProvider, XProfile } from '../domain/x-post-provider.interface';

/**
 * Local-only provider for developing the native app without X credentials.
 * Production must select and configure the HTTP adapter instead.
 */
@Injectable()
export class DevelopmentXPostProvider implements XPostProvider {
  async getProfile(username: string): Promise<XProfile> {
    const displayName = username
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return {
      providerUserId: `development:${username}`,
      username,
      displayName: displayName || username,
      isPublic: username !== 'protected_account',
      isVerified: false,
    };
  }

  async listPostsSince(_username: string, _since: Date): Promise<XPost[]> {
    return [];
  }
}
