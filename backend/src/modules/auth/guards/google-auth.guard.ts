import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { ApiException } from '../../../common/errors/api.exception';

/**
 * Google OAuth is optional configuration — if the credentials are absent the
 * strategy was never registered, so fail with a clear code instead of Passport's
 * opaque "Unknown authentication strategy" error.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
      throw ApiException.unprocessable(
        'OAUTH_PROVIDER_NOT_CONFIGURED',
        'Google sign-in is not configured on this server',
        { provider: 'google' },
      );
    }
    return super.canActivate(context);
  }
}
