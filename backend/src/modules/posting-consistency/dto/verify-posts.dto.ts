import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class QualifyingPostTypesDto {
  @IsBoolean() originalPosts: boolean;
  @IsBoolean() replies: boolean;
  @IsBoolean() reposts: boolean;
  @IsBoolean() quotePosts: boolean;
}

export class VerifyPostsDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{1,15}$/)
  username: string;

  @IsString()
  timezone: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  postingDays: number[];

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(1439, { each: true })
  deadlineMinutes: number[];

  @ValidateNested()
  @Type(() => QualifyingPostTypesDto)
  qualifyingPostTypes: QualifyingPostTypesDto;
}
