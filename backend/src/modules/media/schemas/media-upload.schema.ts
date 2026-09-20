import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'mediauploads' })
export class MediaUpload {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) uploadedByUserId: Types.ObjectId;
  @Prop({ required: true, unique: true }) storageKey: string;
  @Prop({ required: true }) s3UploadId: string;
  @Prop({ required: true }) fileName: string;
  @Prop({ required: true }) mimeType: string;
  @Prop({ required: true }) sizeBytes: number;
  @Prop({ type: String, enum: ['image', 'video'], required: true }) type: 'image' | 'video';
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: Number, default: null }) width: number | null;
  @Prop({ type: Number, default: null }) height: number | null;
  @Prop({ required: true }) partSize: number;
  @Prop({ required: true }) partCount: number;
  @Prop({ type: String, enum: ['pending', 'completed', 'aborted', 'failed'], default: 'pending' })
  status: 'pending' | 'completed' | 'aborted' | 'failed';
  @Prop({ required: true }) expiresAt: Date;
}

export type MediaUploadDocument = HydratedDocument<MediaUpload>;
export const MediaUploadSchema = SchemaFactory.createForClass(MediaUpload);
MediaUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
