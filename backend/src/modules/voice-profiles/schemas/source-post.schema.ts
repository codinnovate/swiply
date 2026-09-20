import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'sourceposts' })
export class SourcePost {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SocialAccount', required: true, index: true })
  socialAccountId: Types.ObjectId;
  @Prop({ required: true }) platform: string;
  @Prop({ required: true }) platformPostId: string;
  @Prop({ required: true }) text: string;
  @Prop({ required: true }) postedAt: Date;
  @Prop({ type: Number, default: null }) engagementScore: number | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SourcePostDocument = HydratedDocument<SourcePost>;
export const SourcePostSchema = SchemaFactory.createForClass(SourcePost);
SourcePostSchema.index({ socialAccountId: 1, platformPostId: 1 }, { unique: true });
SourcePostSchema.index({ socialAccountId: 1, postedAt: -1 });
