import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

import type { LeaderboardEntry } from '../domain/leaderboard-ranking';

/** A ranked leaderboard, recomputed on a schedule; reads serve the newest. */
@Schema({ collection: 'postlock_leaderboard_snapshots' })
export class LeaderboardSnapshot {
  @Prop({ required: true, index: true }) computedAt: Date;
  @Prop({ type: SchemaTypes.Mixed, required: true }) entries: LeaderboardEntry[];
  /** The XP config the entries were computed with; a retune invalidates them. */
  @Prop({ type: Number }) xpConfigVersion?: number;
}
export type LeaderboardSnapshotDocument = HydratedDocument<LeaderboardSnapshot>;
export const LeaderboardSnapshotSchema = SchemaFactory.createForClass(LeaderboardSnapshot);
