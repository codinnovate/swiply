import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CompetitorsController } from './competitors.controller';
import { CompetitorsService } from './competitors.service';
import { TIKTOK_AD_SOURCE, TIKTOK_VIDEO_SOURCE } from './domain/competitor.types';
import { ApifyTiktokVideoSource } from './providers/apify-tiktok-video.source';
import { TiktokAdLibrarySource } from './providers/tiktok-ad-library.source';
import { CompetitorReport, CompetitorReportSchema } from './schemas/competitor-report.schema';

@Module({
  imports: [
    WorkspacesModule,
    MongooseModule.forFeature([{ name: CompetitorReport.name, schema: CompetitorReportSchema }]),
  ],
  controllers: [CompetitorsController],
  providers: [
    CompetitorsService,
    { provide: TIKTOK_VIDEO_SOURCE, useClass: ApifyTiktokVideoSource },
    { provide: TIKTOK_AD_SOURCE, useClass: TiktokAdLibrarySource },
  ],
})
export class CompetitorsModule {}
