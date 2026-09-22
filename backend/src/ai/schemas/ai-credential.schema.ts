import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AI_PROVIDERS, AiProvider } from '../ai-providers';

@Schema({ timestamps: true, collection: 'aicredentials' })
export class AiCredential {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: AI_PROVIDERS, required: true })
  provider: AiProvider;

  @Prop({ required: true, select: false })
  encryptedApiKey: string;

  @Prop({ required: true })
  keyHint: string;

  @Prop({ required: true })
  defaultModel: string;

  @Prop({ default: false })
  preferred: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type AiCredentialDocument = HydratedDocument<AiCredential>;
export const AiCredentialSchema = SchemaFactory.createForClass(AiCredential);
AiCredentialSchema.index({ userId: 1, provider: 1 }, { unique: true });
