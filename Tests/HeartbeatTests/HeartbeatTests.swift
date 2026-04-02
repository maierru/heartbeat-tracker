import XCTest
@testable import Heartbeat

final class HeartbeatTests: XCTestCase {

    // MARK: - DeviceID

    func test_deviceID_returns16CharHex() {
        let id = DeviceID.hashed
        XCTAssertEqual(id.count, 16)
        XCTAssertTrue(id.allSatisfy { $0.isHexDigit }, "Expected hex string, got: \(id)")
    }

    func test_deviceID_isStable() {
        XCTAssertEqual(DeviceID.hashed, DeviceID.hashed)
    }

    // MARK: - Platform smoke

    func test_ping_doesNotCrash() {
        // Just verifies no crash on current platform
        Heartbeat.ping()
    }

    #if os(macOS)
    func test_start_doesNotCrashOnMacOS() {
        Heartbeat.start()
    }
    #endif

    #if os(watchOS)
    func test_start_doesNotCrashOnWatchOS() {
        Heartbeat.start()
    }
    #endif
}
