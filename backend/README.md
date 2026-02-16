# Swiply Backend

NestJS backend for Swiply, an AI social media manager. `AGENTS.md` is the spec;
this README covers only how to run what exists today.

## Status

Build order (AGENTS.md §15):

- [x] **1. Foundation** — scaffold, Mongo connection, `User`/`Workspace`/`WorkspaceMember`,
      Passport auth (local + Google) issuing JWTs, global `ValidationPipe` + exception filter
- [x] **2. Social connections** — `SocialAccount`, AES-256-GCM token encryption,
      TikTok/Instagram/X adapters, signed-state + PKCE connect/callback/disconnect
- [ ] 3. Voice ingestion
- [ ] 4–15. See `AGENTS.md`

## Running

```bash
cp .env.example .env      # MONGODB_URI, JWT_SECRET, and ENCRYPTION_KEY at minimum
openssl rand -hex 32      # -> ENCRYPTION_KEY
npm install
npm run start:dev
```

The app refuses to boot on an invalid `.env` — `src/config/env.validation.ts`
validates every variable in §13 and reports all problems at once.

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
