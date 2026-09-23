export interface XProfile {
  providerUserId?: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isPublic: boolean;
  isVerified?: boolean;
  verificationType?: 'individual' | 'organization' | 'government';
}

export interface XPost {
  id: string;
  createdAt: Date;
  kind: 'original' | 'reply' | 'repost' | 'quote';
}

export interface XPostProvider {
  getProfile(username: string): Promise<XProfile>;
  listPostsSince(username: string, since: Date): Promise<XPost[]>;
}

export const X_POST_PROVIDER = Symbol('X_POST_PROVIDER');
