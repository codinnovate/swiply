import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'posts' })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Content', required: true }) contentId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SocialAccount', required: true })
  socialAccountId: Types.ObjectId;
  @Prop({ required: true }) platform: string;
  @Prop({ required: true, index: true }) scheduledFor: Date;
  @Prop({
    type: String,
    enum: ['queued', 'pending_review', 'processing', 'published', 'failed', 'canceled'],
    default: 'queued',
    index: true,
  })
  status: string;
  @Prop({ default: 0 }) attempts: number;
  @Prop({ type: Date, default: null }) lastAttemptAt: Date | null;
  @Prop({ type: Date, default: null }) publishedAt: Date | null;
  @Prop({ type: String, default: null }) platformPostId: string | null;
  @Prop({ type: String, default: null }) platformPostUrl: string | null;
  @Prop({ type: String, default: null }) failureReason: string | null;
  @Prop({ type: String, enum: ['direct', 'buffer', 'postiz'], default: 'direct' })
  publishingProvider: string;
  @Prop({ type: String, default: null }) externalProviderPostId: string | null;
  @Prop({ type: String, default: null }) providerStatus: string | null;
  @Prop({ type: Date, default: null }) submittedAt: Date | null;
  @Prop({ type: Date, default: null }) lastProviderStatusCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type PostDocument = HydratedDocument<Post>;
export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ status: 1, scheduledFor: 1 });
PostSchema.index({ publishingProvider: 1, status: 1, lastProviderStatusCheckedAt: 1 });
