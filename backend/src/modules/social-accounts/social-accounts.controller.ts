import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { VoiceConsentDto } from './dto/voice-consent.dto';
import { toSocialAccountResponse } from './social-accounts.presenter';
import { SocialAccountsService } from './social-accounts.service';

@ApiTags('social-accounts')
@Controller('social-accounts')
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List the connected accounts in the current workspace' })
  async list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    const accounts = await this.socialAccountsService.list(workspaceId);
    return { data: accounts.map(toSocialAccountResponse) };
  }

  @Get('platforms')
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard)
  @ApiOperation({
    summary: 'Platform support and capabilities on this deployment',
    description:
      'Lets the connect screen grey out platforms that are unimplemented or unconfigured instead of failing on click.',
  })
  listPlatforms() {
    return { data: this.socialAccountsService.listPlatforms() };
  }

  /**
   * Returns the authorize URL rather than 302-ing: the caller is an XHR
   * carrying a bearer token, and fetch() would follow a redirect itself
   * instead of handing the user to the platform.
   */
  @Get('connect/:platform')
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard)
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Begin an OAuth connection and get the platform authorize URL' })
  connect(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Param('platform') platform: string,
  ) {
    return { data: this.socialAccountsService.beginConnect(workspaceId, userId, platform) };
  }

  /**
   * Hit by the platform's redirect, so it is unauthenticated by necessity —
   * the signed state is what proves which workspace and user began the flow.
   * Always redirects; the browser is mid-flow and cannot render a JSON error.
   */
  @Get('callback/:platform')
  @Public()
  @ApiExcludeEndpoint()
  async callback(
    @Param('platform') platform: string,
    @Query() query: OAuthCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.socialAccountsService.completeConnect(platform, query));
  }

  @Post(':id/voice-consent')
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard)
  @RequireRoles('editor')
  @ApiOperation({
    summary: 'Record the Section 7 consent to learn this account’s voice',
    description:
      'Asked by the dashboard once the callback returns. Build step 3 reads it before enqueuing ingest-voice-samples.',
  })
  async setVoiceConsent(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: VoiceConsentDto,
  ) {
    const account = await this.socialAccountsService.recordVoiceConsent(
      workspaceId,
      id,
      dto.consent,
    );
    return { data: toSocialAccountResponse(account) };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard)
  @RequireRoles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect an account and delete its stored tokens' })
  async disconnect(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.socialAccountsService.disconnect(workspaceId, id);
  }
}
