import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';

import { WORKSPACE_ROLES, WorkspaceRole } from '../schemas/workspace-member.schema';

/** `owner` is intentionally not invitable — ownership transfers are a separate action. */
const INVITABLE_ROLES = WORKSPACE_ROLES.filter((role) => role !== 'owner');

export class InviteMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: INVITABLE_ROLES, example: 'editor' })
  @IsIn(INVITABLE_ROLES)
  role: Exclude<WorkspaceRole, 'owner'>;
}
