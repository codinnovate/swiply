import { Inject, Injectable } from '@nestjs/common';
import { DateTime, IANAZone } from 'luxon';

import {
  X_POST_PROVIDER,
  type XPostProvider,
  type XProfile,
} from './domain/x-post-provider.interface';
import type { VerifyPostsDto } from './dto/verify-posts.dto';
import { ApiException } from '../../common/errors/api.exception';

@Injectable()
export class PostingConsistencyService {
  constructor(@Inject(X_POST_PROVIDER) private readonly provider: XPostProvider) {}

  getProfile(username: string): Promise<XProfile> {
    return this.provider.getProfile(username);
  }

  async verifyPosts(dto: VerifyPostsDto) {
    if (!IANAZone.isValidZone(dto.timezone)) {
      throw ApiException.unprocessable(
        'VALIDATION_FAILED',
        'timezone must be a valid IANA timezone',
      );
    }
    const localNow = DateTime.now().setZone(dto.timezone);
    const providerWeekday = localNow.weekday === 7 ? 1 : localNow.weekday + 1;
    if (!dto.postingDays.includes(providerWeekday)) {
      return {
        verified: true,
        verifiedCount: 0,
        goal: dto.deadlineMinutes.length,
        shouldBlock: false,
      };
    }

    const since = localNow.startOf('day').toUTC().toJSDate();
    const posts = await this.provider.listPostsSince(dto.username.toLowerCase(), since);
    const enabled = dto.qualifyingPostTypes;
    const verifiedCount = posts.filter((post) => {
      if (post.kind === 'original') return enabled.originalPosts;
      if (post.kind === 'reply') return enabled.replies;
      if (post.kind === 'repost') return enabled.reposts;
      return enabled.quotePosts;
    }).length;
    const passedDeadlines = dto.deadlineMinutes.filter(
      (minutes) => minutes <= localNow.hour * 60 + localNow.minute,
    ).length;
    const goal = dto.deadlineMinutes.length;
    return {
      verified: verifiedCount > 0,
      verifiedCount: Math.min(verifiedCount, goal),
      goal,
      shouldBlock: verifiedCount < passedDeadlines,
    };
  }
}
