import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
@Schema({ timestamps: true, collection: 'engagementrules' })
export class EngagementRule {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true }) workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SocialAccount', required: true }) socialAccountId: Types.ObjectId;
  @Prop({ default: false }) enabled: boolean;
  @Prop({ type: [String], default: [] }) scope: string[];
  @Prop({ type: String, enum: ['auto_publish', 'review_queue'], default: 'review_queue' }) mode: string;
  @Prop({ type: Object, required: true }) filters: { excludeKeywords: string[]; skipNegativeSentiment: boolean; skipLikelyBots: boolean; onlyFromFollowers: boolean };
  @Prop({ required: true, min: 0 }) maxRepliesPerDay: number;
  createdAt: Date;
  updatedAt: Date;
}
export type EngagementRuleDocument = HydratedDocument<EngagementRule>;
export const EngagementRuleSchema = SchemaFactory.createForClass(EngagementRule);
EngagementRuleSchema.index({ workspaceId: 1, socialAccountId: 1 }, { unique: true });
