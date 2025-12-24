import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const PLAN_IDS = ['free', 'starter', 'pro', 'agency'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Section 4.2 */
@Schema({ timestamps: true, collection: 'workspaces' })
export class Workspace {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: String, enum: PLAN_IDS, default: 'free' })
  planId: PlanId;

  @Prop({ type: String, default: null })
  stripeCustomerId: string | null;

  @Prop({ type: String, default: null })
  stripeSubscriptionId: string | null;

  /** IANA tz — all schedule/window math resolves through this (Section 9.2). */
  @Prop({ required: true, default: 'UTC' })
  timezone: string;

  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceDocument = HydratedDocument<Workspace>;
export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
