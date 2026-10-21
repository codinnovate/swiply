import { tiktokPostUpdate } from './tiktok-publish-status.service';

describe('tiktokPostUpdate', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const recent = new Date('2026-10-02T11:59:00Z');

  it('marks the post published and keeps the public post id', () => {
    expect(
      tiktokPostUpdate({ status: 'PUBLISH_COMPLETE', failReason: null, postIds: ['7300'] }, now, recent),
    ).toMatchObject({ status: 'published', publishedAt: now, platformPostId: '7300' });
  });

  it('keeps the publish_id for private posts, which return no public id', () => {
    const update = tiktokPostUpdate({ status: 'PUBLISH_COMPLETE', failReason: null, postIds: [] }, now, recent);
    expect(update.status).toBe('published');
    expect(update).not.toHaveProperty('platformPostId');
  });

  it('records the fail_reason', () => {
    expect(
      tiktokPostUpdate({ status: 'FAILED', failReason: 'duration_check', postIds: [] }, now, recent),
    ).toMatchObject({ status: 'failed', failureReason: 'TikTok could not publish the post (duration_check)' });
  });

  it('leaves a post processing while TikTok is still working', () => {
    expect(
      tiktokPostUpdate({ status: 'PROCESSING_UPLOAD', failReason: null, postIds: [] }, now, recent),
    ).not.toHaveProperty('status');
  });

  it('gives up on a post stuck processing for over two hours', () => {
    const old = new Date('2026-10-02T09:00:00Z');
    expect(
      tiktokPostUpdate({ status: 'PROCESSING_DOWNLOAD', failReason: null, postIds: [] }, now, old).status,
    ).toBe('failed');
  });
});
