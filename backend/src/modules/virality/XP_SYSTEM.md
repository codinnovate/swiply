# PostLock — XP Calculation System

This is a build prompt for Claude Code: an XP system based on X's disclosed engagement-weight table (from the open-sourced `twitter/the-algorithm` repo, 2023), so XP rewards the same behavior the platform's own ranking rewards — conversation over passive likes.

---

## Base weight table (XP per engagement event)

| Signal                                           | XP weight |
| ------------------------------------------------ | --------- |
| Like received                                    | 0.5       |
| Repost received                                  | 1         |
| Reply received                                   | 13.5      |
| Profile click that leads to engagement           | 12        |
| Someone clicks into the conversation and engages | 11        |
| Author replies to a reply on their own post      | 75        |
| Post gets muted/blocked by a viewer              | −74       |
| Post gets reported                               | −369      |

**Caveat to note in the code comments:** these weights are from 2023-era open-sourced code. X has since said ranking shifted toward a Grok-based system, so exact numbers may be stale even if the hierarchy (replies > reposts > likes, reply-to-reply highest) reportedly still holds. Treat the table as a tunable config, not a hardcoded constant, so it can be updated later without a schema change.

---

## Build prompt

```
Build an XP calculation system for PostLock, an app that helps users grow their X account. XP is earned per post based on the engagement it receives, using a weighted-signal model derived from X's disclosed ranking algorithm — the goal is to reward the same behavior X's own algorithm rewards (conversation over passive likes), not raw follower vanity metrics.

Requirements:

1. Config table (not hardcoded): store engagement weights as an editable config object/table, not inline constants, so weights can be retuned later without touching scoring logic.

   Default weights:
   - like: 0.5 XP each
   - repost: 1 XP each
   - reply_received: 13.5 XP each
   - profile_click_to_engagement: 12 XP each
   - conversation_click_engagement: 11 XP each
   - author_reply_to_reply: 75 XP each (the user replying back to someone who replied to their post)
   - muted_or_blocked: -74 XP each (penalty, only apply if this data is available from the API tier in use)
   - reported: -369 XP each (penalty, only apply if this data is available)

2. Per-post XP calculation:
   xp_for_post = sum(count_of_each_signal * its_weight)
   Clamp the penalty signals to only subtract, never let a single post's XP contribution go below 0 (a bad post shouldn't be able to erase XP earned elsewhere) — but track the raw negative total separately for analytics/insights purposes.

3. Data availability handling: not all signals will be available depending on X API tier (e.g. mute/block/report counts on your own posts, and "profile click" / "conversation click" signals may not be exposed at all in the standard API). Build this so missing signals default to 0 rather than breaking the calculation, and clearly flag in the data model which signals were actually available vs. assumed-zero, so the UI can be honest about it (e.g. "XP shown reflects likes, reposts, and replies only — click-through data not available on current API tier").

4. XP snapshots over time: engagement changes after posting (a post gets more likes/replies over hours/days). Recalculate XP at defined intervals after a post goes live (e.g. 1hr, 24hr, 7-day) rather than once, and store xp_history as a time series per post so users can see XP growth on a post, not just a final number.

5. Aggregate/account-level XP: sum per-post XP into a running account total, plus expose a rolling window (e.g. XP earned in the last 7/30 days) for leveling and leaderboard purposes.

6. Leveling: define XP thresholds for level-ups (e.g. level = floor(sqrt(total_xp / 100)) or a simple tiered table — pick whichever curve gives a reasonable early-level pace so new users feel progress quickly, then flattens so it stays meaningful at high XP). Expose current level, XP into current level, and XP needed for next level.

7. Anti-gaming guardrails:
   - Do not award XP for engagement detected as coming from bot-like or clearly coordinated sources if that data is available.
   - Consider diminishing returns on reposts/likes from the exact same small set of accounts repeatedly engaging with a user's posts, to discourage engagement-pod behavior — replies from varied accounts should be worth more than repeated engagement from the same few.
   - Do not let deleting and reposting the same content farm XP twice; dedupe by content hash within a reasonable time window.

8. Expose XP breakdown per post (mirroring the virality score breakdown already built): show the user how many XP came from likes vs. reposts vs. replies vs. the reply-to-reply bonus, so XP visibly rewards conversation, reinforcing the app's core growth advice.

Output: a data model for per-post and per-account XP, a calculation function that takes engagement counts + the config table and returns XP + breakdown, and a leveling function that takes total/rolling XP and returns current level + progress.
```

---

## Notes for integration with what's already built

- This pairs with the virality score system already spec'd: virality score predicts how a post _should_ perform before/at posting; XP measures how it _actually_ performed after. Consider surfacing both side by side in the history tab ("Predicted: 78/100 → Actual: 210 XP") — this is also the natural place to eventually calibrate the virality score prompt against real outcomes, as noted in the earlier spec.
- XP totals and levels feed directly into the leaderboard tab already spec'd (rank PostLock users by rolling-window XP instead of, or alongside, avg virality score).
- Keep the weight table and the leveling curve in remotely-editable config (not shipped hardcoded in the app binary) so you can retune both without a release, especially since the underlying X algorithm weights may change again.

---

## Implementation notes — FxTwitter only

PostLock does **not** use the X API anywhere. All post data comes from FxTwitter's public timeline (`api.fxtwitter.com/2/profile/:user/statuses?with_replies=true`), so signal availability is set by what that endpoint exposes, not by an X API tier.

| Signal                        | Source                                                                                                                                                                                                      | Availability                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| like                          | `likes` count                                                                                                                                                                                               | measured                                    |
| repost                        | `reposts` count                                                                                                                                                                                             | measured                                    |
| reply_received                | `replies` count, minus the author's own direct replies (thread continuations)                                                                                                                               | measured                                    |
| author_reply_to_reply         | The replies timeline interleaves the other person's reply next to the author's answer. A reply from the author to a post that itself replied to one of the author's posts counts once per distinct replier. | partial (only what the timeline pages show) |
| profile_click_to_engagement   | not public                                                                                                                                                                                                  | unavailable → 0                             |
| conversation_click_engagement | not public                                                                                                                                                                                                  | unavailable → 0                             |
| muted_or_blocked              | not public                                                                                                                                                                                                  | unavailable → 0                             |
| reported                      | not public                                                                                                                                                                                                  | unavailable → 0                             |

Quotes, bookmarks and views are fetched but carry no weight, since they're not in the table.

**Where it lives**

- Backend: `backend/src/modules/virality/domain/xp.ts` (weights, per-post calculation, leveling, account aggregation), `services/xp-config.service.ts` + `schemas/xp-settings.schema.ts` (remote config in Mongo, collection `postlock_xp_settings`), `services/xp.service.ts` (loads posts and computes XP).
- Remote config: `GET`/`PUT /api/v1/postlock/admin/xp-config` (admin token). Weights, level curve, replier-decay window and duplicate window are all editable; each update bumps `version` and re-ranks the leaderboard. The app never ships weights, it reads `xpRules` from the history and leaderboard responses.
- XP history: the engagement readings at ~1h, ~24h and ~7d (plus the latest) are stored per post; XP for each point is derived with the current weights so a retune re-scores history consistently.
- Leveling: level L starts at `levelBaseXp × (L − 1)²` (default base 50: L2 at 50 XP, L3 at 200, L5 at 800, L10 at 4,050). Fast early, flattening later.
- Anti-gaming:
  - Reply-backs count once per distinct replier per post, and a replier the author has already answered on other posts within `replierDecayWindowDays` counts 1, ½, ⅓, … so a pod answering each other every post decays.
  - Posts with the same content hash within `duplicateWindowDays` earn XP once (the best-performing copy keeps it; the others show `duplicateOf`). Posts with no text are never treated as duplicates.
  - FxTwitter exposes no liker/reposter identities and no bot signals, so like/repost diminishing returns and bot filtering can't be applied yet.
- Leaderboard: ranks by XP earned from posts in the period (today / 7 days / all recorded), and shows each account's level.
