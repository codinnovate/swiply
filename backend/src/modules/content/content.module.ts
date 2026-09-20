import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MediaModule } from '../media/media.module';
import { VoiceProfilesModule } from '../voice-profiles/voice-profiles.module';
import { Content, ContentSchema } from './schemas/content.schema';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Content.name, schema: ContentSchema }]),
    WorkspacesModule,
    MediaModule,
    VoiceProfilesModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
