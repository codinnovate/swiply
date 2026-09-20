import { IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateMediaAssetDto {
  @IsArray() @IsString({ each: true }) @MaxLength(40, { each: true }) tags: string[];
}
