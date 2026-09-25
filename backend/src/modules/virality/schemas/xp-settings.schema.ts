import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

import type { XpSignal } from '../domain/xp';

/**
 * Remotely editable XP tuning: one document, key `default`. Anything unset
 * falls back to DEFAULT_XP_CONFIG, so a retune never needs a release.
 */
@Schema({ timestamps: true, collection: 'postlock_xp_settings' })
export class XpSettings {
  @Prop({ required: true, unique: true }) key: string;
  /** 0 means the built-in defaults; every edit increments it. */
  @Prop({ type: Number, default: 0 }) version: number;
  @Prop({ type: SchemaTypes.Mixed, default: {} }) weights: Partial<Record<XpSignal, number>>;
  @Prop({ type: Number }) levelBaseXp?: number;
  @Prop({ type: Number }) replierDecayWindowDays?: number;
  @Prop({ type: Number }) duplicateWindowDays?: number;
}
export type XpSettingsDocument = HydratedDocument<XpSettings>;
export const XpSettingsSchema = SchemaFactory.createForClass(XpSettings);
