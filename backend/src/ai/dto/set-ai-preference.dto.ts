import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { AI_PROVIDERS } from '../ai-providers';

export class SetAiPreferenceDto {
  @IsIn([...AI_PROVIDERS])
  provider: (typeof AI_PROVIDERS)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  model: string;
}
