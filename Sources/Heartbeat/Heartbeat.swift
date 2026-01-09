import Foundation

/// Zero-config daily active device tracking.
/// View stats at: https://heartbeat.work/{your.bundle.id}
public enum Heartbeat {
    private static let endpoint = "https://heartbeat.work/p"
    private static let lastPingKey = "work.heartbeat.lastPing"

    /// Call once on app launch. Automatically sends max 1 ping per day.
    public static func ping() {
        // Defer slightly to ensure network is ready
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            performPing()
        }
    }

    private static func performPing() {
        print("[Heartbeat] checking if should ping...")
        guard shouldPingToday() else {
            print("[Heartbeat] already pinged today, skipping")
            return
        }
        guard let bundleId = Bundle.main.bundleIdentifier else {
            print("[Heartbeat] no bundle ID found")
            return
        }

        let device = DeviceID.hashed
        let env = currentEnvironment
        print("[Heartbeat] device=\(device) env=\(env) app=\(bundleId)")

        var components = URLComponents(string: endpoint)!
        components.queryItems = [
            URLQueryItem(name: "a", value: bundleId),
            URLQueryItem(name: "d", value: device),
            URLQueryItem(name: "e", value: env)
        ]

        guard let url = components.url else {
            print("[Heartbeat] failed to build URL")
            return
        }

        print("[Heartbeat] sending to \(url)")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 10

        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                print("[Heartbeat] error: \(error)")
                return
            }
            if let http = response as? HTTPURLResponse {
                print("[Heartbeat] response: \(http.statusCode)")
                if http.statusCode == 200 {
                    markPingedToday()
                    print("[Heartbeat] marked as pinged")
                }
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
