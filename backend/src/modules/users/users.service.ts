import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { ClientSession, Model, Types } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_ROUNDS = 12;

export interface CreateUserInput {
  email: string;
  name: string;
  password?: string;
  googleId?: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(input: CreateUserInput, session?: ClientSession): Promise<UserDocument> {
    const [created] = await this.userModel.create(
      [
        {
          email: input.email.toLowerCase().trim(),
          name: input.name.trim(),
          passwordHash: input.password ? await UsersService.hashPassword(input.password) : null,
          googleId: input.googleId ?? null,
          avatarUrl: input.avatarUrl ?? null,
          emailVerified: input.emailVerified ?? false,
          defaultWorkspaceId: null,
        },
      ],
      session ? { session } : {},
    );
    return created;
  }

  findById(userId: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /** `passwordHash` is `select: false`, so credential checks need it explicitly. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async setDefaultWorkspace(
    userId: string | Types.ObjectId,
    workspaceId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { defaultWorkspaceId: workspaceId } })
      .session(session ?? null)
      .exec();
  }

  async linkGoogleAccount(
    userId: string | Types.ObjectId,
    googleId: string,
    avatarUrl?: string | null,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            googleId,
            emailVerified: true,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
        },
        { new: true },
      )
      .exec();
  }

  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  static verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
