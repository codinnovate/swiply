import type { XPostDetail } from '../../posting-consistency/domain/x-post-provider.interface';
import {
  buildScoreablePosts,
  buildScoringInput,
  highActivityWindows,
  topicLabel,
} from './post-features';

const engagement = { likes: 1, reposts: 0, replies: 0, quotes: 0, bookmarks: 0, views: 100 };
const post = (overrides: Partial<XPostDetail> & Pick<XPostDetail, 'id'>): XPostDetail => ({
  url: `https://x.com/sam/status/${overrides.id}`,
  authorUsername: 'sam',
  text: `post ${overrides.id}`,
  createdAt: new Date('2026-09-20T12:00:00Z'),
  kind: 'original',
  mediaType: 'none',
  hasExternalLink: false,
  hashtagCount: 0,
  engagement,
  ...overrides,
});

describe('buildScoreablePosts', () => {
  it('folds self-replies into a thread and detects a link placed in a reply', () => {
    const posts = [
      post({
        id: '3',
        kind: 'reply',
        replyToUsername: 'sam',
        replyToPostId: '2',
        text: '@sam link: https://a.co',
        hasExternalLink: true,
        createdAt: new Date('2026-09-20T12:02:00Z'),
      }),
      post({
        id: '2',
        kind: 'reply',
        replyToUsername: 'sam',
        replyToPostId: '1',
        text: 'part two',
        createdAt: new Date('2026-09-20T12:01:00Z'),
      }),
      post({ id: '1', text: 'part one' }),
    ];
    const [thread] = buildScoreablePosts(posts, 'Sam');
    expect(thread).toMatchObject({
      postId: '1',
      isThread: true,
      threadLength: 3,
      threadTexts: ['part two', 'link: https://a.co'],
      hasExternalLink: true,
      linkLocation: 'reply',
    });
  });

  it('drops reposts and replies to other accounts', () => {
    const posts = [
      post({ id: '1', kind: 'repost' }),
      post({ id: '2', kind: 'reply', replyToUsername: 'someone', replyToPostId: '9' }),
      post({ id: '3', kind: 'quote', hasExternalLink: true }),
    ];
    const result = buildScoreablePosts(posts, 'sam');
    expect(result.map((item) => item.postId)).toEqual(['3']);
    expect(result[0]).toMatchObject({
      isThread: false,
      threadLength: 1,
      linkLocation: 'main_post',
    });
  });

  it('changes the content hash when a thread grows', () => {
    const root = post({ id: '1' });
    const [before] = buildScoreablePosts([root], 'sam');
    const [after] = buildScoreablePosts(
      [root, post({ id: '2', kind: 'reply', replyToUsername: 'sam', replyToPostId: '1' })],
      'sam',
    );
    expect(before.contentHash).not.toBe(after.contentHash);
  });
});

describe('buildScoringInput', () => {
  it('matches the documented input shape, in the account timezone', () => {
    const [scoreable] = buildScoreablePosts(
      [post({ id: '1', mediaType: 'video', hashtagCount: 2 })],
      'sam',
    );
    expect(
      buildScoringInput(scoreable, {
        recentPostTopics: ['pricing'],
        accountNiche: 'indie SaaS growth',
        timezone: 'America/New_York',
      }),
    ).toEqual({
      post_text: 'post 1',
      media_type: 'video',
      is_thread: false,
      has_external_link: false,
      link_location: 'none',
      hashtag_count: 2,
      posted_at: '2026-09-20T08:00:00.000-04:00',
      recent_post_topics: ['pricing'],
      account_niche: 'indie SaaS growth',
    });
  });
});

describe('highActivityWindows', () => {
  it('needs enough history, then ranks 2-hour windows by engagement per view', () => {
    const at = (hour: number, likes: number) => ({
      postedAt: new Date(Date.UTC(2026, 8, 20, hour)),
      engagement: { ...engagement, likes, views: 100 },
    });
    expect(highActivityWindows([at(18, 50)], 'UTC')).toEqual([]);
    const samples = [
      ...[18, 19, 18, 19].map((hour) => at(hour, 50)),
      ...[8, 9, 8].map((hour) => at(hour, 5)),
      ...[12, 13, 12].map((hour) => at(hour, 20)),
    ];
    expect(highActivityWindows(samples, 'UTC')).toEqual([
      '18:00-20:00 UTC',
      '12:00-14:00 UTC',
      '08:00-10:00 UTC',
    ]);
  });
});

describe('topicLabel', () => {
  it('uses the first non-empty line, truncated', () => {
    expect(topicLabel('\nPricing lessons\nmore')).toBe('Pricing lessons');
    expect(topicLabel('x'.repeat(100))).toHaveLength(80);
  });
});
