import { IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateContentDto {
  @IsOptional() @IsString() @MaxLength(2200) postCaption?: string;
  @IsOptional() @IsString() @MaxLength(2200) text?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) hashtags?: string[];
  @IsOptional() @IsIn(['draft', 'ready', 'archived']) status?: 'draft' | 'ready' | 'archived';
  @IsOptional() @IsArray() @IsUrl({ require_tld: false }, { each: true }) imageUrls?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) mediaAssetIds?: string[];
}
