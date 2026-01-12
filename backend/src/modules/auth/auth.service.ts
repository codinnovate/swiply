import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.interface';

export interface GoogleProfileInput {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthResult {
  accessToken: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    defaultWorkspaceId: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ApiException(
        'EMAIL_ALREADY_REGISTERED',
        'An account with that email already exists',
        HttpStatus.CONFLICT,
        { email: dto.email.toLowerCase() },
      );
    }

    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
    });

    await this.workspacesService.claimPendingInvites(user._id, user.email);
    await this.workspacesService.bootstrapForNewUser(user._id, user.name, dto.timezone);

    return this.issueToken(await this.reload(user._id));
  }

  /**
   * Used by LocalStrategy. Returns null on any failure — the caller turns that
   * into one generic INVALID_CREDENTIALS so the response can't be used to probe
   * which emails are registered.
   */
  async validateCredentials(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) return null;

    if (!user.passwordHash) {
      // Google-only account: don't reveal that, but don't let an empty/absent
      // hash be treated as a match either.
      this.logger.debug(`Password login attempted on OAuth-only account ${user._id.toString()}`);
      return null;
    }

    const matches = await UsersService.verifyPassword(password, user.passwordHash);
    return matches ? user : null;
  }

  async login(user: UserDocument): Promise<AuthResult> {
    return this.issueToken(user);
  }

  /**
   * Google sign-in. Matches on googleId first, then falls back to email so a
   * user who registered with a password can link Google to the same account
   * rather than ending up with a duplicate.
   */
  async validateGoogleProfile(profile: GoogleProfileInput): Promise<UserDocument> {
    const byGoogleId = await this.usersService.findByGoogleId(profile.googleId);
    if (byGoogleId) return byGoogleId;

    const byEmail = await this.usersService.findByEmail(profile.email);
    if (byEmail) {
      const linked = await this.usersService.linkGoogleAccount(
        byEmail._id,
        profile.googleId,
        byEmail.avatarUrl ?? profile.avatarUrl,
      );
      return linked ?? byEmail;
    }

    const user = await this.usersService.create({
      email: profile.email,
      name: profile.name,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      emailVerified: true,
    });

    await this.workspacesService.claimPendingInvites(user._id, user.email);
    await this.workspacesService.bootstrapForNewUser(user._id, user.name);

    return this.reload(user._id);
  }

  private async reload(userId: Types.ObjectId): Promise<UserDocument> {
    const user = await this.usersService.findById(userId);
    if (!user) throw ApiException.notFound('User', { userId: userId.toString() });
    return user;
  }

  private issueToken(user: UserDocument): AuthResult {
    const payload: JwtPayload = { sub: user._id.toString(), email: user.email };

    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: this.configService.get<string>('auth.jwtExpiresIn', '7d'),
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        defaultWorkspaceId: user.defaultWorkspaceId?.toString() ?? null,
      },
    };
  }
}
