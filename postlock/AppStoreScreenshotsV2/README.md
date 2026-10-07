# Postlock App Store Screenshots V2

Six App Store screenshots for the redesigned Postlock experience. The compositions use authentic iPhone simulator captures of the current app, with deterministic AppKit rendering for crisp typography and consistent framing.

## Output

- 1260 × 2736 px
- Opaque RGB PNG
- sRGB color space
- Current navy, lavender, and mint visual system

The `source/` directory contains the underlying app captures. Some screens intentionally display the app's built-in sample data so that analytics and social features are legible.

## Render

From the repository root:

```sh
swift -module-cache-path /tmp/postlock-screenshot-v2-swift-cache \
  postlock/AppStoreScreenshotsV2/tools/render.swift \
  "$PWD/postlock/AppStoreScreenshotsV2"
```
