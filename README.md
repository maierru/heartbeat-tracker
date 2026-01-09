# Heartbeat

Zero-config daily active device tracking for iOS. No registration, no setup, no backend.

## Install

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/maierru/heartbeat-tracker.git", from: "1.0.0")
]
```

Or in Xcode: File → Add Package Dependencies → paste URL.

## Usage

```swift
import Heartbeat

@main
struct MyApp: App {
    init() {
        Heartbeat.ping()
    }
}
```

That's it.

## View Stats

Open `https://heartbeat.work/{your.bundle.id}`

Example: `https://heartbeat.work/com.example.myapp`

No login required.

## How It Works

1. App calls `Heartbeat.ping()` on launch
2. Library checks if already pinged today (UTC) → skips if yes
3. Sends: `GET heartbeat.work/p?a={bundle_id}&d={device_hash}&e={env}`
4. Stats aggregated and shown at `heartbeat.work/{bundle_id}`

## What's Tracked

| Data | Value | Privacy |
|------|-------|---------|
| App | Bundle ID | Public anyway (App Store) |
| Device | SHA256 hash (16 chars) | Anonymous, not reversible |
| Environment | `prod` or `dev` | Auto-detected |
| Date | UTC date | When ping sent |

**Not tracked:** IP, location, user data, anything personal.

## Environments

Auto-detected:
- `prod` → Release builds
- `dev` → Debug builds (`#if DEBUG`)

Stats page shows both, filterable.

## Background Refresh (Optional)

Track devices even when app isn't opened:

```swift
import BackgroundTasks

// In App init or AppDelegate
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "work.heartbeat.refresh",
    using: nil
) { task in
    Heartbeat.ping()
    task.setTaskCompleted(success: true)
}
```

Add to Info.plist:
```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>work.heartbeat.refresh</string>
</array>
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
</array>
```

Note: iOS controls background refresh frequency. Not guaranteed daily.

## Requirements

- iOS 13+ / macOS 10.15+ / tvOS 13+ / watchOS 6+
- Swift 5.9+

## FAQ

**Q: Can others see my stats?**
A: Yes, stats are public. Bundle ID is already public via App Store.

**Q: How is device ID generated?**
A: UUID stored in Keychain (survives reinstall), then SHA256 hashed.

**Q: What if ping fails?**
A: Retries next app launch. Only marks "pinged today" after 200 response.

**Q: Rate limits?**
A: Library sends max 1 request/device/day. Server has no per-app limits.

## License

MIT
