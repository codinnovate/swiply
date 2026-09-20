import { IsArray, IsString, MaxLength, ArrayMaxSize } from 'class-validator';

export class UpdateVoiceProfileDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  userSetTone: string[];
}
