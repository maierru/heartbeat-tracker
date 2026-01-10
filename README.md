# Heartbeat

Track daily active users with background refresh. 2 minutes to set up.

## Setup

### 1. Add package in Xcode

File → Add Package Dependencies → paste:
```
https://github.com/maierru/heartbeat-tracker.git
```

### 2. Update your App.swift

```swift
import SwiftUI
import BackgroundTasks
import Heartbeat

@main
struct MyApp: App {
    init() {
        Heartbeat.ping()
        registerBackgroundRefresh()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }

    private func registerBackgroundRefresh() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "work.heartbeat",
            using: nil
        ) { task in
            Heartbeat.ping()
            task.setTaskCompleted(success: true)
            scheduleNextRefresh()
        }
        scheduleNextRefresh()
    }
}

private func scheduleNextRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "work.heartbeat")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 60 * 60)
    try? BGTaskScheduler.shared.submit(request)
}
```

### 3. Add to Info.plist

```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>work.heartbeat</string>
</array>
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
</array>
```

Or in Xcode: Target → Signing & Capabilities → + Background Modes → check "Background fetch"

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
