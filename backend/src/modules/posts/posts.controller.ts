import { Body, Controller, Delete, Get, Param, Post as HttpPost, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly service: PostsService) {}
  @HttpPost()
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Schedule content for a connected account' })
  async create(@CurrentWorkspace('workspaceId') workspaceId: string, @Body() dto: CreatePostDto) { return { data: await this.service.create(workspaceId, dto) }; }
  @Get()
  async list(@CurrentWorkspace('workspaceId') workspaceId: string, @Query('status') status?: string, @Query('socialAccountId') accountId?: string) { return { data: await this.service.list(workspaceId, status, accountId) }; }
  @Get(':id')
  async get(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) { return { data: await this.service.get(workspaceId, id) }; }
  @HttpPost(':id/cancel')
  @RequireRoles('editor')
  async cancel(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) { await this.service.cancel(workspaceId, id); }
  @HttpPost(':id/publish-now')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Publish a queued post immediately' })
  async publishNow(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) { return { data: await this.service.publishNow(workspaceId, id) }; }
  @Delete(':id')
  @RequireRoles('editor')
  async remove(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) { await this.service.cancel(workspaceId, id); }
}
