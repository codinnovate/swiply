import { Injectable } from '@nestjs/common';

import type {
  XPost,
  XPostDetail,
  XPostProvider,
  XProfile,
} from '../domain/x-post-provider.interface';

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

  async listRecentPosts(username: string): Promise<XPostDetail[]> {
    const texts = [
      'I shipped my app in 11 days.\n\nNo designer. No cofounder. No funding.\n\nHere is exactly what I cut to get there 🧵',
      "Most founders don't have a growth problem.\n\nThey have a posting-consistency problem.\n\nWhat's the one habit that finally made you post daily?",
      'New blog post on pricing experiments https://example.com/pricing #saas #indiehackers #startups',
      'Good morning',
    ];
    return texts.map((text, index) => ({
      id: `development-${username}-${index}`,
      url: `https://x.com/${username}/status/development-${index}`,
      authorUsername: username,
      text,
      createdAt: new Date(Date.now() - (index + 1) * 26 * 60 * 60 * 1000),
      kind: 'original',
      mediaType: index === 0 ? 'image' : 'none',
      hasExternalLink: text.includes('https://'),
      hashtagCount: (text.match(/#\w+/g) ?? []).length,
      engagement: {
        likes: 40 - index * 9,
        reposts: 3,
        replies: 12 - index * 3,
        quotes: 0,
        bookmarks: 5,
        views: 2_000,
      },
    }));
  }
}
