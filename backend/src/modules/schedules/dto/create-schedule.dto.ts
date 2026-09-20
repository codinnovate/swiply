import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FixedDaysDto {
  @IsInt() @Min(1) @Max(7) postsPerWeek: number;
  @IsArray() @IsInt({ each: true }) daysOfWeek: number[];
  @IsString() timeOfDay: string;
}
class WindowDto {
  @IsInt() @Min(0) @Max(23) startHour: number;
  @IsInt() @Min(1) @Max(24) endHour: number;
}
class VolumeDto {
  @IsInt() @Min(1) postsPerMonth: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => WindowDto) postingWindows: WindowDto[];
  @IsInt() @Min(1) minGapMinutes: number;
  @IsInt() @Min(0) jitterMinutes: number;
}
export class CreateScheduleDto {
  @IsString() name: string;
  @IsArray() @IsString({ each: true }) socialAccountIds: string[];
  @ValidateNested() @Type(() => Object) contentTypeMix: { slideshow: number; video: number; post: number };
  @IsIn(['fixed_days', 'volume']) mode: 'fixed_days' | 'volume';
  @IsOptional() @ValidateNested() @Type(() => FixedDaysDto) fixedDays?: FixedDaysDto;
  @IsOptional() @ValidateNested() @Type(() => VolumeDto) volume?: VolumeDto;
  @IsOptional() @IsDateString() endDate?: string;
  @IsIn(['ai_autogenerate', 'content_bank', 'manual_queue']) contentSource: string;
  @IsOptional() @IsString() autoGeneratePrompt?: string;
  @IsIn(['conversions', 'awareness', 'engagement', 'traffic', 'lead_gen', 'community', 'announcement']) defaultGoal: string;
  @IsIn(['user_provided', 'ai_generated']) defaultImageSource: string;
  @IsBoolean() autopilot: boolean;
}
