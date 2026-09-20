import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CompleteMediaUploadDto } from './dto/complete-media-upload.dto';
import { InitiateMediaUploadDto } from './dto/initiate-media-upload.dto';
import { SignUploadPartsDto } from './dto/sign-upload-parts.dto';
import { UpdateMediaAssetDto } from './dto/update-media-asset.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Post('uploads')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Initiate a private S3 multipart media upload' })
  async initiate(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiateMediaUploadDto,
  ) {
    return { data: await this.service.initiate(workspaceId, userId, dto) };
  }

  @Post('uploads/:id/parts')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Create short-lived presigned URLs for upload parts' })
  async signParts(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: SignUploadPartsDto,
  ) {
    return { data: await this.service.signParts(workspaceId, id, dto.partNumbers) };
  }

  @Post('uploads/:id/complete')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Complete an S3 multipart upload and create its media asset' })
  async complete(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: CompleteMediaUploadDto,
  ) {
    return { data: await this.service.complete(workspaceId, id, dto) };
  }

  @Delete('uploads/:id')
  @RequireRoles('editor')
  @HttpCode(204)
  async abort(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) {
    await this.service.abort(workspaceId, id);
  }

  @Get()
  async list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Query('type') type?: 'image' | 'video',
    @Query('tag') tag?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, hasMore, nextCursor } = await this.service.list(
      workspaceId,
      type,
      tag,
      cursor,
      limit ? Number(limit) : undefined,
    );
    return { data: items, hasMore, nextCursor };
  }

  @Patch(':id')
  @RequireRoles('editor')
  @ApiOperation({ summary: 'Update tags on a media asset' })
  async update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMediaAssetDto,
  ) {
    return { data: await this.service.update(workspaceId, id, dto.tags) };
  }

  @Delete(':id')
  @RequireRoles('editor')
  @HttpCode(204)
  async remove(@CurrentWorkspace('workspaceId') workspaceId: string, @Param('id') id: string) {
    await this.service.remove(workspaceId, id);
  }
}
