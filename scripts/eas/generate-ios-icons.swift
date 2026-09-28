// Render Fida's existing Android bag mark into Apple's asset sizes on the EAS worker.
import AppKit
import Foundation

guard ProcessInfo.processInfo.environment["EAS_BUILD"] == "true",
      CommandLine.arguments.count == 2 else { fatalError("EAS worker and asset path required") }
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let green = NSColor(srgbRed: 8/255, green: 127/255, blue: 91/255, alpha: 1)
let mint = NSColor(srgbRed: 213/255, green: 242/255, blue: 170/255, alpha: 1)
for directory in ["AppIcon.appiconset", "LaunchImage.imageset"] {
    let dir = root.appendingPathComponent(directory)
    let data = try Data(contentsOf: dir.appendingPathComponent("Contents.json"))
    let manifest = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    for row in manifest["images"] as! [[String: String]] {
        guard let filename = row["filename"] else { continue }
        let points = Double(row["size"]?.components(separatedBy: "x").first ?? "108")!
        let scale = Double(row["scale"]!.replacingOccurrences(of: "x", with: ""))!
        let pixels = Int(points * scale)
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
                                     bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false,
                                     isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let transform = NSAffineTransform()
        transform.scale(by: CGFloat(pixels) / 108)
        transform.concat()
        green.setFill()
        NSRect(x: 0, y: 0, width: 108, height: 108).fill()
        mint.setFill()
        let bag = NSBezierPath()
        bag.move(to: NSPoint(x: 28, y: 70)); bag.line(to: NSPoint(x: 80, y: 70))
        bag.line(to: NSPoint(x: 76, y: 24)); bag.line(to: NSPoint(x: 32, y: 24)); bag.close(); bag.fill()
        NSColor.white.setStroke()
        let handle = NSBezierPath()
        handle.move(to: NSPoint(x: 40, y: 68)); handle.line(to: NSPoint(x: 40, y: 76))
        handle.curve(to: NSPoint(x: 68, y: 76), controlPoint1: NSPoint(x: 40, y: 95), controlPoint2: NSPoint(x: 68, y: 95))
        handle.line(to: NSPoint(x: 68, y: 68)); handle.lineWidth = 6; handle.lineCapStyle = .round; handle.stroke()
        green.setFill()
        NSRect(x: 45, y: 29, width: 8, height: 29).fill()
        NSRect(x: 45, y: 51, width: 21, height: 7).fill()
        NSRect(x: 45, y: 38, width: 19, height: 7).fill()
        NSGraphicsContext.restoreGraphicsState()
        try bitmap.representation(using: .png, properties: [:])!.write(to: dir.appendingPathComponent(filename))
    }
}
