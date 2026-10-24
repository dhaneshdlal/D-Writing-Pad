// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Notepad",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "Notepad", targets: ["NotepadApp"]),
    ],
    targets: [
        .executableTarget(name: "NotepadApp", path: "Sources/NotepadApp"),
    ]
)
