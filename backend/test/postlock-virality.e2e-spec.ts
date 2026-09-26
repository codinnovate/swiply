import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';

import { REWRITE_SYSTEM_PROMPT } from '../src/modules/virality/domain/prompts';
import { PushDevice } from '../src/modules/virality/schemas/push-device.schema';
import { VIRALITY_LLM } from '../src/modules/virality/services/llm-providers';
import { createTestApp, destroyTestApp } from './app-harness';

const ADMIN_TOKEN = 'postlock-admin-token-for-tests-0001';

/** Stands in for the model: scores longer posts higher so rankings are deterministic. */
function fakeLlm() {
  const completeJson = jest.fn(async (system: string, user: string): Promise<string> => {
    if (system === REWRITE_SYSTEM_PROMPT) return '{"variants":["Better one","Better two"]}';
    const input = JSON.parse(user) as { post_text: string };
    const hook = Math.min(25, Math.round(input.post_text.length / 5));
    const category = (score: number) => ({ score, reasoning: 'ok' });
    return JSON.stringify({
      total_score: 0,
      breakdown: {
        hook_strength: category(hook),
        reply_bait: category(input.post_text.includes('?') ? 20 : 8),
        emotional_charge: category(8),
        format_structure: category(10),
        niche_consistency: category(7),
        risk_factors: category(input.post_text.includes('https://') ? -8 : 0),
        timing: category(6),
      },
      top_strength: 'Clear point.',
      top_weakness: 'Could invite replies.',
      suggestions: ['Ask a question.', 'Tighten the hook.', 'Move the link.'],
    });
  });
  return { provider: 'openai' as const, model: 'fake-model', completeJson };
}

describe('POSTLOCK virality scoring & leaderboard (e2e)', () => {
  let app: INestApplication<App>;
  const llm = fakeLlm();

  beforeAll(async () => {
    process.env.X_DATA_PROVIDER = 'development';
    process.env.POSTLOCK_ADMIN_TOKEN = ADMIN_TOKEN;
    process.env.POSTLOCK_JOBS_ENABLED = 'false';
    app = await createTestApp((builder) => builder.overrideProvider(VIRALITY_LLM).useValue(llm));
  });

  afterAll(async () => {
    await destroyTestApp(app);
    delete process.env.X_DATA_PROVIDER;
    delete process.env.POSTLOCK_ADMIN_TOKEN;
    delete process.env.POSTLOCK_JOBS_ENABLED;
  });

  const server = () => app.getHttpServer();

  async function waitForScores(username: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await request(server()).get('/api/v1/postlock/history').query({ username });
      if (!response.body.isScoring) return response;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Scoring for @${username} never finished`);
  }

  it('syncs a history, scores it in the background, and serves rewrites', async () => {
    const sync = await request(server())
      .post('/api/v1/postlock/history/sync')
      .send({ username: '@Sam_Dev', timezone: 'Europe/London', niche: 'indie SaaS' })
      .expect(201);
    expect(sync.body).toMatchObject({ username: 'sam_dev', scoringAvailable: true });
    expect(sync.body.posts).toHaveLength(4);

    const history = await waitForScores('sam_dev');
    type ScoredPostBody = {
      postId: string;
      scoreStatus: string;
      linkLocation: string;
      hashtagCount: number;
      score: { total_score: number; breakdown: Record<string, { score: number }> };
    };
    const posts = history.body.posts as ScoredPostBody[];
    expect(posts.every((post) => post.scoreStatus === 'scored')).toBe(true);
    const linkPost = posts.find((post) => post.linkLocation === 'main_post')!;
    expect(linkPost.hashtagCount).toBe(3);
    expect(linkPost.score.breakdown.risk_factors.score).toBe(-8);
    const sum = Object.values(linkPost.score.breakdown).reduce(
      (total, category) => total + category.score,
      0,
    );
    expect(linkPost.score.total_score).toBe(sum);
    expect(history.body.insights).toMatchObject({ status: 'needs_more_posts', scoredPostCount: 4 });

    // Scores are cached: a second sync doesn't re-score unchanged posts.
    const calls = llm.completeJson.mock.calls.length;
    await request(server())
      .post('/api/v1/postlock/history/sync')
      .send({ username: 'sam_dev' })
      .expect(201);
    await waitForScores('sam_dev');
    expect(llm.completeJson.mock.calls.length).toBe(calls);

    const rewrite = await request(server())
      .post(`/api/v1/postlock/posts/${linkPost.postId}/rewrite`)
      .send({ username: 'sam_dev' })
      .expect(201);
    expect(rewrite.body.variants).toEqual(['Better one', 'Better two']);
    await request(server())
      .post(`/api/v1/postlock/posts/${linkPost.postId}/rewrite`)
      .send({ username: 'sam_dev' })
      .expect(201);
    expect(llm.completeJson.mock.calls.length).toBe(calls + 1);

    await request(server())
      .post(`/api/v1/postlock/posts/${linkPost.postId}/rewrite`)
      .send({ username: 'someone_else' })
      .expect(404);
  });

  it('ranks featured accounts and opted-in users, and honours opt-out', async () => {
    await request(server())
      .post('/api/v1/postlock/admin/featured-accounts')
      .send({ username: 'growth_guru', niche: 'Growth' })
      .expect(401);
    await request(server())
      .post('/api/v1/postlock/admin/featured-accounts')
      .set('X-Postlock-Admin-Token', ADMIN_TOKEN)
      .send({ username: 'growth_guru', niche: 'Growth' })
      .expect(201);

    const installId = '3f2b8c1e-6a4d-4e2b-9c7a-1d2e3f4a5b6c';
    await request(server())
      .put('/api/v1/postlock/leaderboard/participation')
      .send({ username: 'sam_dev', installId, optedIn: true, niche: 'indie SaaS' })
      .expect(200, { optedIn: true, niche: 'indie SaaS' });
    const claimed = await request(server())
      .put('/api/v1/postlock/leaderboard/participation')
      .send({
        username: 'sam_dev',
        installId: 'a1b2c3d4-0000-4000-8000-000000000000',
        optedIn: false,
      })
      .expect(403);
    expect(claimed.body.error.code).toBe('LEADERBOARD_USERNAME_CLAIMED');

    await request(server())
      .post('/api/v1/postlock/admin/leaderboard/refresh')
      .set('X-Postlock-Admin-Token', ADMIN_TOKEN)
      .expect(201);

    const all = await request(server())
      .get('/api/v1/postlock/leaderboard')
      .query({ username: 'sam_dev' })
      .expect(200);
    expect(all.body.entries.map((entry: { username: string }) => entry.username).sort()).toEqual([
      'growth_guru',
      'sam_dev',
    ]);
    expect(all.body.window).toEqual({ posts: 10, days: 30, minimumPosts: 3 });
    expect(all.body.niches).toEqual(['Growth', 'indie SaaS']);
    expect(all.body.me).toMatchObject({ username: 'sam_dev', category: 'user', postsCounted: 4 });

    const users = await request(server())
      .get('/api/v1/postlock/leaderboard')
      .query({ category: 'users' })
      .expect(200);
    expect(users.body.entries).toEqual([expect.objectContaining({ username: 'sam_dev', rank: 1 })]);

    await request(server())
      .put('/api/v1/postlock/leaderboard/participation')
      .send({ username: 'sam_dev', installId, optedIn: false })
      .expect(200);
    const afterOptOut = await request(server())
      .get('/api/v1/postlock/leaderboard')
      .query({ username: 'sam_dev' })
      .expect(200);
    expect(afterOptOut.body.entries.map((entry: { username: string }) => entry.username)).toEqual([
      'growth_guru',
    ]);
    expect(afterOptOut.body.me).toBeNull();
  });

  it('registers, re-points, and removes an install for duel push alerts', async () => {
    const installId = '33333333-3333-4333-8333-333333333333';
    const token = 'AB'.repeat(32);

    await request(server())
      .put('/api/v1/postlock/push/devices')
      .send({ username: '@Sam_Dev', installId, token, environment: 'sandbox' })
      .expect(200, { registered: true });
    await request(server())
      .put('/api/v1/postlock/push/devices')
      .send({ username: 'sam_dev', installId, token: 'cd'.repeat(32), environment: 'production' })
      .expect(200);

    const devices = app.get<Model<PushDevice>>(getModelToken(PushDevice.name));
    expect(await devices.find({ installId }).lean()).toEqual([
      expect.objectContaining({ username: 'sam_dev', token: 'cd'.repeat(32), environment: 'production' }),
    ]);

    await request(server())
      .delete('/api/v1/postlock/push/devices')
      .send({ installId })
      .expect(200, { registered: false });
    expect(await devices.countDocuments({ installId })).toBe(0);
  });

  it('rejects malformed push registrations', async () => {
    await request(server())
      .put('/api/v1/postlock/push/devices')
      .send({
        username: 'sam_dev',
        installId: '33333333-3333-4333-8333-333333333333',
        token: 'not-a-token',
        environment: 'sandbox',
      })
      .expect(400);
  });
});
