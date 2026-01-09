import Foundation
import Security
import CryptoKit

/// Generates and persists a stable device identifier in Keychain.
/// Survives app reinstalls. Hashed for privacy.
enum DeviceID {
    private static let service = "work.heartbeat"
    private static let account = "device_id"

    /// SHA256-hashed device ID (first 16 chars)
    static var hashed: String {
        let raw = rawID
        let hash = SHA256.hash(data: Data(raw.utf8))
        let full = hash.compactMap { String(format: "%02x", $0) }.joined()
        return String(full.prefix(16))
    }

    /// Raw UUID stored in Keychain
    private static var rawID: String {
        if let existing = read() {
            return existing
        }
        let new = UUID().uuidString
        save(new)
        return new
    }

    // MARK: - Keychain

    private static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }
        return string
    }

    private static func save(_ value: String) {
        let data = Data(value.utf8)

        // Delete existing
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Add new
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        SecItemAdd(addQuery as CFDictionary, nil)
    }
}
