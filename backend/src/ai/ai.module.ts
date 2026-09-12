import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AiCredentialsService } from './ai-credentials.service';
import { AiSettingsController } from './ai-settings.controller';
import { OpenAiGateway } from './openai-gateway.service';
import { AiCredential, AiCredentialSchema } from './schemas/ai-credential.schema';
import { TextService } from './text.service';
import { AiProviderRegistry } from './ai-provider-registry.service';

/**
 * Global because nearly every domain module needs one of these: voice analysis,
 * content generation, reply drafting, sentiment, and the moderation gate all
 * resolve to the same client. Importing it into eight modules would be noise.
 */
@Global()
@Module({
  imports: [
    HttpModule.register({ timeout: 120_000, maxRedirects: 3 }),
    MongooseModule.forFeature([{ name: AiCredential.name, schema: AiCredentialSchema }]),
  ],
  controllers: [AiSettingsController],
  providers: [AiCredentialsService, OpenAiGateway, AiProviderRegistry, TextService],
  exports: [AiCredentialsService, OpenAiGateway, AiProviderRegistry, TextService, HttpModule],
})
export class AiModule {}
