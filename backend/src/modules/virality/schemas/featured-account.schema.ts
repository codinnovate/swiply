import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** An admin-curated X account shown in the leaderboard's Featured section. */
@Schema({ timestamps: true, collection: 'postlock_featured_accounts' })
export class FeaturedAccount {
  @Prop({ required: true, unique: true, lowercase: true }) username: string;
  @Prop({ required: true }) displayName: string;
  @Prop({ type: String, default: null }) avatarUrl: string | null;
  @Prop({ type: String, default: null }) niche: string | null;
  @Prop({ default: true, index: true }) active: boolean;
  @Prop({ type: Date, default: null }) lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type FeaturedAccountDocument = HydratedDocument<FeaturedAccount>;
export const FeaturedAccountSchema = SchemaFactory.createForClass(FeaturedAccount);
