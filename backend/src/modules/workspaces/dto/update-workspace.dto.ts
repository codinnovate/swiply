import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsTimeZone, Length } from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Acme Social' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional({ example: 'Europe/London' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
