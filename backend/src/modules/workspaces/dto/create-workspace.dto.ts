import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsTimeZone, Length } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Acme Social' })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional({
    example: 'Europe/London',
    description: 'IANA timezone. All schedule and posting-window math resolves through this.',
    default: 'UTC',
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
