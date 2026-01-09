import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'creator@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'correct-horse-battery' })
  @IsString()
  @Length(1, 128)
  password: string;
}
