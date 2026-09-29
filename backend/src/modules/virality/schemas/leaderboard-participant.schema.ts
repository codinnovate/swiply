import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * A PostLock user's leaderboard consent. PostLock has no accounts, so the
 * first install to opt a username in claims it; only that install can change
 * it while it stays opted in.
 */
@Schema({ timestamps: true, collection: 'postlock_leaderboard_participants' })
export class LeaderboardParticipant {
  @Prop({ required: true, unique: true, lowercase: true }) username: string;
  @Prop({ required: true }) installId: string;
  @Prop({ required: true, index: true }) optedIn: boolean;
  @Prop({ required: true }) displayName: string;
  @Prop({ type: String, default: null }) avatarUrl: string | null;
  @Prop({ type: String, default: null }) niche: string | null;
  @Prop({ type: String, default: null }) timezone: string | null;
  @Prop({ type: Date, default: null }) lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type LeaderboardParticipantDocument = HydratedDocument<LeaderboardParticipant>;
export const LeaderboardParticipantSchema = SchemaFactory.createForClass(LeaderboardParticipant);
