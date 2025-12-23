import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Section 4.1 */
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  /** null for accounts created via Google OAuth only. Never serialized. */
  @Prop({ type: String, default: null, select: false })
  passwordHash: string | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', default: null })
  defaultWorkspaceId: Types.ObjectId | null;

  /** Set when the account is linked to Google (Section 2 auth strategies). */
  @Prop({ type: String, default: null, index: true, sparse: true })
  googleId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// Section 4.18: `User.email` unique — declared on the @Prop above.
