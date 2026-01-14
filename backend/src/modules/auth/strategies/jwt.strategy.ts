import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ApiException } from '../../../common/errors/api.exception';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  /**
   * Re-reads the user on every request rather than trusting the token body:
   * `defaultWorkspaceId` is what WorkspaceGuard falls back to, and a deleted
   * account must stop working the moment it's gone, not when its JWT expires.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw ApiException.unauthorized('UNAUTHORIZED', 'Account no longer exists');
    }

    return {
      userId: user._id.toString(),
      email: user.email,
      defaultWorkspaceId: user.defaultWorkspaceId?.toString() ?? null,
    };
  }
}
