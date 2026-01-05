import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { UsersService } from '../users/users.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
  WorkspaceMember,
  WorkspaceMemberDocument,
  WorkspaceRole,
} from './schemas/workspace-member.schema';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMemberDocument>,
    private readonly usersService: UsersService,
  ) {}

  async create(ownerId: Types.ObjectId, dto: CreateWorkspaceDto): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceModel.create({
      name: dto.name.trim(),
      ownerId,
      planId: 'free',
      timezone: dto.timezone ?? 'UTC',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });

    try {
      await this.memberModel.create({
        workspaceId: workspace._id,
        userId: ownerId,
        role: 'owner',
        invitedEmail: null,
        status: 'active',
      });
    } catch (error) {
      // No transactions (Atlas replica sets have them, local/standalone may not),
      // so a workspace with no owner membership is unreachable garbage — undo it.
      await this.workspaceModel.deleteOne({ _id: workspace._id }).exec();
      throw error;
    }

    return workspace;
  }

  /**
   * Every user gets a workspace at signup — the dashboard has no "no workspace"
   * state, and `defaultWorkspaceId` is what WorkspaceGuard falls back to.
   */
  async bootstrapForNewUser(
    userId: Types.ObjectId,
    userName: string,
    timezone = 'UTC',
  ): Promise<WorkspaceDocument> {
    const workspace = await this.create(userId, {
      name: `${userName.split(' ')[0]}'s Workspace`,
      timezone,
    });
    await this.usersService.setDefaultWorkspace(userId, workspace._id);
    return workspace;
  }

  /**
   * Turns invites addressed to an email into real memberships once that person
   * actually signs up. Called on registration and on first Google sign-in.
   */
  async claimPendingInvites(userId: Types.ObjectId, email: string): Promise<number> {
    const result = await this.memberModel
      .updateMany(
        { invitedEmail: email.toLowerCase().trim(), status: 'pending', userId: null },
        { $set: { userId, status: 'active' } },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`Claimed ${result.modifiedCount} pending invite(s) for ${email}`);
    }
    return result.modifiedCount;
  }

  async listForUser(userId: Types.ObjectId): Promise<Array<WorkspaceDocument & { role: WorkspaceRole }>> {
    const memberships = await this.memberModel
      .find({ userId, status: 'active' })
      .lean()
      .exec();

    if (memberships.length === 0) return [];

    const workspaces = await this.workspaceModel
      .find({ _id: { $in: memberships.map((m) => m.workspaceId) } })
      .sort({ createdAt: 1 })
      .exec();

    const roleByWorkspace = new Map(memberships.map((m) => [m.workspaceId.toString(), m.role]));
    return workspaces.map((workspace) =>
      Object.assign(workspace, { role: roleByWorkspace.get(workspace._id.toString())! }),
    );
  }

  async findByIdOrFail(workspaceId: string | Types.ObjectId): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceModel.findById(workspaceId).exec();
    if (!workspace) {
      throw ApiException.notFound('Workspace', { workspaceId: workspaceId.toString() });
    }
    return workspace;
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto): Promise<WorkspaceDocument> {
    const workspace = await this.findByIdOrFail(workspaceId);
    if (dto.name !== undefined) workspace.name = dto.name.trim();
    if (dto.timezone !== undefined) workspace.timezone = dto.timezone;
    return workspace.save();
  }

  listMembers(workspaceId: string): Promise<WorkspaceMemberDocument[]> {
    return this.memberModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .populate('userId', 'name email avatarUrl')
      .sort({ createdAt: 1 })
      .exec();
  }

  async inviteMember(workspaceId: string, dto: InviteMemberDto): Promise<WorkspaceMemberDocument> {
    const email = dto.email.toLowerCase().trim();
    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const existingUser = await this.usersService.findByEmail(email);

    const alreadyMember = await this.memberModel
      .findOne({
        workspaceId: workspaceObjectId,
        $or: [
          { invitedEmail: email },
          ...(existingUser ? [{ userId: existingUser._id }] : []),
        ],
      })
      .exec();

    if (alreadyMember) {
      throw new ApiException(
        'MEMBER_ALREADY_EXISTS',
        'That person is already a member of, or invited to, this workspace',
        409,
        { email, status: alreadyMember.status },
      );
    }

    // An existing Swiply user joins immediately; anyone else sits as `pending`
    // until they sign up, at which point claimPendingInvites() activates them.
    return this.memberModel.create({
      workspaceId: workspaceObjectId,
      userId: existingUser?._id ?? null,
      role: dto.role,
      invitedEmail: email,
      status: existingUser ? 'active' : 'pending',
    });
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<WorkspaceMemberDocument> {
    const member = await this.getMemberOrFail(workspaceId, memberId);

    if (member.role === 'owner') {
      throw ApiException.forbidden(
        'CANNOT_REMOVE_OWNER',
        'The workspace owner’s role cannot be changed',
        { memberId },
      );
    }

    member.role = dto.role;
    return member.save();
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    const member = await this.getMemberOrFail(workspaceId, memberId);

    if (member.role === 'owner') {
      throw ApiException.forbidden(
        'CANNOT_REMOVE_OWNER',
        'The workspace owner cannot be removed',
        { memberId },
      );
    }

    await this.memberModel.deleteOne({ _id: member._id }).exec();
  }

  private async getMemberOrFail(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberDocument> {
    const member = await this.memberModel
      .findOne({ _id: memberId, workspaceId: new Types.ObjectId(workspaceId) })
      .exec();

    if (!member) {
      throw ApiException.notFound('Workspace member', { memberId });
    }
    return member;
  }
}
