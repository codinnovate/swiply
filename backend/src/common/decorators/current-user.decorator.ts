import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import type { AuthenticatedRequest, AuthenticatedUser } from '../interfaces/authenticated-request.interface';

export const CurrentUser = createParamDecorator(
  (key: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return key ? request.user?.[key] : request.user;
  },
);
