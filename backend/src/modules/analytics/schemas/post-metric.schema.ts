import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Latest public counts for one of a connected account's own posts. A cache of
 * the platform's numbers, refreshed on read once it goes stale; deleted with
 * the account on disconnect.
 */
@Schema({ timestamps: true, collection: 'postmetrics' })
export class PostMetric {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SocialAccount', required: true })
  socialAccountId: Types.ObjectId;
  @Prop({ required: true }) platform: string;
  @Prop({ required: true }) platformPostId: string;
  @Prop({ type: String, default: null }) title: string | null;
  @Prop({ required: true }) postedAt: Date;
  @Prop({ type: String, default: null }) coverImageUrl: string | null;
  @Prop({ type: String, default: null }) shareUrl: string | null;
  @Prop({ default: 0 }) views: number;
  @Prop({ default: 0 }) likes: number;
  @Prop({ default: 0 }) comments: number;
  @Prop({ default: 0 }) shares: number;
  @Prop({ required: true }) fetchedAt: Date;
}

export type PostMetricDocument = HydratedDocument<PostMetric>;
export const PostMetricSchema = SchemaFactory.createForClass(PostMetric);
PostMetricSchema.index({ socialAccountId: 1, platformPostId: 1 }, { unique: true });
PostMetricSchema.index({ workspaceId: 1, postedAt: -1 });
