import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompletedUploadPartDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) partNumber: number;

  @Transform(({ obj, value }) => value ?? obj.etag)
  @IsOptional()
  @IsString()
  eTag?: string;

  /** Browsers expose S3's header as `etag`; accept it and map onto `eTag`. */
  @Allow()
  etag?: string;
}

export class CompleteMediaUploadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => CompletedUploadPartDto)
  parts: CompletedUploadPartDto[];
}
