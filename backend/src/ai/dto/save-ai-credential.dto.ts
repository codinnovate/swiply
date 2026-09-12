import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { OPENAI_MODELS } from '../openai-models';

export class SaveAiCredentialDto {
  @IsString()
  @MinLength(20)
  @MaxLength(300)
  apiKey: string;

  @IsString()
  @IsIn(OPENAI_MODELS.map((model) => model.id))
  defaultModel: string;
}
