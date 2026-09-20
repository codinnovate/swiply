import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';
import { VoiceProfilesService } from './voice-profiles.service';

@ApiTags('voice-profiles')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('voice-profiles')
export class VoiceProfilesController {
  constructor(private readonly service: VoiceProfilesService) {}

  @Get(':socialAccountId')
  @ApiOperation({ summary: 'Get the learned voice profile for a social account' })
  async get(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('socialAccountId') accountId: string,
  ) {
    return { data: await this.service.get(workspaceId, accountId) };
  }

  @Post(':socialAccountId/relearn')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Fetch recent posts and relearn the account voice' })
  async relearn(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Param('socialAccountId') accountId: string,
  ) {
    return { data: await this.service.ingest(workspaceId, accountId, userId) };
  }

  @Patch(':socialAccountId')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Update explicit tone instructions' })
  async update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('socialAccountId') accountId: string,
    @Body() dto: UpdateVoiceProfileDto,
  ) {
    return { data: await this.service.update(workspaceId, accountId, dto) };
  }

  @Get(':socialAccountId/source-posts')
  @ApiOperation({ summary: 'List posts used to learn the account voice' })
  async sourcePosts(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('socialAccountId') accountId: string,
  ) {
    return { data: await this.service.listSourcePosts(workspaceId, accountId) };
  }

  @Delete(':socialAccountId/source-posts/:id')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Delete an ingested source post and refresh the profile' })
  async deleteSourcePost(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Param('socialAccountId') accountId: string,
    @Param('id') sourcePostId: string,
  ) {
    await this.service.deleteSourcePost(workspaceId, accountId, sourcePostId, userId);
  }
}
