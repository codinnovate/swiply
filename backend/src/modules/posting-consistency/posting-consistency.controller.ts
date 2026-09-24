import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { PostingProfileDto } from './dto/posting-profile.dto';
import { VerifyPostsDto } from './dto/verify-posts.dto';
import { PostingConsistencyService } from './posting-consistency.service';

@ApiTags('posting-consistency')
@Controller('v1')
export class PostingConsistencyController {
  constructor(private readonly service: PostingConsistencyService) {}

  @Public()
  @Post('posting-profile')
  @ApiOperation({ summary: 'Verify a public X username without authenticating the X account' })
  async postingProfile(@Body() dto: PostingProfileDto) {
    return { profile: await this.service.getProfile(dto.username) };
  }

  @Public()
  @Post('posting-commitment/verify')
  @ApiOperation({ summary: 'Count qualifying public X posts for the current local day' })
  verifyPosts(@Body() dto: VerifyPostsDto) {
    return this.service.verifyPosts(dto);
  }
}
