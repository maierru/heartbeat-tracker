import Foundation
import os.log
#if os(iOS) || os(tvOS)
import BackgroundTasks
#elseif os(watchOS)
import WatchKit
#endif

/// Zero-config daily active device tracking.
/// View stats at: https://heartbeat.work/{your.bundle.id}
public enum Heartbeat {
    private static let log = OSLog(subsystem: "work.heartbeat", category: "config")
    private static let endpoint = "https://heartbeat.work/p"
    private static let lastPingKey = "work.heartbeat.lastPing"

    /// Start tracking. Call once in App init.
    /// - iOS/tvOS: registers BGTaskScheduler background refresh
    /// - macOS: schedules a repeating Timer (fires while app is running)
    /// - watchOS: schedules WKExtension background refresh;
    ///            also call `handleBackgroundTasks(_:)` from your ExtensionDelegate
    public static func start() {
        ping()
        #if os(iOS) || os(tvOS)
        checkBackgroundConfiguration()
        registerBackgroundRefresh()
        #elseif os(macOS)
        registerMacOSRefresh()
        #elseif os(watchOS)
        registerWatchOSRefresh()
        #endif
    }

    // MARK: - iOS / tvOS

    #if os(iOS) || os(tvOS)
    private static let taskIdentifier = "work.heartbeat.refresh"

    private static func checkBackgroundConfiguration() {
        #if DEBUG
        var issues: [String] = []

        let permittedIds = Bundle.main.object(forInfoDictionaryKey: "BGTaskSchedulerPermittedIdentifiers") as? [String] ?? []
        if !permittedIds.contains(taskIdentifier) {
            issues.append("Missing '\(taskIdentifier)' in BGTaskSchedulerPermittedIdentifiers")
        }

        let bgModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
        if !bgModes.contains("fetch") {
            issues.append("Missing 'fetch' in UIBackgroundModes")
        }

        if !issues.isEmpty {
            let message = """
            Background refresh not configured!
            Issues: \(issues.joined(separator: ", "))
            Add BGTaskSchedulerPermittedIdentifiers with 'work.heartbeat.refresh' and UIBackgroundModes with 'fetch' to Info.plist.
            Docs: https://github.com/maierru/heartbeat-tracker
            """
            os_log(.fault, log: log, "⚠️ %{public}@", message)
        }
        #endif
    }

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
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 60 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
    #endif

    // MARK: - macOS (Timer, fires while app is running)

    #if os(macOS)
    private static var macOSTimer: Timer?

    private static func registerMacOSRefresh() {
        macOSTimer = Timer.scheduledTimer(withTimeInterval: 4 * 60 * 60, repeats: true) { _ in
            ping()
        }
    }
    #endif

    // MARK: - watchOS

    #if os(watchOS)
    private static func registerWatchOSRefresh() {
        scheduleNextWatchRefresh()
    }

    private static func scheduleNextWatchRefresh() {
        WKExtension.shared().scheduleBackgroundRefresh(
            withPreferredDate: Date(timeIntervalSinceNow: 4 * 60 * 60),
            userInfo: nil
        ) { _ in }
    }

    /// Call from `ExtensionDelegate.handle(_ backgroundTasks:)` to process background refresh.
    public static func handleBackgroundTasks(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            if task is WKApplicationRefreshBackgroundTask {
                ping()
                scheduleNextWatchRefresh()
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
    #endif

    // MARK: - Ping

    /// Send ping (max 1 per day). Called automatically by start().
    public static func ping() {
        DispatchQueue.global(qos: .utility).async {
            performPing()
        }
    }

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
