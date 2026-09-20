import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CreateContentDto } from './dto/create-content.dto';
import { ContentService } from './content.service';
import { UpdateContentDto } from './dto/update-content.dto';

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Post()
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Create manual slideshow or post content' })
  async create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateContentDto,
  ) {
    return { data: await this.service.createManual(workspaceId, userId, dto) };
  }

  @Post('generate')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Generate AI-conditioned slideshow or post content' })
  async generate(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateContentDto,
  ) {
    return { data: await this.service.generate(workspaceId, userId, dto) };
  }

  @Get()
  async list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('goal') goal?: string,
    @Query('mediaAssetId') mediaAssetId?: string,
  ) {
    return { data: await this.service.list(workspaceId, type, status, goal, mediaAssetId) };
  }

  @Get(':id')
  async get(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) {
    return { data: await this.service.get(workspaceId, id) };
  }

  @Patch(':id')
  @RequireRoles('editor')
  async update(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string, @Body() dto: UpdateContentDto) {
    return { data: await this.service.update(workspaceId, id, dto) };
  }

  @Post(':id/duplicate')
  @RequireRoles('editor')
  async duplicate(@CurrentWorkspace('workspaceId') workspaceId: string, @CurrentUser('userId') userId: string, @Param('id') id: string) {
    return { data: await this.service.duplicate(workspaceId, userId, id) };
  }

  @Delete(':id')
  @RequireRoles('editor')
  async remove(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) {
    await this.service.remove(workspaceId, id);
  }
}
