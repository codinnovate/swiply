# Postlock home screen redesign prompt

Act as a senior iOS product designer and SwiftUI engineer. Redesign Postlock's Today screen into a polished daily posting challenge that makes progress satisfying and the next action obvious. Implement the design in the existing app after inspecting its components and state model.

## Product context

Postlock helps people consistently publish qualifying public posts on X. Users choose posting days, a daily goal, and cumulative deadlines. When verified posts fall below the total required at a passed deadline, selected apps can be shielded until enough posts are verified. Posting ahead counts. A missed deadline is recoverable.

Start with `Postlock/Features/Today/TodayView.swift`, `Postlock/DesignSystem/Theme.swift`, `Postlock/DesignSystem/Components.swift`, `Postlock/Models/PostingCommitment.swift`, and `Postlock/App/AppSession.swift`.

The current screen fragments status, a large standalone count, and a deadline list. It gives them competing visual weight, buries the action below the schedule, and uses punitive blocked-state copy. Resolve the hierarchy and interaction model, not just colors and corner radii.

## Design direction

Create a focused, premium training companion for a creator's daily habit. Retain Postlock's charcoal background and electric lime accent. Use warm white primary text, legible muted text, and restrained coral for overdue states. Reserve lime for meaningful progress and the primary action. Avoid decorative dashboards, excessive nested cards, oversized uppercase labels, arbitrary gradients, and competing badges.

Use a consistent spacing scale of 8, 12, 16, 24, and 32 points. Give the screen 20 to 24 points of horizontal inset. Use native typography, tabular numbers for progress and time, and one dominant numeric focal point. Make the interface feel intentionally composed even at zero progress.

## Screen hierarchy

1. Compact header: Today, a readable date, and the connected account where useful. Avoid duplicating the navigation title.
2. Daily challenge: one dominant composition combining a segmented progress ring, verified count, daily goal, short state headline, and next relevant deadline. Show `1 of 3 posts verified` explicitly. For large goals, use a continuous ring rather than illegibly small segments. Clamp the visual fraction and handle a zero goal safely.
3. Primary action: place `Check my posts` directly beneath the challenge, visible on a small iPhone at standard text size. Keep it available before deadlines and while catching up. During verification, show `Checking posts...`, prevent duplicate requests, and keep the layout stable. Completion can replace this with a quiet completed state.
4. Today's checkpoints: compact connected rows showing time, cumulative requirement, and a distinct completed, overdue, or upcoming icon and label. Highlight the next unmet checkpoint. Explain cumulative requirements with copy such as `2 posts total by 3:00 PM`. Never imply that each row is a separate narrow posting window.
5. App protection: a secondary, compact status row reflecting actual Screen Time authorization and shielding. Distinguish a posting requirement from confirmed app locking. Never claim apps are locked or unlocked solely from a visual progress state.

## Gamification

Build the first release around a truthful daily loop: publish, verify, fill a checkpoint, complete the daily challenge. Each newly verified contribution advances progress. Completing the goal earns a tasteful `Daily goal complete` seal and a short success response. Trigger feedback only on a new verified transition, not on view appearance, repeat checks, or reopening the app. A missed deadline remains a recoverable checkpoint with a clear path forward.

Do not invent streaks, XP, levels, weekly history, or earned badges from today's count. The existing model has no historical record. Keep those out of the production UI unless you implement durable history, date and timezone handling, duplicate prevention, and explicit reward rules. Rest days must never count as failures. Reward verified posting consistency, not time spent in the app.

Use a brief progress animation and restrained success haptic when new progress is confirmed. Respect Reduce Motion, avoid looping celebration, and keep feedback nonblocking.

## Required states and copy

- Active, zero progress: `Your first post starts today's progress.` Show the next requirement and verification action.
- Active, partial progress: `One step closer.` Show the real verified count and remaining requirement.
- Overdue: `Let's catch up.` Explain exactly how many additional verified posts satisfy the currently passed deadlines. Do not assume a single post unlocks everything.
- Completed: `Daily goal complete.` Celebrate once and summarize the achieved goal.
- Rest day: `Rest day. Your next challenge is coming.` Avoid empty progress rings that imply failure.
- Checking: visible loading feedback without hiding existing verified progress.
- No new posts: calm inline feedback explaining that public posts may take a moment to appear.
- Offline or verification failure: preserve progress, explain the failure, and offer retry without awarding completion.
- Missing commitment: provide a clear schedule setup action rather than a blank screen.

Use short, encouraging language. Remove `You haven't earned this yet.` Never shame users. Do not use em dashes anywhere in app copy, accessibility text, or new documentation. Rewrite sentences with periods, commas, or colons.

## Implementation and acceptance

Use reusable SwiftUI components and the existing design tokens. Keep verification and enforcement grounded in the existing services. Present deadline times in the commitment's timezone and ensure progress refreshes correctly across midnight and app foregrounding. Preserve navigation, scheduling, and Screen Time behavior.

Support Dynamic Type, VoiceOver, sufficient contrast, 44-point minimum touch targets, safe areas, and Reduce Motion. Do not communicate state through color alone. Allow scrolling at large text sizes rather than truncating essential content.

Deliver the implemented screen, previews for every major state, and screenshots at compact and large iPhone sizes. Validate zero, partial, completed, overdue, rest-day, and failure states, including multiple missed checkpoints and repeat verification. Summarize changed files, actual checks performed, and any remaining data dependencies. The result should answer three questions at a glance: How am I doing? What is due next? What should I do now?
