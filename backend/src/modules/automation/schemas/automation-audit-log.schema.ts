import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'automationauditlogs' })
export class AutomationAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true }) workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SocialAccount', default: null }) socialAccountId: Types.ObjectId | null;
  @Prop({ required: true }) action: string;
  @Prop({ required: true }) summary: string;
  @Prop({ type: Object, default: {} }) details: Record<string, unknown>;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) actorUserId: Types.ObjectId | null;
  createdAt: Date;
}
export type AutomationAuditLogDocument = HydratedDocument<AutomationAuditLog>;
export const AutomationAuditLogSchema = SchemaFactory.createForClass(AutomationAuditLog);
AutomationAuditLogSchema.index({ workspaceId: 1, createdAt: -1 });
