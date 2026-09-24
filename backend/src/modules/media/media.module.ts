import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MediaAsset, MediaAssetSchema } from './schemas/media-asset.schema';
import { MediaUpload, MediaUploadSchema } from './schemas/media-upload.schema';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FfmpegService } from './ffmpeg.service';
import { S3StorageService } from './s3-storage.service';
import { TikTokMediaFitService } from './tiktok-media-fit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaAsset.name, schema: MediaAssetSchema },
      { name: MediaUpload.name, schema: MediaUploadSchema },
    ]),
    WorkspacesModule,
  ],
  controllers: [MediaController],
  providers: [MediaService, S3StorageService, FfmpegService, TikTokMediaFitService],
  exports: [MediaService, TikTokMediaFitService],
})
export class MediaModule {}
