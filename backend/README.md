# Swiply Backend

NestJS backend for Swiply, an AI social media manager. `AGENTS.md` is the spec;
this README covers only how to run what exists today.

## Status

Build order (AGENTS.md §15):

- [x] **1. Foundation** — scaffold, Mongo connection, `User`/`Workspace`/`WorkspaceMember`,
      Passport auth (local + Google) issuing JWTs, global `ValidationPipe` + exception filter
- [ ] 2. Social connections
- [ ] 3. Voice ingestion
- [ ] 4–15. See `AGENTS.md`

## Running

```bash
cp .env.example .env      # set MONGODB_URI and JWT_SECRET at minimum
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

## Notes for the next step

- `Workspace.timezone` is the single source of truth for all schedule math (§9.2).
- `ENCRYPTION_KEY` is declared and format-checked but unused until build step 2
  encrypts `SocialAccount` tokens.
- No transactions are used: `WorkspacesService.create` compensates manually so the
  code runs against a standalone mongod as well as an Atlas replica set.
