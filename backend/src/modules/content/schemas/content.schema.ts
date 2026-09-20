import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const CONTENT_TYPES = ['slideshow', 'video', 'post'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const CONTENT_GOALS = [
  'conversions',
  'awareness',
  'engagement',
  'traffic',
  'lead_gen',
  'community',
  'announcement',
] as const;

@Schema({ _id: false })
export class Slide {
  @Prop({ required: true }) order: number;
  @Prop({ required: true }) imageUrl: string;
  @Prop({ type: Types.ObjectId, ref: 'MediaAsset', default: null })
  mediaAssetId: Types.ObjectId | null;
  @Prop({ type: String, default: null }) caption: string | null;
  @Prop({ type: String, default: null }) altText: string | null;
  @Prop({ type: String, enum: ['user_provided', 'ai_generated'], required: true }) imageSource:
    'user_provided' | 'ai_generated';
}

@Schema({ _id: false })
export class SlideshowPayload {
  @Prop({ type: [Slide], default: [] }) slides: Slide[];
}

@Schema({ _id: false })
export class VideoPayload {
  @Prop({ type: String, enum: ['generating', 'ready', 'failed'], required: true }) status:
    'generating' | 'ready' | 'failed';
  @Prop({ type: String, default: null }) script: string | null;
  @Prop({ type: String, default: null }) videoUrl: string | null;
  @Prop({ type: String, default: null }) thumbnailUrl: string | null;
  @Prop({ type: Number, default: null }) durationSeconds: number | null;
  @Prop({ default: 'none' }) provider: string;
}

@Schema({ _id: false })
export class PostPayload {
  @Prop({ type: [String], default: [] }) imageUrls: string[];
  @Prop({ required: true }) text: string;
}

@Schema({ timestamps: true, collection: 'contents' })
export class Content {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdByUserId: Types.ObjectId | null;
  @Prop({ type: String, enum: CONTENT_TYPES, required: true }) type: ContentType;
  @Prop({ type: String, enum: CONTENT_GOALS, default: null }) goal:
    (typeof CONTENT_GOALS)[number] | null;
  @Prop({ type: String, enum: ['user_provided', 'ai_generated'], default: null }) imageSource:
    'user_provided' | 'ai_generated' | null;
  @Prop({ default: '' }) postCaption: string;
  @Prop({ type: [String], default: [] }) hashtags: string[];
  @Prop({ type: SlideshowPayload, default: null }) slideshow: SlideshowPayload | null;
  @Prop({ type: VideoPayload, default: null }) video: VideoPayload | null;
  @Prop({ type: PostPayload, default: null }) post: PostPayload | null;
  @Prop({ type: String, enum: ['ai', 'manual', 'api'], required: true }) generationSource:
    'ai' | 'manual' | 'api';
  @Prop({ type: String, default: null }) aiPrompt: string | null;
  @Prop({ type: String, default: null }) targetCountry: string | null;
  @Prop({ type: String, default: null, index: true }) contentFingerprint: string | null;
  @Prop({ type: String, enum: ['openai', 'anthropic', 'gemini'], default: null }) aiProvider:
    'openai' | 'anthropic' | 'gemini' | null;
  @Prop({ type: String, default: null }) aiModel: string | null;
  @Prop({ type: Types.ObjectId, ref: 'VoiceProfile', default: null })
  voiceProfileId: Types.ObjectId | null;
  @Prop({
    type: String,
    enum: ['draft', 'ready', 'scheduled', 'publishing', 'published', 'failed', 'archived'],
    default: 'ready',
    index: true,
  })
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ContentDocument = HydratedDocument<Content>;
export const ContentSchema = SchemaFactory.createForClass(Content);
ContentSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
ContentSchema.index(
  { workspaceId: 1, contentFingerprint: 1 },
  { unique: true, sparse: true },
);
