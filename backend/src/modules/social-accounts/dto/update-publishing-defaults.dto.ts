import { IsObject } from 'class-validator';

export class UpdatePublishingDefaultsDto {
  @IsObject() publishingDefaults: Record<string, unknown>;
}
