import type { Request } from 'express';

import type { WorkspaceRole } from '../../modules/workspaces/schemas/workspace-member.schema';

/** The authenticated principal attached to the request by JwtStrategy. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  defaultWorkspaceId: string | null;
}

/** Resolved by WorkspaceGuard once a request is scoped to a workspace. */
export interface WorkspaceContext {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  workspace?: WorkspaceContext;
}
