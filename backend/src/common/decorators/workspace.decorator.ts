import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';

import type { WorkspaceRole } from '../../modules/workspaces/schemas/workspace-member.schema';
import type { AuthenticatedRequest, WorkspaceContext } from '../interfaces/authenticated-request.interface';

export const REQUIRED_ROLES_KEY = 'requiredWorkspaceRoles';

/**
 * Minimum roles allowed to hit a route. WorkspaceGuard reads this; a route with
 * no decorator allows any active member (including `viewer`).
 */
export const RequireRoles = (...roles: WorkspaceRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

/** The workspace context resolved by WorkspaceGuard for the current request. */
export const CurrentWorkspace = createParamDecorator(
  (key: keyof WorkspaceContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return key ? request.workspace?.[key] : request.workspace;
  },
);
