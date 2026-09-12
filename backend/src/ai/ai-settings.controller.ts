import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiCredentialsService } from './ai-credentials.service';
import { SaveAiCredentialDto } from './dto/save-ai-credential.dto';
import { AiProviderRegistry } from './ai-provider-registry.service';
import { isAiProvider } from './ai-providers';
import { SaveProviderCredentialDto } from './dto/save-provider-credential.dto';
import { ApiException } from '../common/errors/api.exception';

@ApiTags('ai-settings')
@ApiBearerAuth()
@Controller('ai')
export class AiSettingsController {
  constructor(private readonly credentials: AiCredentialsService, private readonly providers: AiProviderRegistry) {}

  @Get('providers')
  providerList() {
    return { data: this.providers.list() };
  }

  @Get('models')
  models(@Query('provider') provider?: string) {
    if (!provider) return { data: this.providers.models() };
    if (!isAiProvider(provider)) throw ApiException.unprocessable('AI_MODEL_NOT_SUPPORTED', 'Unknown AI provider');
    return { data: this.providers.models(provider) };
  }

  @Get('credentials')
  async list(@CurrentUser('userId') userId: string) {
    return { data: await this.credentials.list(userId) };
  }

  @Put('credentials/openai')
  @ApiOperation({ summary: 'Validate and securely save the current user’s OpenAI key' })
  async save(@CurrentUser('userId') userId: string, @Body() dto: SaveAiCredentialDto) {
    return { data: await this.credentials.save(userId, dto) };
  }

  @Put('credentials/:provider')
  @ApiOperation({ summary: 'Validate and securely save a personal AI provider key' })
  async saveProvider(@CurrentUser('userId') userId: string, @Param('provider') provider: string, @Body() dto: SaveProviderCredentialDto) {
    return { data: await this.credentials.saveProvider(userId, provider, dto) };
  }

  @Delete('credentials/openai')
  @HttpCode(204)
  async remove(@CurrentUser('userId') userId: string) {
    await this.credentials.remove(userId);
  }

  @Delete('credentials/:provider')
  @HttpCode(204)
  async removeProvider(@CurrentUser('userId') userId: string, @Param('provider') provider: string) {
    await this.credentials.removeProvider(userId, provider);
  }
}
