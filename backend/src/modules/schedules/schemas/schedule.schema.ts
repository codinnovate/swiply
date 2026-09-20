import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class FixedDays {
  @Prop({ required: true, min: 1, max: 7 }) postsPerWeek: number;
  @Prop({ type: [Number], required: true }) daysOfWeek: number[];
  @Prop({ required: true }) timeOfDay: string;
}

@Schema({ _id: false })
export class PostingWindow {
  @Prop({ required: true, min: 0, max: 23 }) startHour: number;
  @Prop({ required: true, min: 1, max: 24 }) endHour: number;
}

@Schema({ _id: false })
export class VolumeSettings {
  @Prop({ required: true, min: 1 }) postsPerMonth: number;
  @Prop({ type: [PostingWindow], required: true }) postingWindows: PostingWindow[];
  @Prop({ required: true, min: 1 }) minGapMinutes: number;
  @Prop({ required: true, min: 0 }) jitterMinutes: number;
}

@Schema({ timestamps: true, collection: 'schedules' })
export class Schedule {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true }) workspaceId: Types.ObjectId;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ type: [Types.ObjectId], ref: 'SocialAccount', required: true }) socialAccountIds: Types.ObjectId[];
  @Prop({ type: Object, required: true }) contentTypeMix: { slideshow: number; video: number; post: number };
  @Prop({ type: String, enum: ['fixed_days', 'volume'], required: true }) mode: 'fixed_days' | 'volume';
  @Prop({ type: FixedDays, default: null }) fixedDays: FixedDays | null;
  @Prop({ type: VolumeSettings, default: null }) volume: VolumeSettings | null;
  @Prop({ type: Date, default: null }) endDate: Date | null;
  @Prop({ type: String, enum: ['ai_autogenerate', 'content_bank', 'manual_queue'], required: true }) contentSource: string;
  @Prop({ type: String, default: null }) autoGeneratePrompt: string | null;
  @Prop({ required: true }) defaultGoal: string;
  @Prop({ type: String, enum: ['user_provided', 'ai_generated'], required: true }) defaultImageSource: string;
  @Prop({ required: true, default: false }) autopilot: boolean;
  @Prop({ type: String, enum: ['active', 'paused', 'completed'], default: 'active', index: true }) status: string;
  createdAt: Date;
  updatedAt: Date;
}
export type ScheduleDocument = HydratedDocument<Schedule>;
export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
ScheduleSchema.index({ workspaceId: 1, status: 1 });
