import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostingChallengeStatus = 'pending' | 'active' | 'declined' | 'completed';
export type PostingChallengeDuration = 'day' | 'week';

@Schema({ timestamps: true, collection: 'postlock_posting_challenges' })
export class PostingChallenge {
  @Prop({ required: true }) pairKey: string;
  @Prop({ required: true, lowercase: true, index: true }) challengerUsername: string;
  @Prop({ required: true }) challengerInstallId: string;
  @Prop({ required: true }) challengerDisplayName: string;
  @Prop({ type: String, default: null }) challengerAvatarUrl: string | null;

  @Prop({ required: true, lowercase: true, index: true }) opponentUsername: string;
  @Prop({ required: true }) opponentDisplayName: string;
  @Prop({ type: String, default: null }) opponentAvatarUrl: string | null;
  @Prop({ type: String, default: null }) opponentInstallId: string | null;

  @Prop({ type: String, enum: ['day', 'week'], required: true })
  duration: PostingChallengeDuration;
  @Prop({
    type: String,
    enum: ['pending', 'active', 'declined', 'completed'],
    required: true,
    index: true,
  })
  status: PostingChallengeStatus;
  @Prop({ required: true }) startsAt: Date;
  @Prop({ required: true, index: true }) endsAt: Date;
  @Prop({ type: Date, default: null }) respondedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type PostingChallengeDocument = HydratedDocument<PostingChallenge>;
export const PostingChallengeSchema = SchemaFactory.createForClass(PostingChallenge);
PostingChallengeSchema.index({ challengerUsername: 1, createdAt: -1 });
PostingChallengeSchema.index({ opponentUsername: 1, createdAt: -1 });
PostingChallengeSchema.index(
  { pairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'active'] } },
  },
);
