# Swiply Backend

NestJS backend for Swiply, an AI social media manager. `AGENTS.md` is the spec;
this README covers only how to run what exists today.

## Status

Implemented modules include authentication and workspaces, TikTok/Instagram/X
connections, voice ingestion, personal encrypted OpenAI/Anthropic/Gemini keys,
content and uploaded-video drafts, S3 multipart media, publishing records,
schedules, engagement review data, and an automation audit trail. Pinterest and
LinkedIn adapters, AI image generation, billing, email delivery, and public
developer credentials still require their dedicated backend modules.

Buffer and Postiz are available as workspace-owned BYOK publishing gateways.
They discover the user's existing provider channels and send scheduled posts to
the provider immediately, without requiring Swiply-owned social OAuth keys.

## Running

```bash
cp .env.example .env      # MONGODB_URI, JWT_SECRET, and ENCRYPTION_KEY at minimum
openssl rand -hex 32      # -> ENCRYPTION_KEY
npm install
npm run start:dev
```

The app refuses to boot on an invalid `.env` — `src/config/env.validation.ts`
validates every variable in §13 and reports all problems at once.

Media uploads use a private S3 bucket and public CloudFront delivery. Development
can run without AWS configuration, but media-upload endpoints return
`STORAGE_NOT_CONFIGURED`; production requires the four AWS storage values shown
in `.env.example`. Provision the resources with `../infra/terraform/storage`,
then attach its `backend_policy_arn` output to the backend execution role.

Uploads are multipart and client-to-S3: initiate with `POST /api/media/uploads`,
request presigned part URLs, upload the parts, and submit their ETags to the
completion endpoint. Images are capped at 50 MB and videos at 2 GB.

- API root: `http://localhost:3000/api`
- OpenAPI docs: `http://localhost:3000/api/docs`

## Testing

```bash
npm test          # unit specs (src/**/*.spec.ts)
npm run test:e2e  # e2e specs (test/**/*.e2e-spec.ts), in-memory MongoDB
npm run lint
npm run build
```

E2E specs boot the real `AppModule` against `mongodb-memory-server`, so no Atlas
connection is needed. The first run downloads a `mongod` binary.

## What step 1 established

**Error contract (§5).** Everything leaving the app is shaped
`{ error: { code, message, details } }` by `HttpExceptionFilter`. Application code
throws `ApiException` with a code from `src/common/errors/error-codes.ts`; unknown
failures become an opaque `INTERNAL_ERROR` so upstream messages can't leak keys.

**Auth.** JWT bearer tokens. `JwtAuthGuard` is global — every route is
authenticated unless it carries `@Public()`. `JwtStrategy` re-reads the user on each
request rather than trusting the token body, so a deleted account stops working
immediately. Wrong password and unknown email return the identical
`INVALID_CREDENTIALS` response.

Google OAuth registers only when `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET` are set;
otherwise the route returns `OAUTH_PROVIDER_NOT_CONFIGURED` rather than a Passport
crash. Google sign-in links to an existing account by email instead of creating a
duplicate.

**Workspace scoping (§12).** `WorkspaceGuard` resolves the target workspace from
(in order) the `:workspaceId` param, the `X-Workspace-Id` header, a `workspaceId`
body/query field, or the caller's `defaultWorkspaceId`; proves active membership;
and attaches `{ workspaceId, role }` to the request. A non-member gets the same 403
as for a workspace that doesn't exist, so ids can't be probed. `@RequireRoles('admin')`
sets a role floor over the `viewer < editor < admin < owner` hierarchy.

Every user gets a workspace at signup. Invites to an address that isn't a Swiply
user yet sit as `pending` and activate on registration.

**Validation (§12).** The global pipe runs with `whitelist` + `forbidNonWhitelisted`,
so an unknown field is a `400`, never a silent drop.

## What step 2 established

**Token encryption (§12).** `TokenCipher` wraps AES-256-GCM. Ciphertext is
`v1.<iv>.<tag>.<payload>`; the version prefix is what will let a future key
rotation tell old values from new. Both token fields on `SocialAccount` are
`select: false`, so reading them takes an explicit `.select('+accessToken')`, and
`toSocialAccountResponse` builds its output field by field — a credential field
added later is absent by default rather than exposed until someone strips it.

**The connect flow.** `GET /connect/:platform` returns an authorize URL rather
than a 302, because the caller is an XHR with a bearer token and `fetch()` would
follow a redirect itself. `GET /callback/:platform` is `@Public()` by necessity —
the platform redirects a browser there with no token — so the signed state is the
only proof of who started the flow. State is encrypted under the same key as
stored tokens and carries the workspace, user, platform, and PKCE verifier; a
tampered state fails to decrypt rather than binding an account to the wrong
workspace. Membership is re-proved at callback time, not trusted from when the
state was minted.

Every callback failure resolves to a `FRONTEND_URL` redirect carrying
`?status=error&code=…`, since a browser mid-redirect cannot render a JSON body.

**Platform adapters (§6).** The capability table is data, so `validateContent` is
one implementation rather than six. Three interface signatures differ from §6 as
written — `getOAuthUrl` takes pre-signed state instead of a raw workspaceId,
`handleOAuthCallback` also takes the redirect URI and PKCE verifier, and
`refreshAccessToken` takes the refresh token instead of the account — all so that
token decryption and state minting each stay in exactly one place.

Meta issues no refresh tokens: `accessToken` holds the Page token that publishes,
`refreshToken` holds the long-lived user token that re-derives it.

`PlatformRegistry` keeps three states apart — unknown slug, adapter arriving in
build step 9, and missing credentials — so a typo doesn't look like a missing
env var.

**Open decisions still outstanding (§16).** X mention polling is gated on
`TWITTER_API_TIER`; on `free` the adapter connects, publishes, and replies, but
reports `supportsMentions: false`. Build step 10 must not assume otherwise until
the tier is confirmed. Instagram's per-account 24h publishing cap is not yet
enforced — it belongs in the volume distributor (step 7) and the live number
still needs confirming.

## Notes for the next step

- `Workspace.timezone` is the single source of truth for all schedule math (§9.2).
- Voice ingestion consent is recorded on `SocialAccount.voiceIngestionConsentedAt`
  (a field beyond §4.4) and must be checked before `ingest-voice-samples` runs.
- `SocialAccountsService.getUsableAccessToken` is the only place a platform token
  is decrypted; it refreshes 5 minutes ahead of expiry. Call it rather than
  reading `accessToken` directly.
- OAuth state is not single-use — the PKCE verifier rides inside it so the flow
  stays stateless. Once Redis lands in step 6, move the verifier server-side.
- No transactions are used: `WorkspacesService.create` compensates manually so the
  code runs against a standalone mongod as well as an Atlas replica set.

## What step 3 established

`VoiceProfilesService` is the single ingestion path. It proves that consent was
recorded, obtains a usable decrypted platform token through
`SocialAccountsService`, upserts recent posts, removes anything beyond the 200
sample cap, and regenerates the profile. `VoiceAnalysisService` uses OpenAI
Structured Outputs with the authenticated caller's encrypted BYOK key. Accounts
with no source posts produce an empty profile without an external AI request.

The profile and source-post routes are workspace-scoped and source posts are
deleted and re-analyzed immediately. Explicit `userSetTone` survives analysis,
so manual instructions remain higher priority for the generation pipeline.

## User-provided AI keys

Swiply has no deployment-wide AI key. Authenticated users manage encrypted
OpenAI, Anthropic, or Gemini keys through
`GET|PUT|DELETE /api/ai/credentials/:provider` and choose among models returned
by `GET /api/ai/models`. Responses expose only the last four key characters.
Content generation accepts optional `aiModel`; otherwise it uses the user's
saved default.
