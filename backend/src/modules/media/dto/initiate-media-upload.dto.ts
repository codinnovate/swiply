import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class InitiateMediaUploadDto {
  @IsString() @MaxLength(255) fileName: string;
  @IsString() @MaxLength(100) mimeType: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2_147_483_648) sizeBytes: number;
  @IsIn(['image', 'video']) type: 'image' | 'video';
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) width?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) height?: number;
}
