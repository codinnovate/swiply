# POSTLOCK iOS

Native SwiftUI client for POSTLOCK. This slice implements public X username setup and settings management without OAuth.

When a posting deadline is missed, POSTLOCK uses Apple's Screen Time APIs to block all app categories except the single app the user selected as X/Twitter. Apple exposes only an opaque selection token, so the user must choose X in the system picker; POSTLOCK cannot identify or preselect it by bundle identifier. If that exception is missing or invalid, POSTLOCK fails open instead of risking blocking X.

## Run

1. Run `xcodegen generate` in this directory.
2. Open `Postlock.xcodeproj`.
3. Set `API_BASE_URL` in `Postlock/Resources/Info.plist` for the target environment.
4. Run the `Postlock` scheme on an iOS 17+ simulator.

The API base URL defaults to `http://localhost:3000`. Username verification calls `POST /api/v1/posting-profile`.
