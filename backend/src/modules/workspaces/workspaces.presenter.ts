import { Types } from 'mongoose';

import { WorkspaceMemberDocument, WorkspaceRole } from './schemas/workspace-member.schema';
import { WorkspaceDocument } from './schemas/workspace.schema';

export interface WorkspaceResponse {
  id: string;
  name: string;
  ownerId: string;
  planId: string;
  timezone: string;
  role?: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberResponse {
  id: string;
  workspaceId: string;
  userId: string | null;
  role: WorkspaceRole;
  invitedEmail: string | null;
  status: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  createdAt: string;
}

/** Stripe identifiers are deliberately omitted — billing state is not workspace-read data. */
export function toWorkspaceResponse(
  workspace: WorkspaceDocument & { role?: WorkspaceRole },
): WorkspaceResponse {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    ownerId: workspace.ownerId.toString(),
    planId: workspace.planId,
    timezone: workspace.timezone,
    ...(workspace.role ? { role: workspace.role } : {}),
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  avatarUrl: string | null;
}

function isPopulatedUser(value: unknown): value is PopulatedUser {
  return !!value && typeof value === 'object' && 'email' in value;
}

export function toMemberResponse(member: WorkspaceMemberDocument): WorkspaceMemberResponse {
  const populated = isPopulatedUser(member.userId) ? member.userId : null;

  return {
    id: member._id.toString(),
    workspaceId: member.workspaceId.toString(),
    userId: populated ? populated._id.toString() : (member.userId?.toString() ?? null),
    role: member.role,
    invitedEmail: member.invitedEmail,
    status: member.status,
    user: populated
      ? {
          id: populated._id.toString(),
          name: populated.name,
          email: populated.email,
          avatarUrl: populated.avatarUrl ?? null,
        }
      : null,
    createdAt: member.createdAt.toISOString(),
  };
}
