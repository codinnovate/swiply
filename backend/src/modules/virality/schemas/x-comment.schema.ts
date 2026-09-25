import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * A reply an account posted on someone else's X post. Only counted toward
 * leaderboard XP — never scored, so it lives apart from ScoredPost.
 */
@Schema({ timestamps: true, collection: 'postlock_x_comments' })
export class XComment {
  @Prop({ required: true, unique: true }) postId: string;
  @Prop({ required: true, lowercase: true, index: true }) username: string;
  @Prop({ required: true }) postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
export type XCommentDocument = HydratedDocument<XComment>;
export const XCommentSchema = SchemaFactory.createForClass(XComment);
