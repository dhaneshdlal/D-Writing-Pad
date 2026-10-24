import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: AppIconGenerator <iconset-directory> <browser-icon.png>\n", stderr)
    exit(2)
}

let iconsetURL = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let browserIconURL = URL(fileURLWithPath: CommandLine.arguments[2])
let baseSize = CGFloat(1024)
let baseImage = NSImage(size: NSSize(width: baseSize, height: baseSize))

baseImage.lockFocus()
guard let context = NSGraphicsContext.current?.cgContext else {
    fputs("Could not create the app icon graphics context.\n", stderr)
    exit(1)
}

context.setAllowsAntialiasing(true)
context.setShouldAntialias(true)

let backgroundRect = NSRect(x: 24, y: 24, width: 976, height: 976)
let background = NSBezierPath(roundedRect: backgroundRect, xRadius: 218, yRadius: 218)
let backgroundGradient = NSGradient(
    colors: [
        NSColor(calibratedRed: 0.58, green: 0.48, blue: 0.99, alpha: 1),
        NSColor(calibratedRed: 0.34, green: 0.28, blue: 0.78, alpha: 1),
        NSColor(calibratedRed: 0.22, green: 0.28, blue: 0.65, alpha: 1),
    ]
)
backgroundGradient?.draw(in: background, angle: -35)

let pageRect = NSRect(x: 250, y: 155, width: 525, height: 715)
let page = NSBezierPath(roundedRect: pageRect, xRadius: 43, yRadius: 43)
let shadow = NSShadow()
shadow.shadowColor = NSColor(calibratedWhite: 0.08, alpha: 0.38)
shadow.shadowBlurRadius = 38
shadow.shadowOffset = NSSize(width: 0, height: -16)
shadow.set()
NSColor(calibratedWhite: 0.97, alpha: 1).setFill()
page.fill()
NSShadow().set()

let fold = NSBezierPath()
fold.move(to: NSPoint(x: 594, y: 870))
fold.line(to: NSPoint(x: 594, y: 746))
fold.line(to: NSPoint(x: 775, y: 746))
fold.close()
NSColor(calibratedRed: 0.83, green: 0.81, blue: 0.99, alpha: 1).setFill()
fold.fill()

for y in stride(from: CGFloat(645), through: CGFloat(355), by: -96) {
    let rule = NSBezierPath()
    rule.lineWidth = 18
    rule.lineCapStyle = .round
    rule.move(to: NSPoint(x: 340, y: y))
    rule.line(to: NSPoint(x: 650, y: y))
    NSColor(calibratedRed: 0.50, green: 0.43, blue: 0.88, alpha: 0.72).setStroke()
    rule.stroke()
}

let pencilTransform = NSAffineTransform()
pencilTransform.translateX(by: 690, yBy: 195)
pencilTransform.rotate(byDegrees: 43)
pencilTransform.translateX(by: -690, yBy: -195)
pencilTransform.concat()

let pencilBody = NSBezierPath(roundedRect: NSRect(x: 635, y: 170, width: 88, height: 380), xRadius: 25, yRadius: 25)
NSColor(calibratedRed: 1.0, green: 0.72, blue: 0.29, alpha: 1).setFill()
pencilBody.fill()

let pencilTip = NSBezierPath()
pencilTip.move(to: NSPoint(x: 635, y: 190))
pencilTip.line(to: NSPoint(x: 679, y: 105))
pencilTip.line(to: NSPoint(x: 723, y: 190))
pencilTip.close()
NSColor(calibratedRed: 0.92, green: 0.83, blue: 0.68, alpha: 1).setFill()
pencilTip.fill()

let graphite = NSBezierPath()
graphite.move(to: NSPoint(x: 669, y: 124))
graphite.line(to: NSPoint(x: 679, y: 105))
graphite.line(to: NSPoint(x: 689, y: 124))
graphite.close()
NSColor(calibratedRed: 0.19, green: 0.20, blue: 0.27, alpha: 1).setFill()
graphite.fill()

baseImage.unlockFocus()

func pngData(for image: NSImage) -> Data {
    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:])
    else {
        fputs("Could not encode app icon as PNG.\n", stderr)
        exit(1)
    }
    return png
}

do {
    try FileManager.default.createDirectory(at: iconsetURL, withIntermediateDirectories: true)
    try pngData(for: baseImage).write(to: browserIconURL, options: .atomic)

    let iconSizes: [(String, Int)] = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]

    for (filename, size) in iconSizes {
        let pixels = Int(baseSize)
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: size,
            pixelsHigh: size,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        )
        guard let bitmap else {
            throw NSError(domain: "AppIconGenerator", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Could not allocate \(size)x\(size) icon image."
            ])
        }

        let graphics = NSGraphicsContext(bitmapImageRep: bitmap)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = graphics
        graphics?.imageInterpolation = .high
        graphics?.cgContext.scaleBy(x: CGFloat(size) / baseSize, y: CGFloat(size) / baseSize)
        baseImage.draw(
            in: NSRect(x: 0, y: 0, width: pixels, height: pixels),
            from: .zero,
            operation: .copy,
            fraction: 1
        )
        NSGraphicsContext.restoreGraphicsState()

        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "AppIconGenerator", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Could not encode \(size)x\(size) icon image."
            ])
        }
        try png.write(to: iconsetURL.appendingPathComponent(filename), options: .atomic)
    }
} catch {
    fputs("Could not write app icon assets: \(error.localizedDescription)\n", stderr)
    exit(1)
}
