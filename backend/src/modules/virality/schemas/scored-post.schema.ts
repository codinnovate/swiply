import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

import type { XPostEngagement } from '../../posting-consistency/domain/x-post-provider.interface';
import type { ViralityScore } from '../domain/virality-score';

export interface EngagementReading extends XPostEngagement {
  capturedAt: Date;
}

/**
 * A public X post PostLock has scored — a user's own post for their history
 * tab, or a featured account's post for the leaderboard. Keyed by the X post
 * id, so a post is only ever scored once however many callers sync it.
 */
@Schema({ timestamps: true, collection: 'postlock_scored_posts' })
export class ScoredPost {
  @Prop({ required: true, unique: true }) postId: string;
  @Prop({ required: true, lowercase: true }) username: string;
  @Prop({ required: true }) url: string;
  @Prop({ type: String, enum: ['original', 'quote'], required: true }) kind: 'original' | 'quote';
  @Prop({ required: true }) text: string;
  @Prop({ type: [String], default: [] }) threadTexts: string[];
  @Prop({ type: String, default: null }) quotedUsername: string | null;
  @Prop({ type: String, default: null }) quotedText: string | null;
  @Prop({ required: true }) postedAt: Date;
  @Prop({ type: String, enum: ['none', 'image', 'video', 'gif'], required: true })
  mediaType: 'none' | 'image' | 'video' | 'gif';
  @Prop({ required: true }) isThread: boolean;
  @Prop({ required: true }) threadLength: number;
  @Prop({ required: true }) hasExternalLink: boolean;
  @Prop({ type: String, enum: ['main_post', 'reply', 'none'], required: true })
  linkLocation: 'main_post' | 'reply' | 'none';
  @Prop({ required: true }) hashtagCount: number;
  @Prop({ required: true }) contentHash: string;

  /** Latest public metrics, refreshed whenever the post is seen in a sync. */
  @Prop({ type: SchemaTypes.Mixed, required: true }) engagement: EngagementReading;
  /** First readings taken ~1h, ~24h and ~7d after posting, for predicted-vs-actual. */
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  engagementSnapshots: Partial<Record<'h1' | 'h24' | 'd7', EngagementReading>>;

  /**
   * The author's side of the conversation, for XP. No defaults: ingest only
   * ever raises these with $max/$min, which a default on insert would clash with.
   */
  /** The author's own replies directly under the post, which X counts as replies. */
  @Prop({ type: Number }) authorDirectReplies?: number;
  /** Replier handle → when the author first replied back to them on this post. */
  @Prop({ type: SchemaTypes.Mixed }) authorReplies?: Record<string, Date>;

  @Prop({ type: String, enum: ['pending', 'scored', 'failed'], default: 'pending' })
  scoreStatus: 'pending' | 'scored' | 'failed';
  @Prop({ type: SchemaTypes.Mixed, default: null }) score: ViralityScore | null;
  @Prop({ type: String, default: null }) scoredContentHash: string | null;
  @Prop({ type: Number, default: null }) scoringPromptVersion: number | null;
  @Prop({ type: String, default: null }) scoringModel: string | null;
  @Prop({ type: Date, default: null }) scoredAt: Date | null;
  @Prop({ default: 0 }) scoreAttempts: number;

  @Prop({ type: [String], default: [] }) rewriteVariants: string[];
  @Prop({ type: String, default: null }) rewriteContentHash: string | null;

  createdAt: Date;
  updatedAt: Date;
}
export type ScoredPostDocument = HydratedDocument<ScoredPost>;
export const ScoredPostSchema = SchemaFactory.createForClass(ScoredPost);
ScoredPostSchema.index({ username: 1, postedAt: -1 });
ScoredPostSchema.index({ scoreStatus: 1, username: 1 });
