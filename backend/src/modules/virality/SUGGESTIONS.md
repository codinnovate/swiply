# POSTLOCK post suggestions

Additive route: `POST /api/v1/postlock/suggestions`, body `{ "username": "handle", "niche": "product design" }`. Existing history, scoring and leaderboard contracts are unchanged. Returns an unwrapped `{ generatedAt, niche, ideas }` payload like the other POSTLOCK routes. Each idea has `id`, `title`, `topic`, `draft`, `whyNow`, `angle` and `sourceUrls`.

Uses the existing server-side `XAI_API_KEY` and optional `POSTLOCK_RESEARCH_MODEL` (default `grok-4.7`). Calls the xAI Responses API with `x_search`, a last-two-calendar-days date filter, and the existing virality framework incorporated into a new research prompt. It researches niche conversations, not a global trending chart. No guarantee of virality. Source links are retained only when their X post IDs appear in provider citations. Date filters have calendar-day granularity; the prompt asks for the last 48 hours.

Research is user-triggered, cached for 30 minutes per normalized niche, limited to three concurrent provider requests per process, and throttled to three requests per minute per caller. Cache holds at most 200 niches. Provider fees apply when live research is requested. Configure a provider spending cap before broad public rollout. No provider key is sent to the iOS app. A missing key/provider error produces an explicit unavailable state, not fabricated trends.

The simulator's existing design-preview switch displays labeled sample ideas with no source claims. Tap Go live, set a niche, and Find post ideas to request research. Copy and Open in X never publish automatically.

Provider reference: https://docs.x.ai/developers/tools/x-search
