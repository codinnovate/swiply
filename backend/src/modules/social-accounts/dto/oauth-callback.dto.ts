import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Query string the platform appends to the redirect. `code` is absent when the
 * user declined, in which case `error` carries the provider's slug — the global
 * pipe runs with forbidNonWhitelisted, so every field a provider may send has
 * to be declared here or the callback 400s on the user.
 */
export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  error?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  error_description?: string;

  /** Meta sends this instead of `error` when the user cancels the dialog. */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  error_reason?: string;

  /** X echoes the granted scope set. */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scopes?: string;
}
