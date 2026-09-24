import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'creator@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '424242', minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  otp: string;

  @ApiProperty({ minLength: 12, example: 'correct-horse-battery' })
  @IsString()
  @Length(12, 128, { message: 'Password must be between 12 and 128 characters' })
  @Matches(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  @Matches(/[0-9\W]/, { message: 'Password must contain at least one number or symbol' })
  password: string;
}
