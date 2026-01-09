import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsTimeZone, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'creator@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiProperty({ minLength: 12, example: 'correct-horse-battery' })
  @IsString()
  @Length(12, 128, { message: 'Password must be between 12 and 128 characters' })
  @Matches(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  @Matches(/[0-9\W]/, { message: 'Password must contain at least one number or symbol' })
  password: string;

  @ApiPropertyOptional({
    example: 'Europe/London',
    description: 'Timezone for the workspace created alongside this account.',
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
