import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class CreatePostDto {
  @IsMongoId() contentId: string;
  @IsMongoId() socialAccountId: string;
  @IsDateString() scheduledFor: string;
  @IsOptional() @IsMongoId() scheduleId?: string;
}
