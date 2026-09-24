# POSTLOCK App Store screenshots

Six individual PNGs in this directory are 1260 × 2736 pixels, 8-bit RGB, tagged sRGB, with no alpha channel. Their marketing copy follows the supplied brief exactly. Layouts use the app icon, native system typography, charcoal surfaces, and the app's lime accent.

Native screens were captured from the current SwiftUI project on an iPhone 17 Pro Max simulator. `source/` contains those captures; the app UI is embedded directly, proportionally scaled, without redrawing its text or controls. `tools/render.swift` renders the marketing layout with AppKit/Core Graphics.

The capture app was built in `/tmp/postlock-appstore-work/postlock` with a separate bundle identifier (`com.swiply.postlock.capture`). The project's existing app-source edits were not changed. The isolated build adds launch-only demonstration states for 0/3, 1/3, and 3/3 progress and the existing POSTLOCK Test fixture. The confirmation screen uses its actual initial-avatar fallback, with no verification badge. Progress is demonstration data, not a claim about live posting activity. The capture build selects the existing physical-device protection status label instead of the simulator diagnostic label.

## Product-copy issue (resolved)

Screenshot 03 originally retained the brief's exact text: “Block selected apps until your posting goal is met.” The implementation instead asks the user to select X as an exception and blocks other apps after missed deadlines until the required checkpoint count is satisfied — the real “Keep X available” screen. Per owner decision, the subtitle was changed to “Stay focused when you miss a posting deadline.” and the image re-rendered.

## Re-render existing captures

Run from the repository root:

```sh
swift -module-cache-path /tmp/postlock-appstore-work/swift-cache postlock/AppStoreScreenshots/tools/render.swift "$PWD/postlock/AppStoreScreenshots"
```

`tools/prepare-capture.py` records the isolated-build launch hooks. It requires a fresh copy of the iOS project at its hardcoded temporary path and is intended for one use per fresh copy. `tools/capture.py` requires the isolated build installed on the indicated simulator.

## Inspection

All six finished images were visually inspected individually. The exact marketing strings are specified in the renderer. All six PNG IHDR headers were checked for 1260 × 2736 dimensions, 8-bit depth, and color type 2 (opaque RGB). The capture build completed successfully.
