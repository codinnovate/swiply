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

export interface XPostEngagement {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  views: number | null;
}

/** A post with the content and public metrics the virality scorer needs. */
export interface XPostDetail extends XPost {
  url: string;
  authorUsername: string;
  text: string;
  /** Lowercased handle this post replies to, when it is a reply. */
  replyToUsername?: string;
  replyToPostId?: string;
  /**
   * For a reply, what the post it answers was itself replying to, when the
   * timeline included that post. Lets a reply-back to someone who replied to
   * one of the account's own posts be recognised.
   */
  parentReplyTo?: { username: string; postId?: string };
  /** The post being quoted, for quote posts. */
  quoted?: { username: string; text: string };
  mediaType: 'none' | 'image' | 'video' | 'gif';
  hasExternalLink: boolean;
  hashtagCount: number;
  engagement: XPostEngagement;
}

export interface XPostProvider {
  getProfile(username: string): Promise<XProfile>;
  listPostsSince(username: string, since: Date): Promise<XPost[]>;
  /**
   * The account's own recent posts, newest first, including replies. `pages`
   * reaches further back where the provider can page its timeline.
   */
  listRecentPosts(username: string, options?: { pages?: number }): Promise<XPostDetail[]>;
}

export const X_POST_PROVIDER = Symbol('X_POST_PROVIDER');
