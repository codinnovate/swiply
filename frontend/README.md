# Swiply Web

Next.js App Router frontend for the Swiply backend. It includes the public site,
authentication, creator studio, media library, calendar, schedules, connected
accounts, voice profiles, engagement, automation, billing and developer UI.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

The web app runs at `http://localhost:3001`. Set `BACKEND_URL` to the private
server-side API URL, normally `http://localhost:3000/api`. The browser talks to
the Next.js BFF, which keeps the NestJS JWT in an HttpOnly cookie.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Server-only NestJS API root. Never prefix this with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_APP_URL` | Browser-visible canonical web origin used for request-origin checks. |
| `NEXT_PUBLIC_BACKEND_URL` | Optional public backend URL used only to begin Google OAuth. |

AI provider keys are entered by signed-in users in **Settings → AI providers**.
They are transmitted over HTTPS, validated and encrypted by the backend, and
are never placed in frontend environment variables or browser storage.

Workspace admins add Buffer or Postiz publishing keys under **Social accounts**.
These keys are also server-encrypted and let Swiply publish through channels the
workspace already connected at the selected provider.

See `DESIGN_SYSTEM.md` for tokens, component rules, forms, modals, accessibility,
and responsive behavior.
