import { IsNotEmpty, IsString } from 'class-validator';

export class ImportPinterestBoardDto {
  @IsString()
  @IsNotEmpty()
  boardId: string;
}
