import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class CreatePostDto {
  @IsMongoId() contentId: string;
  @IsMongoId() socialAccountId: string;
  @IsDateString() scheduledFor: string;
  @IsOptional() @IsMongoId() scheduleId?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  publishNow?: boolean;
}
