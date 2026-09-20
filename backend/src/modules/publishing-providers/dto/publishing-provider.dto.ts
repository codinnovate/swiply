import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PUBLISHING_PROVIDERS } from '../schemas/publishing-provider-connection.schema';

export class DiscoverPublishingProviderDto {
  @IsString() @MinLength(8) @MaxLength(500) apiKey: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) baseUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) organizationId?: string;
}

export class SavePublishingProviderDto extends DiscoverPublishingProviderDto {
  @IsOptional() @IsString() @MaxLength(200) organizationName?: string;
}

export class ChannelImportItemDto {
  @IsString() @MaxLength(300) id: string;
  @IsOptional() @IsObject() publishingDefaults?: Record<string, unknown>;
}

export class ImportProviderChannelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelImportItemDto)
  channels: ChannelImportItemDto[];
}

export class ProviderParamDto {
  @IsIn(PUBLISHING_PROVIDERS) provider: 'buffer' | 'postiz';
}
