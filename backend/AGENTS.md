# AGENTS.md — Swiply Backend

> Base context for any AI coding agent working on the **Swiply** backend. This is the backend-only half of the spec — the frontend has its own separate AGENTS.md (AGENTS-frontend.md), which consumes the exact request/response shapes defined here. Do not merge the two docs back together; they are handed to different agents/repos. Read this in full before writing code. Defines architecture, data models, API contracts, third-party integrations, edge cases, and testing requirements. The frontend and the public Developer API are both built against these exact contracts — don't change shapes without flagging it.

---

## 0. Working Agreement (read before you touch anything)

### 0.1 Git

**Commit as you finish each task. Never push.**

- **Commit granularly.** One commit per logical unit — a schema, a service, a controller, a guard, a test suite. Not one commit per build step, and not one commit per file for files that only make sense together (a controller and its module, a schema and its indexes).
- **Commit when a task is done**, not at the end of a session. If a build step from Section 15 produces twelve logical units, that is twelve commits.
- **Never `git push`.** Not to any remote, not with any flag. Pushing is the human's call, always. The same goes for opening PRs, creating remotes, or anything else that moves code off this machine.
- **Never force-push, rebase published history, amend someone else's commit, or `git reset --hard`** over work you didn't create.
- **Don't commit secrets.** `.env` is gitignored; keep it that way. `.env.example` carries names and format hints only, never values.
- **Commit message format** — Conventional Commits, scoped to the module:
  ```
  feat(workspaces): add WorkspaceMember schema with partial unique indexes
  fix(auth): return identical error for wrong password and unknown email
  test(scheduling): cover minGapMinutes under volume distribution
  chore(deps): add bullmq for the publish worker
  docs: record the platform rate limits confirmed on 2026-08-25
  ```
  Types in use: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`.
- **Order commits so history stays bisectable.** Dependencies land before their dependents — schemas before the services that read them, services before the controllers that call them.
- **Verify before committing a task boundary.** `npm run build`, `npm test`, and `npm run lint` must all pass at the end of each Section 15 build step. Intermediate commits within a step are ordered by dependency but are not individually built.

### 0.2 Reporting

State what actually happened. If tests fail, say so and show the output. If a build step was left partly done, say which part and why. Don't report a step complete until it is.

### 0.3 Spec changes

The frontend and the public Developer API are built against the contracts in this document. If implementation forces a shape change, flag it explicitly in your report rather than quietly changing it here — the change has to reach the frontend agent too.

---

## 1. Product Summary

**Swiply** is an AI social media manager. A user connects their social accounts, and Swiply learns how they write, then generates and publishes content **and replies** in that voice — on autopilot, on a schedule the user barely has to think about.

Core capabilities:
1. Connect social accounts (TikTok, Instagram, Facebook, Pinterest, X/Twitter, LinkedIn).
2. **Learn the user's voice** — ingest their recent posts/tweets, derive a style profile, combine it with an optional user-set tone (e.g. "witty," "no emojis," "always end with a question").
3. **Generate three content types**: slideshows (multi-image carousels), videos, and normal posts (single image/text).
4. **Schedule at volume, not just cadence** — e.g. "post 200 times this month," with timing randomized across allowed windows rather than fixed slots, so posting doesn't look robotic and doesn't trip platform spam detection.
5. **Run autonomously** — once configured, Swiply keeps generating and publishing indefinitely without the user manually approving each post ("autopilot"), with an easy pause/kill switch and a full audit trail of everything it did.
6. **Auto-reply** — Swiply can monitor mentions/comments/replies on a connected account and respond in the user's voice, without the user doing it, subject to safety guardrails (Section 11).
7. Expose all of the above via a **public Developer API** so third-party apps can build on Swiply.

This document is the backend spec. A follow-up prompt covers the frontend and will consume the exact request/response shapes defined here.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **NestJS** | Modular architecture — one module per domain (Section 3). REST controllers, no GraphQL unless requested later |
| Language | TypeScript (strict) | No `any` without a comment justifying it |
| Database | MongoDB (Atlas) via **`@nestjs/mongoose`** | Schemas defined with `@Schema()`/`@Prop()` decorators, Section 4 |
| Auth (dashboard) | **Passport.js via `@nestjs/passport`** — local strategy (email/password) + Google OAuth strategy, sessions issued as JWT (`@nestjs/jwt`) | Guards (`AuthGuard`) protect routes, not middleware |
| Auth (developer API) | Custom `ApiKeyGuard` | Section 8 |
| Background jobs & scheduling | **BullMQ via `@nestjs/bullmq`**, Redis-backed, plus **`@nestjs/schedule`** (`@Cron()`) for the recurring triggers that enqueue jobs | NestJS is a long-running process, not serverless — no need for a managed durable-execution platform (Inngest/Trigger.dev) purely to work around short-lived functions the way a Vercel-hosted Next.js app would. BullMQ + a persistent worker process is the idiomatic, simpler choice here |
| Object storage | Cloudinary (preferred) or AWS S3 + CloudFront | Images and rendered video files |
| AI text generation | Anthropic Claude API (`claude-sonnet-4-6`) | Copy, captions, hashtags, replies, voice analysis |
| AI image generation | Pluggable `ImageProvider` interface | Default: Replicate-hosted SDXL/Ideogram, or OpenAI images |
| Video generation | Pluggable `VideoProvider` interface | Recommend **templated assembly** as the v1 default (Claude-written script + generated/stock images + TTS voiceover + captions, assembled via Remotion or Shotstack API) rather than pure text-to-video — cheaper, faster, more controllable. Leave room to swap in a text-to-video model (Runway/Luma/Kling) later. |
| Text-to-speech (for video voiceover) | ElevenLabs or OpenAI TTS | Only needed if templated video assembly is used |
| Sentiment / moderation check | Claude (lightweight classification call) | Used to gate auto-replies, see Section 11 |
| Payments | Stripe | Subscriptions + usage-based add-ons |
| Email | Resend or Postmark | Automation summaries, failure alerts, weekly digest of what Swiply posted |
| Rate limiting | `@nestjs/throttler`, Redis-backed store for multi-instance consistency | Public Developer API |
| Validation | `class-validator` + `class-transformer`, one DTO class per route input | NestJS's native validation pipe (`ValidationPipe`) rejects unknown/malformed fields globally — Section 5 |
| API docs | `@nestjs/swagger` | Auto-generated OpenAPI spec from the same DTOs/decorators — useful both for the dashboard frontend and for public Developer API documentation |
| Testing | Jest (Nest's default) + Supertest via `@nestjs/testing`, Playwright for cross-service E2E, MSW/nock for external API mocking | Section 14 |

---

## 3. High-Level Architecture

Standard NestJS modular layout — one module per domain, each with its own controller, service, DTOs, and Mongoose schema. Public Developer API routes live in their own controller per resource (e.g. `content/public-content.controller.ts` alongside `content/content.controller.ts`) so the internal/public split is explicit in the file tree, not just in a route prefix.

```
/src
  main.ts
  app.module.ts
  /common
    /guards
      api-key.guard.ts          <- public Developer API auth
      workspace.guard.ts        <- enforces workspace-scoped access on every request
    /pipes
      validation.pipe.ts        <- global ValidationPipe config (whitelist/forbidNonWhitelisted)
    /interceptors
      idempotency.interceptor.ts
    /filters
      http-exception.filter.ts  <- shapes every error into the { error: { code, message, details } } contract (Section 5)
  /modules
    /auth                       <- Passport strategies, JWT issuance, session guards
    /workspaces
    /social-accounts
    /voice-profiles
      voice-profiles.controller.ts
      voice-profiles.service.ts
      voice-analysis.service.ts <- derives VoiceProfile from SourcePost samples
      schemas/
    /media                      <- MediaAsset + upload handling
    /content                    <- generation + CRUD for slideshow/video/post
      content.controller.ts
      public-content.controller.ts
      content.service.ts
      schemas/
    /schedules
      schedules.service.ts
      distribution.service.ts   <- volume + randomized-timing distribution algorithm, pure/unit-testable
    /posts
    /engagement                 <- auto-reply rules + inbound interactions
    /automation                 <- pause/resume, audit log
    /billing
    /webhooks                   <- both inbound (Stripe, Meta comment webhooks) and outbound delivery/retry
  /ai
    text.service.ts             <- Claude wrapper for copy/captions/replies
    image.service.ts            <- ImageProvider interface + implementations
    video.service.ts            <- VideoProvider interface + implementations
    moderation.service.ts       <- pre-publish safety check for autonomous replies
  /platforms                    <- one adapter per social platform (Section 6), injected as providers
  /jobs                         <- BullMQ processors + @Cron() triggers
    publish-post.processor.ts
    generate-content-batch.processor.ts
    ingest-voice-samples.processor.ts
    poll-mentions.processor.ts
    process-inbound-interaction.processor.ts
    refresh-tokens.processor.ts
/test                           <- e2e specs, one per module, using @nestjs/testing
```

**Rule:** internal dashboard controllers and public Developer API controllers call the same module `*.service.ts` methods. Only the guard (`@nestjs/passport` session vs. `ApiKeyGuard`) and the DTO/response shaping differ — never duplicate business logic between the two controllers.

---

## 4. Database Schema (MongoDB / Mongoose)

### 4.1 `User`
```ts
{
  _id: ObjectId,
  email: string,
  passwordHash: string | null,
  name: string,
  avatarUrl: string | null,
  emailVerified: boolean,
  defaultWorkspaceId: ObjectId,
  googleId: string | null,      // set when the account is linked to Google sign-in
  createdAt: Date,
  updatedAt: Date
}
```

### 4.2 `Workspace`
```ts
{
  _id: ObjectId,
  name: string,
  ownerId: ObjectId,
  planId: 'free' | 'starter' | 'pro' | 'agency',
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  timezone: string,          // IANA tz — all schedule/window math resolves through this
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 `WorkspaceMember`
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  userId: ObjectId,
  role: 'owner' | 'admin' | 'editor' | 'viewer',
  invitedEmail: string | null,
  status: 'active' | 'pending',
  createdAt: Date
}
```

### 4.4 `SocialAccount`
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  platform: 'tiktok' | 'instagram' | 'facebook' | 'pinterest' | 'twitter' | 'linkedin',
  platformAccountId: string,
  displayName: string,
  avatarUrl: string | null,
  accessToken: string,          // ENCRYPTED (Section 12)
  refreshToken: string | null,  // ENCRYPTED
  tokenExpiresAt: Date | null,
  scopes: string[],
  status: 'active' | 'expired' | 'revoked' | 'error',
  lastError: string | null,
  voiceProfileId: ObjectId | null,
  connectedByUserId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```
Connecting an account triggers `ingest-voice-samples` automatically (can be declined by the user during the connect flow — see Section 7 consent note).

### 4.5 `VoiceProfile`
The learned + user-set writing style for an account (or a workspace-wide default, used when an account has no samples yet — e.g. a brand-new TikTok with nothing posted).
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  socialAccountId: ObjectId | null,   // null = workspace-level default voice
  userSetTone: string[],              // manual descriptors, e.g. ["witty", "concise", "no emojis"]
  styleSummary: string,               // AI-generated paragraph describing the voice
  styleAttributes: {
    avgSentenceLength: number,
    emojiUsage: 'none' | 'light' | 'heavy',
    hashtagUsage: 'none' | 'light' | 'heavy',
    commonTopics: string[],
    formattingNotes: string,          // e.g. "short punchy lines, frequent line breaks"
  },
  fewShotExampleIds: ObjectId[],      // curated best SourcePost samples used verbatim as few-shot examples
  sampleCount: number,
  lastAnalyzedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 4.6 `SourcePost`
Raw historical posts ingested from a connected account, used to build the `VoiceProfile`. Kept separate from `VoiceProfile` since sample sets can be large and get refreshed.
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  socialAccountId: ObjectId,
  platform: string,
  platformPostId: string,
  text: string,
  postedAt: Date,             // when the user originally posted it
  engagementScore: number | null,   // likes+comments+shares if available, used to pick few-shot examples
  fetchedAt: Date
}
```
Cap at ~200 most recent samples per account; refresh on a schedule (e.g. monthly) or on manual "re-learn my voice" trigger.

### 4.7 `Content` (the generated unit — replaces the earlier "Slideshow-only" model)
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  createdByUserId: ObjectId | null,     // null if created by autopilot or via API key
  type: 'slideshow' | 'video' | 'post',
  goal: 'conversions' | 'awareness' | 'engagement' | 'traffic' | 'lead_gen' | 'community' | 'announcement' | null,
  imageSource: 'user_provided' | 'ai_generated' | null,   // how the background/post images were sourced — null for text-only posts
  postCaption: string,
  hashtags: string[],

  // type-specific payload — exactly one of these three is populated based on `type`
  slideshow: {
    slides: [{ order: number, imageUrl: string, caption: string | null, altText: string | null, imageSource: 'user_provided' | 'ai_generated' }]
  } | null,
  video: {
    status: 'generating' | 'ready' | 'failed',
    script: string | null,
    videoUrl: string | null,
    thumbnailUrl: string | null,
    durationSeconds: number | null,
    provider: string               // which VideoProvider generated it
  } | null,
  post: {
    imageUrls: string[],           // 0–1 image typically; empty array = text-only post
    text: string
  } | null,

  generationSource: 'ai' | 'manual' | 'api',
  aiPrompt: string | null,
  voiceProfileId: ObjectId | null,     // which voice profile conditioned generation, if AI-generated
  status: 'draft' | 'ready' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'archived',
  createdAt: Date,
  updatedAt: Date
}
```
Video generation is asynchronous (can take minutes). Content with `type: 'video'` starts as `video.status: 'generating'`; nothing can schedule/publish it until `video.status: 'ready'`. The batch generation job (Section 9) accounts for this lead time.

`goal` is required whenever `generationSource: 'ai'` — it's not just metadata, it changes what the AI writes (Section 10.5). It's optional/nullable for manually-authored content, though the UI should still offer it for analytics/reporting even then. `imageSource` is set once at generation time (`user_provided` means the caller supplied `providedImageUrls`, resolved either from a fresh upload or the `MediaAsset` library at Section 4.8; `ai_generated` means the `ImageProvider` pipeline created them) — individual slides can be swapped afterward via `PATCH /api/content/:id`, so a slideshow can end up mixed even if it started as one or the other.

### 4.8 `MediaAsset`
The user's uploaded image/video library. Exists for two reasons: (1) it's what backs "provide your own images" during manual content creation, and (2) it's what makes "provide your own images" *possible at all* under autopilot — when nobody's picking a file per post, autopilot draws from this pool instead.
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  url: string,
  type: 'image' | 'video',
  tags: string[],                    // optional, user- or AI-assigned (e.g. "product-shot", "lifestyle", "logo")
  width: number | null,
  height: number | null,
  uploadedByUserId: ObjectId,
  usedCount: number,                 // incremented each time it's selected for a Content item, used to bias toward least-recently-used
  lastUsedAt: Date | null,
  createdAt: Date
}
```

### 4.9 `Schedule`
Supports two scheduling modes: the original fixed-cadence mode, and a **volume mode** for "N posts a month, randomized."
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  name: string,
  socialAccountIds: ObjectId[],
  contentTypeMix: {                    // what proportion of generated content should be each type
    slideshow: number,                 // e.g. 0.5
    video: number,                     // e.g. 0.2
    post: number                       // e.g. 0.3   (must sum to 1)
  },
  mode: 'fixed_days' | 'volume',
  fixedDays: {                          // used when mode === 'fixed_days'
    postsPerWeek: number,
    daysOfWeek: number[],               // 0=Sun..6=Sat
    timeOfDay: string                   // "09:00"
  } | null,
  volume: {                             // used when mode === 'volume'
    postsPerMonth: number,              // e.g. 200
    postingWindows: [{ startHour: number, endHour: number }],  // e.g. [{7,10},{12,14},{18,23}], in workspace timezone
    minGapMinutes: number,              // floor between two posts on the same account
    jitterMinutes: number               // randomization applied around each computed slot
  } | null,
  endDate: Date | null,                 // null = runs indefinitely ("keep posting for me")
  contentSource: 'ai_autogenerate' | 'content_bank' | 'manual_queue',
  autoGeneratePrompt: string | null,    // topic/brand seed for AI generation
  defaultGoal: 'conversions' | 'awareness' | 'engagement' | 'traffic' | 'lead_gen' | 'community' | 'announcement',
  defaultImageSource: 'user_provided' | 'ai_generated',   // applied to every auto-generated Content item; 'user_provided' pulls from MediaAsset (Section 4.8), not a per-post prompt — see 9.1
  autopilot: boolean,                   // true = publish without human approval step
  status: 'active' | 'paused' | 'completed',
  createdAt: Date,
  updatedAt: Date
}
```

### 4.10 `Post`
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  contentId: ObjectId,                  // renamed from slideshowId
  scheduleId: ObjectId | null,
  socialAccountId: ObjectId,
  platform: string,
  scheduledFor: Date,                   // UTC, computed by the distribution algorithm (Section 9)
  status: 'queued' | 'pending_review' | 'processing' | 'published' | 'failed' | 'canceled',
  attempts: number,
  lastAttemptAt: Date | null,
  publishedAt: Date | null,
  platformPostId: string | null,
  platformPostUrl: string | null,
  failureReason: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

### 4.11 `EngagementRule`
Turns on auto-replying for an account.
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  socialAccountId: ObjectId,
  enabled: boolean,
  scope: ('mentions' | 'comments_on_own_posts')[],
  mode: 'auto_publish' | 'review_queue',
  filters: {
    excludeKeywords: string[],
    skipNegativeSentiment: boolean,      // route to review queue instead of auto-replying
    skipLikelyBots: boolean,
    onlyFromFollowers: boolean
  },
  maxRepliesPerDay: number,              // hard safety cap regardless of mode
  createdAt: Date,
  updatedAt: Date
}
```

### 4.12 `InboundInteraction`
A mention/comment Swiply saw and (maybe) replied to.
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  socialAccountId: ObjectId,
  platform: string,
  platformInteractionId: string,
  type: 'mention' | 'comment',
  authorHandle: string,
  authorPlatformId: string,
  text: string,
  url: string,
  sentiment: 'positive' | 'neutral' | 'negative' | null,
  status: 'new' | 'reply_generated' | 'pending_review' | 'replied' | 'skipped' | 'flagged',
  generatedReplyText: string | null,
  skipReason: string | null,             // why it was skipped/flagged, for transparency
  repliedPlatformPostId: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

### 4.13 `AutomationAuditLog`
Every autonomous action Swiply takes, independent of the more granular `Post`/`InboundInteraction` records — this is the human-readable "what did my AI do" feed shown in the dashboard.
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  socialAccountId: ObjectId,
  action: 'content_published' | 'reply_sent' | 'reply_skipped' | 'schedule_paused_auto' | 'account_reauth_needed',
  refId: ObjectId,                       // Post._id or InboundInteraction._id
  summary: string,                       // human-readable one-liner
  createdAt: Date
}
```

### 4.14 `ApiKey`
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  name: string,
  keyPrefix: string,
  keyHash: string,
  scopes: string[],
  lastUsedAt: Date | null,
  revokedAt: Date | null,
  createdByUserId: ObjectId,
  createdAt: Date
}
```

### 4.15 `Webhook`
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  url: string,
  secret: string,
  events: string[],
  status: 'active' | 'disabled',
  createdAt: Date
}
```

### 4.16 `WebhookDelivery`
```ts
{
  _id: ObjectId,
  webhookId: ObjectId,
  event: string,
  payload: object,
  responseStatus: number | null,
  attempts: number,
  status: 'pending' | 'delivered' | 'failed',
  nextRetryAt: Date | null,
  createdAt: Date
}
```

### 4.17 `UsageLog`
```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  type: 'ai_generation' | 'video_generation' | 'post_published' | 'reply_published' | 'api_call',
  quantity: number,
  createdAt: Date
}
```

### 4.18 Indexes
- `User.email` unique
- `SocialAccount.{workspaceId, platform, platformAccountId}` unique compound
- `Post.{status, scheduledFor}` compound — publish worker polls this
- `SourcePost.{socialAccountId, platformPostId}` unique compound
- `MediaAsset.{workspaceId, type, lastUsedAt}` compound — the autopilot picker queries this for "least-recently-used, right type" selection
- `InboundInteraction.{socialAccountId, platformInteractionId}` unique compound — prevents double-processing the same mention
- `ApiKey.keyHash` unique
- `WorkspaceMember.{workspaceId, userId}` unique compound — **partial**, on documents where `userId` is set, so multiple `pending` invites (which have a null `userId`) can coexist in one workspace. Paired with a partial unique index on `{workspaceId, invitedEmail}`, which is what actually prevents inviting the same address twice.

---

## 5. Naming Conventions

- Resources are plural nouns: `/content`, `/posts`, `/schedules`, `/engagement-rules`.
- Internal API: `/api/{resource}`, session-authenticated.
- Public Developer API: `/api/public/v1/{resource}`, API-key authenticated.
- Actions are verb sub-paths: `POST /api/posts/{id}/cancel`, `POST /api/schedules/{id}/pause`.
- List endpoints: cursor pagination (`?limit=&cursor=`), not offset.
- Timestamps: ISO 8601 UTC.
- Successful responses wrap the payload: `{ "data": ... }`.
- Errors:
```json
{ "error": { "code": "REPLY_RATE_CAP_EXCEEDED", "message": "Human-readable explanation", "details": {} } }
```

---

## 6. Platform Integrations

Adapter interface, covering reply/mention support and content-type support:

```ts
interface PlatformAdapter {
  getOAuthUrl(workspaceId: string, redirectUri: string): string;
  handleOAuthCallback(code: string): Promise<{ accessToken, refreshToken, expiresAt, accountId, displayName }>;
  refreshAccessToken(account: SocialAccount): Promise<{ accessToken, expiresAt }>;
  fetchRecentPosts(account: SocialAccount, limit: number): Promise<SourcePostInput[]>;   // for voice ingestion
  publishContent(account: SocialAccount, content: Content): Promise<{ platformPostId, platformPostUrl }>;
  validateContent(content: Content): { valid: boolean; errors: string[] };
  fetchMentions(account: SocialAccount, since: Date): Promise<InboundInteractionInput[]>;  // only if supportsReplies
  publishReply(account: SocialAccount, interaction: InboundInteraction, text: string): Promise<{ platformPostId }>;
}
```

| Platform | API | Slideshow | Video | Post (single img/text) | Mentions/replies | Notes |
|---|---|---|---|---|---|---|
| **TikTok** | Content Posting API | Yes, Photo Mode, 2–35 imgs | Yes, native | No (not a supported post type) | Comments API is limited; no reliable mentions feed | Public "Direct Post" requires app audit; unaudited apps limited to the developer's own sandboxed account |
| **Instagram** | Instagram Graph API (via Facebook Graph API) | Yes, carousel container, 2–10 imgs | Yes, Reels | Yes | Comments via Graph API + webhook subscription | Requires IG Business/Creator linked to a FB Page. Graph API content-publishing has a documented per-account posting cap in a rolling 24h window — confirm the current number at implementation time and enforce it in the volume distributor (Section 9) |
| **Facebook** | Facebook Graph API | Yes, multi-photo | Yes | Yes | Comments via Graph API + webhook subscription | Page access token required |
| **Pinterest** | Pinterest API v5 | Yes, native carousel pin, up to 5 imgs | Yes, video pins | Yes, single-image pin | No meaningful reply/mention surface | Board ID required per pin |
| **X (Twitter)** | X API v2 | Partial — up to 4 images, not a true carousel UX | Yes | Yes | Yes — mentions timeline + reply endpoint | **Mentions/reply access requires a paid API tier**; the free tier does not reliably support pulling the mentions timeline. Flag this to the user during setup, don't assume it's available |
| **LinkedIn** | LinkedIn Marketing API | Yes, multi-image share | Yes | Yes | Comments API exists but is more restricted; treat as best-effort | Requires `w_member_social` or org posting scopes |

`validateContent()` must reject unsupported type/platform combinations before anything is uploaded (e.g. a `post` with no image submitted to TikTok).

---

## 7. Internal Dashboard API (session auth)

### Auth & Workspace
`/api/auth/*`, `/api/workspaces`, `/api/workspaces/:workspaceId/members`

### Social Accounts
- `GET /api/social-accounts`
- `GET /api/social-accounts/connect/:platform`
- `GET /api/social-accounts/callback/:platform` — on success, prompts the user: "Let Swiply learn your voice from your last posts?" (explicit consent, not silently on-by-default) → if accepted, enqueues `ingest-voice-samples`
- `DELETE /api/social-accounts/:id`

### Voice Profiles
- `GET /api/voice-profiles/:socialAccountId`
- `POST /api/voice-profiles/:socialAccountId/relearn` — re-fetches recent posts and regenerates the style profile
- `PATCH /api/voice-profiles/:socialAccountId` — edit `userSetTone` manually
- `GET /api/voice-profiles/:socialAccountId/source-posts` — lets the user see/delete exactly what was ingested (transparency + GDPR-style control)
- `DELETE /api/voice-profiles/:socialAccountId/source-posts/:id`

### Media Library
- `POST /api/media/upload` — accepts a direct upload (or returns a presigned URL to upload to, then a confirm call); stores the file in Cloudinary/S3 and creates a `MediaAsset`. Response: `{ data: MediaAsset }`.
- `GET /api/media?type=&tag=&limit=&cursor=` — browse the library (used both by the manual "pick your own image" picker and to preview what autopilot has to draw from)
- `DELETE /api/media/:id`

### Content
This is the actual creation flow the frontend drives the user through: **pick a type → (if slideshow/post/video) choose who supplies the images → pick a goal → generate.**

- `POST /api/content/generate`
  - Body:
    ```json
    {
      "type": "slideshow",
      "topic": "string",
      "goal": "conversions",
      "socialAccountId": "string (optional)",
      "voiceProfileId": "string (optional)",
      "slideCount": 7,
      "imageSource": "user_provided",
      "providedImageUrls": ["url1", "url2", "..."]
    }
    ```
  - `goal` is required. One of `conversions | awareness | engagement | traffic | lead_gen | community | announcement` — see Section 10.5 for how each one changes what gets written.
  - `imageSource` is required whenever the type produces visual content (`slideshow`, `post` with an image, `video`'s background stills):
    - `"ai_generated"` — `providedImageUrls` must be omitted. The `ImageProvider` pipeline generates one image per slide from the slide's own text/topic.
    - `"user_provided"` — `providedImageUrls` is required, sourced from prior `POST /api/media/upload` calls (or existing `MediaAsset` URLs). For `slideshow`, length must equal `slideCount`, in order; mismatch returns `422 IMAGE_COUNT_MISMATCH`. For `post`, exactly one URL.
  - Runs the AI pipeline conditioned on the resolved voice profile (account-level, falling back to workspace default) and the selected `goal`. For `type: 'video'`, returns immediately with `video.status: 'generating'`; poll `GET /api/content/:id` or listen for `content.video_ready`.
  - Response: `{ data: Content }`
- `GET /api/content?type=&status=&goal=&limit=&cursor=`
- `GET /api/content/:id`
- `POST /api/content` — manual creation (same body shape, `generationSource: 'manual'`, `goal` optional)
- `PATCH /api/content/:id` — includes swapping individual `slides[].imageUrl`, e.g. to replace one AI-generated slide with an uploaded photo after the fact
- `DELETE /api/content/:id`
- `POST /api/content/:id/duplicate`

### Schedules
- `GET /api/schedules`
- `POST /api/schedules` — body matches Section 4.9; if `mode: 'volume'`, server validates `postsPerMonth` against each target platform's known rate limits and, if it exceeds them, returns `422 VOLUME_EXCEEDS_PLATFORM_LIMIT` with the max feasible number in `details` rather than silently capping it.
- `PATCH /api/schedules/:id` (edit / change mix / change volume)
- `POST /api/schedules/:id/pause`
- `POST /api/schedules/:id/resume`
- `DELETE /api/schedules/:id`

### Posts
- `GET /api/posts?status=&from=&to=&socialAccountId=`
- `GET /api/posts/:id`
- `POST /api/posts`
- `PATCH /api/posts/:id`
- `POST /api/posts/:id/cancel`
- `POST /api/posts/:id/retry`
- `POST /api/posts/:id/publish-now`

### Engagement (auto-reply)
- `GET /api/engagement/rules`
- `POST /api/engagement/rules`
- `PATCH /api/engagement/rules/:id`
- `POST /api/engagement/rules/:id/pause`
- `GET /api/engagement/interactions?status=&socialAccountId=` — includes items sitting in `pending_review`
- `POST /api/engagement/interactions/:id/approve` — publishes the generated reply as-is
- `PATCH /api/engagement/interactions/:id` — edit the generated reply text before approving
- `POST /api/engagement/interactions/:id/skip`

### Automation (transparency & control)
- `GET /api/automation/audit-log?socialAccountId=&from=&to=`
- `POST /api/automation/pause-all` — one-button kill switch: pauses every active `Schedule` and `EngagementRule` for a workspace
- `GET /api/automation/status` — quick summary: what's active, what's paused, what needs re-auth

### Billing & Developer settings
`/api/billing/*`, `/api/webhooks/stripe`, `/api/dev/api-keys`, `/api/dev/webhooks`

---

## 8. Public Developer API (`/api/public/v1/*`)

`Authorization: Bearer swp_live_xxxxxxxxxxxx` / `swp_test_...`, scoped by `ApiKey`, rate-limited per plan, idempotency keys on mutating routes, `X-RateLimit-*` headers.

### Scopes
`voice:read`, `voice:write`, `media:read`, `media:write`, `content:write`, `content:read`, `schedules:write`, `schedules:read`, `posts:write`, `posts:read`, `engagement:write`, `engagement:read`, `webhooks:write`

### Endpoints
- `GET /api/public/v1/voice-profiles/:socialAccountId`
- `POST /api/public/v1/media/upload`, `GET /api/public/v1/media` — same shapes as internal
- `POST /api/public/v1/content/generate` — same body shape as the internal route, including required `goal` and `imageSource`/`providedImageUrls`
- `GET|POST|PATCH|DELETE /api/public/v1/content`, `/schedules`, `/posts` — same shapes as internal, `contentId` naming
- `GET|POST|PATCH /api/public/v1/engagement/rules`
- `GET /api/public/v1/engagement/interactions`
- `POST /api/public/v1/engagement/interactions/:id/approve`
- `POST /api/public/v1/automation/pause-all`

### Outbound webhook events
- `content.video_ready` — `{ contentId }`
- `content.video_failed` — `{ contentId, reason }`
- `post.published` / `post.failed`
- `reply.published` — `{ interactionId, socialAccountId, platform, replyText }`
- `reply.flagged_for_review` — `{ interactionId, reason }`
- `account.disconnected`
- `automation.paused` — `{ socialAccountId, reason: 'user' | 'auth_error' | 'safety_cap' }`

---

## 9. Scheduling & Publishing Engine

### 9.1 Content batch generation (both modes)
The `generate-content-batch` job (BullMQ processor, triggered daily by an `@Cron()` job that enqueues one task per active `Schedule`) runs with enough lead time that video content (slow) is ready before its slot:

1. Determine how many `Content` items are needed for the upcoming lead window (recommend generating ~5–7 days ahead for `volume` mode with video in the mix, ~3 days ahead for text/image-only mixes).
2. Split that count across `contentTypeMix` ratios, rounding sensibly (don't always round the same type down — alternate rounding direction so ratios hold over time).
3. For each item, call the generation pipeline with the resolved `VoiceProfile` for the target account (fall back to workspace default if the account has no profile yet), `Schedule.defaultGoal`, and `Schedule.defaultImageSource`.
   - If `defaultImageSource: 'ai_generated'`, the `ImageProvider` generates fresh images per item — no extra input needed.
   - If `defaultImageSource: 'user_provided'`, there's no human present to hand-pick a file, so the job pulls from the workspace's `MediaAsset` library instead: query least-recently-used assets (Section 4.18 index) matching the content's tags where possible, otherwise random selection, and increment `usedCount`/`lastUsedAt` on what it takes. **If the library doesn't have enough unused/fresh assets to cover the batch**, don't silently fall back to AI generation (that violates what the user asked for) — generate what the pool supports, leave the remainder of the batch as `Content.status: 'draft'` with images unset, and notify the user to upload more (email + `automation.paused`-style dashboard flag, though the schedule itself keeps running for the items it *could* fulfill).
4. Create `Content` docs (`status: 'ready'`, or `'draft'` and left in an approval queue if `autopilot: false`).
5. Hand off to the distribution algorithm (9.2) to compute `scheduledFor` times and create `Post` docs.
6. Emit `schedule.batch_generated`.

### 9.2 Distribution algorithm (`schedules/distribution.service.ts`)
Used by `mode: 'volume'` schedules — this is the "200 times a month, randomized" logic.

1. Given `postsPerMonth`, `postingWindows`, `minGapMinutes`, `jitterMinutes`, and the days remaining in the current billing/calendar cycle, compute a target-per-day baseline (`postsPerMonth / daysInMonth`).
2. Don't distribute uniformly — apply randomized variance per day (e.g. ±40% of baseline, clamped to ≥0) so posting cadence looks organic rather than mechanical, while the *monthly total* still converges on the target (track a running remainder and bias later days to correct drift, don't just let error accumulate).
3. Within each day, pick times inside `postingWindows` only, spaced at least `minGapMinutes` apart, each with `±jitterMinutes` randomness applied.
4. **Validate against platform limits before finalizing**: if the requested daily count for a platform would exceed that platform's known safe/documented posting rate, cap it and redistribute the overflow to other days (extending the month if needed) rather than silently dropping posts — surface this as a warning in the schedule's status, not a silent behavior change.
5. Output a list of `{ contentId, socialAccountId, scheduledFor }` used to create `Post` docs.

This function must be pure/unit-testable — no DB or network calls inside it. Feed it plain data in, get a plain schedule out, then a thin wrapper persists the result.

### 9.3 Publish Worker
Lock (`processing`) → refresh token if near expiry → `publishContent()` → success updates `Post` + emits `post.published` → failure classified into auth/rate-limit/validation/unknown, each handled differently.

### 9.4 Token Refresh Sweep
Hourly.

---

## 10. Voice Profile Engine

### 10.1 Ingestion (`ingest-voice-samples` job)
Triggered on account connect (with consent) or manual "relearn." Calls `adapter.fetchRecentPosts()`, upserts into `SourcePost` (capped at ~200 most recent), then calls `analyzeVoice()`.

### 10.2 Analysis (`analyzeVoice()` in `voice-profiles/voice-analysis.service.ts`)
Sends a batch of `SourcePost.text` to Claude with a structured prompt asking for:
- `styleSummary` (freeform paragraph)
- `styleAttributes` (structured: sentence length, emoji/hashtag usage, common topics, formatting quirks)
- A recommended set of `fewShotExampleIds` — the samples most representative of the voice (weight by `engagementScore` where available, so Swiply learns from what actually performed, not just what was posted)

### 10.3 Using the profile in generation
Every AI generation call (content, reply) builds its system/context prompt from: `userSetTone` (explicit user instruction, highest priority) + `styleSummary` + 2–4 literal `fewShotExample` snippets. If no profile exists yet (brand-new account, ingestion declined), fall back to the workspace-level default profile, and if none exists there either, fall back to a neutral, brand-safe default tone and flag `Content.voiceProfileId: null` so the frontend can nudge the user to connect voice learning.

### 10.4 Privacy
Ingested posts are the user's own authored content, pulled via their own OAuth grant — but store the consent decision explicitly (`SocialAccount` connect flow, Section 7) and give the user full visibility/delete control over `SourcePost` (Section 7 endpoints). Honor delete requests immediately and re-run analysis on the remaining sample set.

### 10.5 Goal-aware generation
`goal` (Section 4.7) isn't a label — it's a real input to the copywriting prompt, on top of voice. It should shift structure and CTA, not tone (tone stays governed by the voice profile). Bake this mapping into `ai/text.service.ts` as the default guidance per goal, human-editable later if the user wants to override it:

| Goal | What it nudges the copy toward |
|---|---|
| `conversions` | Clear, direct CTA ("Shop now," "Link in bio," "Get yours") — leads with the offer/benefit, less scene-setting |
| `awareness` | Story/personality-forward, shareable, light or no CTA — optimizes for "worth watching," not "worth clicking" |
| `engagement` | Ends with a question or explicit invite to comment/react — written to prompt replies. Content generated with this goal is also a natural candidate to route into the auto-reply queue (Section 11), since it's designed to draw responses |
| `traffic` | Curiosity-gap opening, explicit "link in bio"/"swipe up" style close |
| `lead_gen` | Capture-oriented — "DM us," "sign up," gated-offer language, often paired with a `post` type over `slideshow` |
| `community` | UGC-style prompts — tagging friends, challenges, "tag someone who..." |
| `announcement` | News-style and direct — feature/launch framing, minimal narrative buildup |

If `goal` is omitted on a manually-created `Content` item, skip this guidance entirely rather than guessing — don't silently default to one goal's structure for content the user is writing themselves.

---

## 11. Engagement / Auto-Reply Engine

This is the highest-risk subsystem — it publishes text on the user's behalf, in public, without a human necessarily reading it first. Build the guardrails as first-class, not bolted on.

### 11.1 Detection
`poll-mentions` job runs on an interval per platform (frequency governed by each platform's read-rate limits — X in particular, see Section 6). Where a platform offers real webhook-based comment notifications (Meta), prefer that over polling. New items are upserted into `InboundInteraction` with `status: 'new'` (the unique index on `platformInteractionId` prevents double-processing).

### 11.2 Processing pipeline (`process-inbound-interaction`)
1. Run `EngagementRule.filters` — `excludeKeywords`, `onlyFromFollowers`, `skipLikelyBots` (heuristic: near-zero follower count + no avatar + generic username pattern). Any hit → `status: 'skipped'`, `skipReason` recorded, logged to `AutomationAuditLog`.
2. Run sentiment classification (lightweight Claude call). If negative and `skipNegativeSentiment: true` → force `status: 'pending_review'` regardless of `mode` — never auto-publish a reply to a hostile or upset message without a human glancing at it first.
3. **Hard-block categories that always route to review, even in `auto_publish` mode**, regardless of rule config: anything that reads as a legal/safety complaint, a request that implies a binding commitment (pricing, contracts, guarantees), or content that trips the moderation check in 11.3. This is a non-negotiable safety floor, not a configurable filter.
4. If it passes, generate the reply using the voice profile (Section 10.3) and run it through `moderation.service.ts` (11.3).
5. If `mode: 'auto_publish'` and it passes moderation and the account hasn't hit `maxRepliesPerDay` → publish immediately via `adapter.publishReply()`, `status: 'replied'`, log to `AutomationAuditLog`.
6. If `mode: 'review_queue'`, or any of the above gates redirected it → `status: 'pending_review'`, surfaced in the dashboard queue and via the `reply.flagged_for_review` webhook, with the AI's drafted reply pre-filled so approving is a single click.

### 11.3 Moderation gate (`ai/moderation.service.ts`)
Before any autonomous reply is published, run a second, independent Claude call whose only job is to answer: "Is this reply safe to post unsupervised — no promises made on the brand's behalf, no hostile/inflammatory tone, no engaging with obvious trolling/bait, nothing that could be defamatory or factually wrong about a third party?" A `false` blocks auto-publish and routes to review, always, regardless of `EngagementRule.mode`.

### 11.4 Rate & safety caps
- `maxRepliesPerDay` per account, hard-enforced server-side, not just a UI suggestion.
- Global per-workspace ceiling as well (protects against a misconfigured rule or a mention pile-on triggering hundreds of replies at once).
- If an account gets flagged/rate-limited by the platform itself for automated behavior, immediately set `EngagementRule.enabled: false` and the related `Schedule.status: 'paused'`, log `automation.paused` with `reason: 'auth_error'` or a platform-abuse signal, and notify the user — don't keep retrying into a suspension.

### 11.5 Transparency
Every reply — auto-published or human-approved — is logged in `AutomationAuditLog` and `InboundInteraction`. The dashboard's automation feed (`GET /api/automation/audit-log`) is how a user answers "what did Swiply say on my behalf while I wasn't looking," so this must never be lossy or delayed.

---

## 12. Security Requirements

Encryption of tokens, hashed API keys, OAuth state/PKCE, global `ValidationPipe` with `whitelist`/`forbidNonWhitelisted` rejecting unknown fields, stripped tokens in serialized responses, signed webhooks, `WorkspaceGuard` enforcing workspace-scoped authorization on every route. Plus:

- Moderation-gate bypass must be impossible from the public Developer API too — `POST /api/public/v1/engagement/interactions/:id/approve` is the only way a reply generated for a flagged interaction gets published; there is no API path that skips 11.3 for `auto_publish` rules.
- `SourcePost` text is user-authored content pulled via OAuth scope the user granted — treat deletion requests (Section 10.4) as immediate and irreversible, not soft-deleted-but-still-in-backups-forever; document actual retention behavior.
- Authorization failures must not leak existence. A workspace the caller isn't a member of and a workspace that doesn't exist return the identical response. A wrong password and an unregistered email return the identical response.

---

## 13. Environment Variables

```
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CALLBACK_URL=
FRONTEND_URL=
ENCRYPTION_KEY=
ANTHROPIC_API_KEY=
IMAGE_GEN_API_KEY=
VIDEO_GEN_API_KEY=            # Remotion/Shotstack or text-to-video provider
TTS_API_KEY=                  # ElevenLabs/OpenAI TTS, if using templated video assembly
CLOUDINARY_URL=               # or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_BUCKET
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REDIS_URL=                    # BullMQ queues + @nestjs/throttler rate-limit store
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=    # for Instagram/Facebook comment webhooks
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_API_TIER=             # 'free' | 'basic' | 'pro' — gates whether mention polling is even attempted
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
RESEND_API_KEY=
```

`src/config/env.validation.ts` validates all of these at boot and refuses to start on an invalid config, reporting every problem at once rather than one per restart. Each build step promotes its own variables from optional to required as it lands.

---

## 14. Testing Requirements

Unit tests for schedule/timezone math, integration tests per route, external API mocking, Playwright E2E, Developer API contract snapshots. Plus:

- **Distribution algorithm** (Section 9.2): given `postsPerMonth: 200`, verify the actual generated count converges on 200 by month end despite daily randomization; verify no two posts on the same account violate `minGapMinutes`; verify all generated times fall inside `postingWindows`; verify platform-cap overflow redistributes rather than drops.
- **Voice ingestion**: account with zero historical posts (new account) falls back to workspace default without erroring; ingestion partial-failure (platform API returns fewer posts than requested) still produces a usable profile.
- **Video content**: a `Post` scheduled for content still in `video.status: 'generating'` at publish time — must not attempt to publish; must reschedule or hold and alert, not fail silently.
- **Engagement pipeline**: negative-sentiment mention with `mode: auto_publish` still routes to review (11.2 step 2 overrides mode). Reply that fails the moderation gate never reaches `publishReply()` — test this at the integration level, not just unit-test the gate in isolation. `maxRepliesPerDay` cap is enforced even under concurrent processing (race condition test: fire N interactions simultaneously, assert no more than the cap gets published). Duplicate mention delivered twice (webhook retry or overlapping poll windows) is processed once, due to the unique index.
- **Kill switch**: `POST /api/automation/pause-all` actually halts in-flight-but-not-yet-processing jobs, not just future ones — a `Post` already claimed by the publish worker before pause was hit is allowed to finish (don't leave it half-published), but nothing new picks up after.
- **Platform suspension signal**: simulate a platform auth/abuse error on publish or reply, assert the account's `Schedule` and `EngagementRule` both auto-pause and the user is notified, and that the worker doesn't keep retrying into it.
- **Content generation input validation**: `POST /api/content/generate` with `generationSource: 'ai'` and no `goal` → `422`. `imageSource: 'user_provided'` with `providedImageUrls` length ≠ `slideCount` → `422 IMAGE_COUNT_MISMATCH`. `imageSource: 'ai_generated'` with `providedImageUrls` present → reject rather than silently ignoring one or the other (ambiguous input should error, not guess).
- **MediaAsset pool exhaustion under autopilot**: a `volume` schedule with `defaultImageSource: 'user_provided'` and an empty/insufficient library — assert the batch job generates what it can, leaves the rest as `draft` with images unset, notifies the user, and does **not** silently switch to `ai_generated` for the shortfall.
- **Goal → prompt mapping**: for each `goal` value, assert the constructed generation prompt actually includes that goal's guidance block (Section 10.5) — this is testing the prompt-construction function's output, not the AI's actual creative output, which isn't deterministically testable.

E2E specs boot the real `AppModule` against `mongodb-memory-server`, so no Atlas connection is needed and unique indexes/casting/populate all behave as in production.

---

## 15. Build Order

1. **Foundation**: Nest CLI project scaffold, `@nestjs/mongoose` connection, User/Workspace/WorkspaceMember modules, Passport auth (local + Google strategies) issuing JWTs, global `ValidationPipe` + exception filter wired in `main.ts`. ✅ **Done**
2. **Social connections**: TikTok + Instagram + X adapters first, token encryption, connect/callback/disconnect.
3. **Voice ingestion**: `SourcePost` + `VoiceProfile`, `fetchRecentPosts()` per adapter, `analyzeVoice()`, manual relearn endpoint. Get this working before content generation so generation can be voice-conditioned from day one rather than retrofitted.
4. **Content model + media library + manual creation**: generalized `Content` (slideshow/video/post types), `MediaAsset` + `/api/media/upload`, manual creation for slideshow + post first with both image-sourcing paths working; stub video as "coming soon."
5. **AI generation pipeline**: text generation conditioned on voice profile + `goal` (Section 10.5), image generation, `/api/content/generate` for slideshow + post types with both `imageSource` paths.
6. **Manual scheduling + publish worker**: `Post` creation for a specific content/account/time, `fixed_days` schedule mode only, TikTok + Instagram publishing.
7. **Volume mode + distribution algorithm**: the 200/month randomized-timing feature, fully unit tested in isolation before wiring to real scheduling.
8. **Video generation**: templated assembly pipeline (script → images → TTS → render), async status handling, lead-time-aware batch generation.
9. **Remaining platform adapters**: Facebook, Pinterest, LinkedIn.
10. **Engagement engine**: `EngagementRule`, `InboundInteraction`, mention polling/webhooks, the full guardrail pipeline (11.1–11.4) — build the moderation gate and rate caps *before* enabling `auto_publish` mode in any environment, including staging.
11. **Automation transparency**: `AutomationAuditLog`, pause-all kill switch, dashboard status endpoint.
12. **Billing**: Stripe plans, plan-limit enforcement (including capping `postsPerMonth` and `maxRepliesPerDay` by tier).
13. **Developer API**: API keys, `/api/public/v1/*`, rate limiting, idempotency.
14. **Outbound webhooks**: signing, delivery + retry worker, including the new `reply.*` and `content.video_*` events.
15. **Hardening**: full edge-case pass (Section 14), token refresh sweep, monitoring/logging, alerting on repeated auto-pause events.

---

## 16. Open Decisions to Confirm With the User Before Building

- **Video generation approach**: templated assembly (recommended for v1, cheaper/faster/more controllable) vs. pure text-to-video model — affects cost per video and turnaround time.
- **X (Twitter) API tier** — mention/reply automation needs a paid tier; confirm budget for this before promising "auto-reply to tweets" as a launch feature. *Blocks build step 2: determines whether the X adapter implements `fetchMentions` at all.*
- **Default `maxRepliesPerDay` and `postsPerMonth` ceilings per plan tier**, and whether `auto_publish` engagement mode is available on all tiers or gated to higher ones given the risk profile.
- **Exact current per-platform posting rate limits** (Instagram/Facebook Graph API content-publishing caps, TikTok, etc.) — these change; confirm live numbers during implementation rather than trusting any figure quoted here.
- **Whether voice-profile ingestion is opt-in by default** (recommended) or opt-out, and how ingestion consent is worded/logged for compliance.
