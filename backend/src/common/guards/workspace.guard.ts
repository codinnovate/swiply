import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';

import {
  ROLE_RANK,
  WorkspaceMember,
  WorkspaceMemberDocument,
  WorkspaceRole,
} from '../../modules/workspaces/schemas/workspace-member.schema';
import { REQUIRED_ROLES_KEY } from '../decorators/workspace.decorator';
import { ApiException } from '../errors/api.exception';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Section 12: enforces workspace-scoped authorization. Resolves which workspace
 * a request is acting on, proves the caller is an *active* member of it, and
 * attaches `{ workspaceId, role }` to the request so services never have to
 * re-derive (or forget) the scope.
 *
 * Resolution order — first hit wins:
 *   1. `:workspaceId` route param
 *   2. `X-Workspace-Id` header (how the dashboard scopes every call)
 *   3. `workspaceId` in the body or query string
 *   4. the caller's `defaultWorkspaceId`
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMemberDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.userId) {
      throw ApiException.unauthorized('UNAUTHORIZED', 'Authentication required');
    }

    const workspaceId = this.resolveWorkspaceId(request);
    if (!workspaceId) {
      throw ApiException.unprocessable(
        'WORKSPACE_CONTEXT_REQUIRED',
        'No workspace could be resolved for this request',
        { hint: 'Pass an X-Workspace-Id header or a workspaceId parameter' },
      );
    }

    if (!isValidObjectId(workspaceId)) {
      throw ApiException.unprocessable('WORKSPACE_CONTEXT_REQUIRED', 'Malformed workspace id', {
        workspaceId,
      });
    }

    const membership = await this.memberModel
      .findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(request.user.userId),
        status: 'active',
      })
      .lean()
      .exec();

    // Deliberately indistinguishable from "workspace does not exist" — a
    // non-member must not be able to probe for which workspace ids are real.
    if (!membership) {
      throw ApiException.forbidden(
        'WORKSPACE_ACCESS_DENIED',
        'You do not have access to this workspace',
        { workspaceId },
      );
    }

    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[] | undefined>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length) {
      const minimumRank = Math.min(...requiredRoles.map((role) => ROLE_RANK[role]));
      if (ROLE_RANK[membership.role] < minimumRank) {
        throw ApiException.forbidden(
          'INSUFFICIENT_ROLE',
          'Your role does not permit this action',
          { role: membership.role, requiredRoles },
        );
      }
    }

    request.workspace = { workspaceId, role: membership.role };
    return true;
  }

  private resolveWorkspaceId(request: AuthenticatedRequest): string | null {
    const fromParam = request.params?.workspaceId;
    if (typeof fromParam === 'string' && fromParam) return fromParam;

    const fromHeader = request.headers['x-workspace-id'];
    if (typeof fromHeader === 'string' && fromHeader) return fromHeader;

    const body = request.body as Record<string, unknown> | undefined;
    if (typeof body?.workspaceId === 'string' && body.workspaceId) return body.workspaceId;

    const fromQuery = request.query?.workspaceId;
    if (typeof fromQuery === 'string' && fromQuery) return fromQuery;

    return request.user.defaultWorkspaceId ?? null;
  }
}
