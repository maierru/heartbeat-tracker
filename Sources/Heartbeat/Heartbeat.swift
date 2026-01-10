import Foundation
import BackgroundTasks

/// Zero-config daily active device tracking.
/// View stats at: https://heartbeat.work/{your.bundle.id}
public enum Heartbeat {
    private static let endpoint = "https://heartbeat.work/p"
    private static let lastPingKey = "work.heartbeat.lastPing"
    private static let taskIdentifier = "work.heartbeat.refresh"

    /// Start tracking with background refresh. Call once in App init.
    public static func start() {
        ping()
        checkBackgroundConfiguration()
        registerBackgroundRefresh()
    }

    // MARK: - Configuration Check

    private static func checkBackgroundConfiguration() {
        #if DEBUG
        var issues: [String] = []

        // Check BGTaskSchedulerPermittedIdentifiers
        let permittedIds = Bundle.main.object(forInfoDictionaryKey: "BGTaskSchedulerPermittedIdentifiers") as? [String] ?? []
        if !permittedIds.contains(taskIdentifier) {
            issues.append("Missing '\(taskIdentifier)' in BGTaskSchedulerPermittedIdentifiers")
        }

        // Check UIBackgroundModes
        let bgModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
        if !bgModes.contains("fetch") {
            issues.append("Missing 'fetch' in UIBackgroundModes")
        }

        if !issues.isEmpty {
            print("""
            ⚠️ [Heartbeat] Background refresh not configured!

            Issues:
            \(issues.map { "  • \($0)" }.joined(separator: "\n"))

            Add to Info.plist:
            <key>BGTaskSchedulerPermittedIdentifiers</key>
            <array>
                <string>work.heartbeat.refresh</string>
            </array>
            <key>UIBackgroundModes</key>
            <array>
                <string>fetch</string>
            </array>

            Without this, Heartbeat only tracks when app is opened.
            Docs: https://github.com/maierru/heartbeat-tracker
            """)
        }
        #endif
    }

    /// Send ping (max 1 per day). Called automatically by start().
    public static func ping() {
        DispatchQueue.global(qos: .utility).async {
            performPing()
        }
    }

    // MARK: - Background Refresh

    private static func registerBackgroundRefresh() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskIdentifier,
            using: nil
        ) { task in
            ping()
            task.setTaskCompleted(success: true)
            scheduleNextRefresh()
        }
        scheduleNextRefresh()
    }

    private static func scheduleNextRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 60 * 60) // 4 hours
        try? BGTaskScheduler.shared.submit(request)
    }

    // MARK: - Ping

    private static func performPing() {
        guard shouldPingToday() else { return }
        guard let bundleId = Bundle.main.bundleIdentifier else { return }

        let device = DeviceID.hashed
        let env = currentEnvironment
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"

        var components = URLComponents(string: endpoint)!
        components.queryItems = [
            URLQueryItem(name: "a", value: bundleId),
            URLQueryItem(name: "d", value: device),
            URLQueryItem(name: "e", value: env),
            URLQueryItem(name: "v", value: version)
        ]

        guard let url = components.url else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 10

        URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                markPingedToday()
            }
        }.resume()
    }

    // MARK: - Private

    private static func shouldPingToday() -> Bool {
        guard let last = UserDefaults.standard.string(forKey: lastPingKey) else {
            return true
        }
        return last != todayUTC()
    }

    private static func markPingedToday() {
        UserDefaults.standard.set(todayUTC(), forKey: lastPingKey)
    }

    private static func todayUTC() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: Date())
    }

    private static var currentEnvironment: String {
        #if DEBUG
        return "dev"
        #else
        return "prod"
        #endif
    }
}
