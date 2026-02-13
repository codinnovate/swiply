import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { InstagramAdapter } from './adapters/instagram.adapter';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { TwitterAdapter } from './adapters/twitter.adapter';
import type { PlatformAdapter } from './platform-adapter.interface';

const config = { get: () => undefined } as unknown as ConfigService;

const tiktok: PlatformAdapter = new TikTokAdapter(new HttpService(), config);
const instagram: PlatformAdapter = new InstagramAdapter(new HttpService(), config);
const twitter: PlatformAdapter = new TwitterAdapter(new HttpService(), config);

describe('validateContent (Section 6)', () => {
  it('rejects a post on TikTok, which has no such post type', () => {
    // The example the spec calls out by name.
    const result = tiktok.validateContent({ type: 'post', imageCount: 1 });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/does not support single-image or text posts/);
  });

  it('accepts a TikTok slideshow inside the Photo Mode bounds', () => {
    expect(tiktok.validateContent({ type: 'slideshow', imageCount: 2 }).valid).toBe(true);
    expect(tiktok.validateContent({ type: 'slideshow', imageCount: 35 }).valid).toBe(true);
  });

  it.each([
    [1, 'below the minimum'],
    [36, 'above the maximum'],
  ])('rejects a TikTok slideshow of %i images (%s)', (imageCount) => {
    const result = tiktok.validateContent({ type: 'slideshow', imageCount });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/2-35 images/);
  });

  it('holds each platform to its own carousel ceiling', () => {
    // 10 on Instagram, 4 on X — the same content is valid on one and not the other.
    expect(instagram.validateContent({ type: 'slideshow', imageCount: 10 }).valid).toBe(true);
    expect(twitter.validateContent({ type: 'slideshow', imageCount: 10 }).valid).toBe(false);
    expect(twitter.validateContent({ type: 'slideshow', imageCount: 4 }).valid).toBe(true);
  });

  it('rejects a text-only post on Instagram but allows it on X', () => {
    expect(instagram.validateContent({ type: 'post', imageCount: 0 }).valid).toBe(false);
    expect(twitter.validateContent({ type: 'post', imageCount: 0, text: 'hello' }).valid).toBe(
      true,
    );
  });

  it('enforces the X character limit', () => {
    expect(
      twitter.validateContent({ type: 'post', imageCount: 0, text: 'a'.repeat(280) }).valid,
    ).toBe(true);

    const tooLong = twitter.validateContent({
      type: 'post',
      imageCount: 0,
      text: 'a'.repeat(281),
    });
    expect(tooLong.valid).toBe(false);
    expect(tooLong.errors[0]).toMatch(/allows 280 characters, got 281/);
  });

  it('reports every violation at once rather than the first', () => {
    // Wrong type for the platform *and* over the character limit.
    const result = twitter.validateContent({
      type: 'slideshow',
      imageCount: 9,
      text: 'a'.repeat(400),
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('accepts video on all three', () => {
    for (const adapter of [tiktok, instagram, twitter]) {
      expect(adapter.validateContent({ type: 'video', imageCount: 0 }).valid).toBe(true);
    }
  });

  it('treats missing text as empty rather than tripping the limit', () => {
    expect(twitter.validateContent({ type: 'post', imageCount: 1 }).valid).toBe(true);
    expect(twitter.validateContent({ type: 'post', imageCount: 1, text: null }).valid).toBe(true);
  });
});
