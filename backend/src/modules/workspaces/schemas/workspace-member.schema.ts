import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const WORKSPACE_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const MEMBER_STATUSES = ['active', 'pending'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/**
 * Role hierarchy used by WorkspaceGuard: a member satisfies a requirement when
 * their rank is >= the lowest-ranked role the route accepts.
 */
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/** Section 4.3 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'workspacemembers' })
export class WorkspaceMember {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** null while an invite is still `pending` and the invitee has no account. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ type: String, enum: WORKSPACE_ROLES, required: true })
  role: WorkspaceRole;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  invitedEmail: string | null;

  @Prop({ type: String, enum: MEMBER_STATUSES, default: 'active' })
  status: MemberStatus;

  createdAt: Date;
}

export type WorkspaceMemberDocument = HydratedDocument<WorkspaceMember>;
export const WorkspaceMemberSchema = SchemaFactory.createForClass(WorkspaceMember);

// Section 4.18: `WorkspaceMember.{workspaceId, userId}` unique compound.
// Partial so multiple pending invites (userId: null) can coexist in a workspace.
WorkspaceMemberSchema.index(
  { workspaceId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);
WorkspaceMemberSchema.index(
  { workspaceId: 1, invitedEmail: 1 },
  { unique: true, partialFilterExpression: { invitedEmail: { $type: 'string' } } },
);
