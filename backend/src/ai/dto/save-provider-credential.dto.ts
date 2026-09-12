import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveProviderCredentialDto {
  @IsString()
  @MinLength(20)
  @MaxLength(300)
  apiKey: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  defaultModel: string;
}
