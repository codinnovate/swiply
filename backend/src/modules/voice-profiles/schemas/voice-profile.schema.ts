import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const EMOJI_USAGE = ['none', 'light', 'heavy'] as const;
export const HASHTAG_USAGE = ['none', 'light', 'heavy'] as const;

@Schema({ _id: false })
export class StyleAttributes {
  @Prop({ required: true }) avgSentenceLength: number;
  @Prop({ type: String, enum: EMOJI_USAGE, required: true })
  emojiUsage: (typeof EMOJI_USAGE)[number];
  @Prop({ type: String, enum: HASHTAG_USAGE, required: true })
  hashtagUsage: (typeof HASHTAG_USAGE)[number];
  @Prop({ type: [String], default: [] }) commonTopics: string[];
  @Prop({ required: true }) formattingNotes: string;
}

@Schema({ timestamps: true, collection: 'voiceprofiles' })
export class VoiceProfile {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SocialAccount', default: null, index: true })
  socialAccountId: Types.ObjectId | null;
  @Prop({ type: [String], default: [] }) userSetTone: string[];
  @Prop({ default: '' }) styleSummary: string;
  @Prop({ type: StyleAttributes, required: true }) styleAttributes: StyleAttributes;
  @Prop({ type: [Types.ObjectId], ref: 'SourcePost', default: [] })
  fewShotExampleIds: Types.ObjectId[];
  @Prop({ default: 0 }) sampleCount: number;
  @Prop({ type: Date, default: null }) lastAnalyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type VoiceProfileDocument = HydratedDocument<VoiceProfile>;
export const VoiceProfileSchema = SchemaFactory.createForClass(VoiceProfile);
VoiceProfileSchema.index({ workspaceId: 1, socialAccountId: 1 }, { unique: true });
