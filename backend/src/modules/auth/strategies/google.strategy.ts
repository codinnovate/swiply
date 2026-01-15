import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

import { UserDocument } from '../../users/schemas/user.schema';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('auth.google.clientId'),
      clientSecret: configService.getOrThrow<string>('auth.google.clientSecret'),
      callbackURL: configService.getOrThrow<string>('auth.google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account did not return an email address'));
      return;
    }

    try {
      const user: UserDocument = await this.authService.validateGoogleProfile({
        googleId: profile.id,
        email,
        name: profile.displayName || email.split('@')[0],
        avatarUrl: profile.photos?.[0]?.value ?? null,
      });
      done(null, user);
    } catch (error) {
      done(error as Error);
    }
  }
}
