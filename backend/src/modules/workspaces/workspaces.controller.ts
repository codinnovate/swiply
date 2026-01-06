import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { toMemberResponse, toWorkspaceResponse } from './workspaces.presenter';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @ApiOperation({ summary: 'List every workspace the caller is an active member of' })
  async list(@CurrentUser('userId') userId: string) {
    const workspaces = await this.workspacesService.listForUser(new Types.ObjectId(userId));
    return { data: workspaces.map(toWorkspaceResponse) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a workspace; the caller becomes its owner' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateWorkspaceDto) {
    const workspace = await this.workspacesService.create(new Types.ObjectId(userId), dto);
    return { data: toWorkspaceResponse(workspace) };
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceGuard)
  async findOne(@Param('workspaceId') workspaceId: string) {
    const workspace = await this.workspacesService.findByIdOrFail(workspaceId);
    return { data: toWorkspaceResponse(workspace) };
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceGuard)
  @RequireRoles('admin')
  async update(@Param('workspaceId') workspaceId: string, @Body() dto: UpdateWorkspaceDto) {
    const workspace = await this.workspacesService.update(workspaceId, dto);
    return { data: toWorkspaceResponse(workspace) };
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceGuard)
  async listMembers(@Param('workspaceId') workspaceId: string) {
    const members = await this.workspacesService.listMembers(workspaceId);
    return { data: members.map(toMemberResponse) };
  }

  @Post(':workspaceId/members')
  @UseGuards(WorkspaceGuard)
  @RequireRoles('admin')
  async inviteMember(@Param('workspaceId') workspaceId: string, @Body() dto: InviteMemberDto) {
    const member = await this.workspacesService.inviteMember(workspaceId, dto);
    return { data: toMemberResponse(member) };
  }

  @Patch(':workspaceId/members/:memberId')
  @UseGuards(WorkspaceGuard)
  @RequireRoles('admin')
  async updateMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const member = await this.workspacesService.updateMemberRole(workspaceId, memberId, dto);
    return { data: toMemberResponse(member) };
  }

  @Delete(':workspaceId/members/:memberId')
  @UseGuards(WorkspaceGuard)
  @RequireRoles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.workspacesService.removeMember(workspaceId, memberId);
  }
}
