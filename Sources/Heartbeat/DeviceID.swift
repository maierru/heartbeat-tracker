import Foundation
import CryptoKit

/// Generates and persists a stable device identifier in UserDefaults.
/// Hashed for privacy.
enum DeviceID {
    private static let key = "work.heartbeat.device_id"

    /// SHA256-hashed device ID (first 16 chars)
    static var hashed: String {
        let raw = rawID
        let hash = SHA256.hash(data: Data(raw.utf8))
        let full = hash.compactMap { String(format: "%02x", $0) }.joined()
        return String(full.prefix(16))
    }

    /// Raw UUID stored in UserDefaults
    private static var rawID: String {
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }
        let new = UUID().uuidString
        UserDefaults.standard.set(new, forKey: key)
        return new
    }
}
