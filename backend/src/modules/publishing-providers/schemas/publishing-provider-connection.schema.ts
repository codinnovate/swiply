import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const PUBLISHING_PROVIDERS = ['buffer', 'postiz'] as const;
export type PublishingProvider = (typeof PUBLISHING_PROVIDERS)[number];

@Schema({ timestamps: true, collection: 'publishingproviderconnections' })
export class PublishingProviderConnection {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;
  @Prop({ type: String, enum: PUBLISHING_PROVIDERS, required: true })
  provider: PublishingProvider;
  @Prop({ required: true, select: false }) encryptedApiKey: string;
  @Prop({ required: true }) keyHint: string;
  @Prop({ type: String, default: null }) organizationId: string | null;
  @Prop({ type: String, default: null }) organizationName: string | null;
  @Prop({ type: String, default: null }) baseUrl: string | null;
  @Prop({ type: String, enum: ['active', 'error'], default: 'active' }) status: string;
  @Prop({ type: String, default: null }) lastError: string | null;
  @Prop({ type: Date, default: null }) lastValidatedAt: Date | null;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) connectedByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type PublishingProviderConnectionDocument = HydratedDocument<PublishingProviderConnection>;
export const PublishingProviderConnectionSchema = SchemaFactory.createForClass(
  PublishingProviderConnection,
);
PublishingProviderConnectionSchema.index({ workspaceId: 1, provider: 1 }, { unique: true });
