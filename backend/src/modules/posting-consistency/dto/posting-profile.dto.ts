import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export function normalizeUsername(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  let username = value.trim();
  username = username.replace(/^https?:\/\/(?:www\.)?x\.com\//i, '');
  username = username.replace(/\/+$/, '');
  username = username.replace(/^@/, '');
  return username.toLowerCase();
}

export class PostingProfileDto {
  @Transform(({ value }) => normalizeUsername(value))
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{1,15}$/, {
    message: 'username must contain only letters, numbers, or underscores and be at most 15 characters',
  })
  username: string;
}
