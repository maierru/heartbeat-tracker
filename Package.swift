// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Heartbeat",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15),
        .tvOS(.v13),
        .watchOS(.v6)
    ],
    products: [
        .library(
            name: "Heartbeat",
            targets: ["Heartbeat"]
        ),
    ],
    targets: [
        .target(
            name: "Heartbeat",
            dependencies: []
        ),
    ]
)
