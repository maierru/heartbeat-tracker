# Heartbeat

Track daily active users. 1 minute setup.

## Setup

### 1. Add package in Xcode

File → Add Package Dependencies → paste:
```
https://github.com/maierru/heartbeat-tracker.git
```

### 2. Add to your App.swift

```swift
import SwiftUI
import Heartbeat

@main
struct MyApp: App {
    init() {
        Heartbeat.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### 3. Add to Info.plist

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

### 4. View your stats

```
https://heartbeat.work/{your.bundle.id}
```

Done.

---

## What You Get

- Daily unique device count (even if app not opened)
- Version distribution
- prod/dev environment filter
- Public dashboard (no login)

## Privacy

- Device ID: anonymous SHA256 hash (not reversible)
- No IP, location, or personal data
- 1 ping per device per day

## License

MIT
