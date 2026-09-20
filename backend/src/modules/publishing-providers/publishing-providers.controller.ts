import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { ApiException } from '../../common/errors/api.exception';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import {
  DiscoverPublishingProviderDto,
  ImportProviderChannelsDto,
  SavePublishingProviderDto,
} from './dto/publishing-provider.dto';
import { PublishingProvidersService } from './publishing-providers.service';
import {
  PUBLISHING_PROVIDERS,
  PublishingProvider,
} from './schemas/publishing-provider-connection.schema';

@ApiTags('publishing-providers')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('publishing-providers')
export class PublishingProvidersController {
  constructor(private readonly service: PublishingProvidersService) {}
  @Get() list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.wrap(this.service.list(workspaceId));
  }
  @Post(':provider/discover') @RequireRoles('admin') discover(
    @Param('provider') value: string,
    @Body() dto: DiscoverPublishingProviderDto,
  ) {
    return this.wrap(this.service.discover(this.provider(value), dto));
  }
  @Put(':provider') @RequireRoles('admin') save(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Param('provider') value: string,
    @Body() dto: SavePublishingProviderDto,
  ) {
    return this.wrap(this.service.save(workspaceId, userId, this.provider(value), dto));
  }
  @Get(':provider/channels') @RequireRoles('admin') channels(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('provider') value: string,
  ) {
    return this.wrap(this.service.channels(workspaceId, this.provider(value)));
  }
  @Post(':provider/channels/import') @RequireRoles('admin') import(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Param('provider') value: string,
    @Body() dto: ImportProviderChannelsDto,
  ) {
    return this.wrap(this.service.importChannels(workspaceId, userId, this.provider(value), dto));
  }
  @Post(':provider/sync') @RequireRoles('admin') sync(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('provider') value: string,
  ) {
    return this.wrap(this.service.sync(workspaceId, this.provider(value)));
  }
  @Delete(':provider') @RequireRoles('admin') async remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('provider') value: string,
  ) {
    await this.service.remove(workspaceId, this.provider(value));
  }
  private provider(value: string): PublishingProvider {
    if (!(PUBLISHING_PROVIDERS as readonly string[]).includes(value))
      throw ApiException.unprocessable(
        'PUBLISHING_PROVIDER_NOT_CONFIGURED',
        'Unsupported publishing provider',
      );
    return value as PublishingProvider;
  }
  private async wrap<T>(value: Promise<T>) {
    return { data: await value };
  }
}
