import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { WORKSPACE_ROLES, WorkspaceRole } from '../schemas/workspace-member.schema';

const ASSIGNABLE_ROLES = WORKSPACE_ROLES.filter((role) => role !== 'owner');

export class UpdateMemberDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES, example: 'admin' })
  @IsIn(ASSIGNABLE_ROLES)
  role: Exclude<WorkspaceRole, 'owner'>;
}
