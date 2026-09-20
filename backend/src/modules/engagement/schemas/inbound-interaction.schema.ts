import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
@Schema({ timestamps: true, collection: 'inboundinteractions' })
export class InboundInteraction {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true }) workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SocialAccount', required: true }) socialAccountId: Types.ObjectId;
  @Prop({ required: true }) platform: string;
  @Prop({ required: true }) platformInteractionId: string;
  @Prop({ type: String, enum: ['mention', 'comment'], required: true }) type: string;
  @Prop({ required: true }) authorHandle: string;
  @Prop({ required: true }) authorPlatformId: string;
  @Prop({ required: true }) text: string;
  @Prop({ required: true }) url: string;
  @Prop({ type: String, default: null }) sentiment: string | null;
  @Prop({ type: String, enum: ['new', 'reply_generated', 'pending_review', 'replied', 'skipped', 'flagged'], default: 'new', index: true }) status: string;
  @Prop({ type: String, default: null }) generatedReplyText: string | null;
  @Prop({ type: String, default: null }) skipReason: string | null;
  @Prop({ type: String, default: null }) repliedPlatformPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export type InboundInteractionDocument = HydratedDocument<InboundInteraction>;
export const InboundInteractionSchema = SchemaFactory.createForClass(InboundInteraction);
InboundInteractionSchema.index({ socialAccountId: 1, platformInteractionId: 1 }, { unique: true });
