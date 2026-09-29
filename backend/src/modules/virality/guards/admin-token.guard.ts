import { timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { ApiException } from '../../../common/errors/api.exception';

/**
 * Guards PostLock's curation routes with a shared secret in the
 * `X-Postlock-Admin-Token` header. With POSTLOCK_ADMIN_TOKEN unset, every
 * request is rejected.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('virality.adminToken');
    const provided = context.switchToHttp().getRequest<Request>().header('x-postlock-admin-token');
    if (expected && provided) {
      const left = Buffer.from(provided);
      const right = Buffer.from(expected);
      if (left.length === right.length && timingSafeEqual(left, right)) return true;
    }
    throw ApiException.unauthorized('UNAUTHORIZED', 'A valid admin token is required.');
  }
}
