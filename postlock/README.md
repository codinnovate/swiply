# POSTLOCK iOS

Native SwiftUI client for POSTLOCK. This slice implements public X username setup and settings management without OAuth.

## Run

1. Run `xcodegen generate` in this directory.
2. Open `Postlock.xcodeproj`.
3. Set `API_BASE_URL` in `Postlock/Resources/Info.plist` for the target environment.
4. Run the `Postlock` scheme on an iOS 17+ simulator.

The API base URL defaults to `http://localhost:3000`. Username verification calls `POST /api/v1/posting-profile`.
