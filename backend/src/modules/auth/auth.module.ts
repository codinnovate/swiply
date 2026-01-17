import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

/**
 * GoogleStrategy is only registered when credentials are present — otherwise
 * Passport would throw at construction time on a server that simply doesn't
 * offer Google sign-in. GoogleAuthGuard returns OAUTH_PROVIDER_NOT_CONFIGURED
 * in that case.
 */
const googleStrategyProvider = {
  provide: 'GOOGLE_STRATEGY',
  inject: [ConfigService, AuthService],
  useFactory: (configService: ConfigService, authService: AuthService) => {
    const clientId = configService.get<string>('auth.google.clientId');
    const clientSecret = configService.get<string>('auth.google.clientSecret');
    return clientId && clientSecret ? new GoogleStrategy(configService, authService) : null;
  },
};

@Module({
  imports: [
    UsersModule,
    WorkspacesModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('auth.jwtSecret'),
        // jsonwebtoken types expiresIn as a `ms` template literal; the value is
        // env-supplied, so it is only knowable as a string at compile time.
        signOptions: {
          expiresIn: configService.get<string>(
            'auth.jwtExpiresIn',
            '7d',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, googleStrategyProvider],
  exports: [AuthService],
})
export class AuthModule {}
