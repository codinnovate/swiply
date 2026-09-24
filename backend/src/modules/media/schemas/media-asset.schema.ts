import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'mediaassets' })
export class MediaAsset {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ required: true }) url: string;
  @Prop({ type: String, enum: ['external', 's3'], default: 'external' }) storageProvider:
    'external' | 's3';
  @Prop({ type: String, default: null }) storageKey: string | null;
  @Prop({ type: String, default: null }) fileName: string | null;
  @Prop({ type: String, default: null }) mimeType: string | null;
  @Prop({ type: Number, default: null }) sizeBytes: number | null;
  @Prop({ type: String, enum: ['image', 'video'], required: true }) type: 'image' | 'video';
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: Number, default: null }) width: number | null;
  @Prop({ type: Number, default: null }) height: number | null;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) uploadedByUserId: Types.ObjectId;
  @Prop({ default: 0 }) usedCount: number;
  @Prop({ type: Date, default: null }) lastUsedAt: Date | null;
  createdAt: Date;
}

export type MediaAssetDocument = HydratedDocument<MediaAsset>;
export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);
MediaAssetSchema.index({ workspaceId: 1, type: 1, lastUsedAt: 1 });
MediaAssetSchema.index({ storageKey: 1 }, { unique: true, sparse: true });
