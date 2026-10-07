import AppKit
import ImageIO
import UniformTypeIdentifiers

let base = URL(fileURLWithPath: CommandLine.arguments[1])
let W = 1260
let H = 2736

func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, alpha: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: r / 255, green: g / 255, blue: b / 255, alpha: alpha)
}

let lavender = color(187, 174, 255)
let mint = color(143, 224, 194)

struct Slide {
    let file: String
    let source: String
    let first: String
    let second: String
    let subtitle: String
    let accent: NSColor
}

let slides = [
    Slide(file: "01-grow-on-x", source: "01-home", first: "Grow on X.", second: "By showing up.", subtitle: "Daily posting goals that keep you consistent.", accent: lavender),
    Slide(file: "02-set-your-rhythm", source: "02-schedule", first: "Set your rhythm.", second: "Make it stick.", subtitle: "Choose your posting pace and deadlines.", accent: mint),
    Slide(file: "03-see-what-works", source: "03-analytics", first: "See what makes", second: "posts work.", subtitle: "Scores and insights for every post.", accent: lavender),
    Slide(file: "04-understand-your-xp", source: "04-xp-breakdown", first: "See how every", second: "post performs.", subtitle: "Understand the engagement behind your XP.", accent: mint),
    Slide(file: "05-climb-the-leaderboard", source: "05-leaderboard", first: "Climb the creator", second: "leaderboard.", subtitle: "Earn XP from real engagement.", accent: lavender),
    Slide(file: "06-challenge-creators", source: "06-challenges", first: "Challenge creators.", second: "Stay accountable.", subtitle: "Friendly posting duels keep you moving.", accent: mint),
]

let iconURL = base.appendingPathComponent("../Postlock/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png").standardizedFileURL
guard let icon = NSImage(contentsOf: iconURL) else {
    fatalError("Could not load app icon at \(iconURL.path)")
}

func round(_ rect: NSRect, radius: CGFloat, fill: NSColor) {
    fill.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func drawText(_ string: String, x: CGFloat, y: CGFloat, size: CGFloat, weight: NSFont.Weight, fill: NSColor, tracking: CGFloat = 0, maxWidth: CGFloat = 1080) {
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: fill,
        .kern: tracking,
    ]
    let value = NSAttributedString(string: string, attributes: attrs)
    precondition(value.size().width <= maxWidth, "Text exceeds safe area: \(string)")
    value.draw(at: NSPoint(x: x, y: y))
}

func glow(center: NSPoint, radius: CGFloat, tint: NSColor) {
    let rect = NSRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
    let gradient = NSGradient(starting: tint.withAlphaComponent(0.20), ending: tint.withAlphaComponent(0))!
    gradient.draw(in: NSBezierPath(ovalIn: rect), relativeCenterPosition: .zero)
}

for slide in slides {
    let context = CGContext(
        data: nil,
        width: W,
        height: H,
        bitsPerComponent: 8,
        bytesPerRow: W * 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    )!
    let graphics = NSGraphicsContext(cgContext: context, flipped: true)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics
    context.translateBy(x: 0, y: CGFloat(H))
    context.scaleBy(x: 1, y: -1)

    let background = NSGradient(colors: [color(13, 14, 20), color(22, 21, 37), color(34, 30, 57)])!
    background.draw(in: NSRect(x: 0, y: 0, width: W, height: H), angle: 90)
    glow(center: NSPoint(x: 1100, y: 345), radius: 390, tint: lavender)
    glow(center: NSPoint(x: 150, y: 2220), radius: 420, tint: slide.accent)

    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: NSRect(x: 90, y: 76, width: 72, height: 72), xRadius: 18, yRadius: 18).addClip()
    icon.draw(in: NSRect(x: 90, y: 76, width: 72, height: 72), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    NSGraphicsContext.restoreGraphicsState()
    drawText("POSTLOCK", x: 184, y: 96, size: 33, weight: .bold, fill: color(246, 245, 251), tracking: 4)

    drawText(slide.first, x: 86, y: 205, size: 108, weight: .bold, fill: color(250, 249, 253), tracking: -3.6)
    drawText(slide.second, x: 86, y: 319, size: 108, weight: .bold, fill: slide.accent, tracking: -3.6)
    drawText(slide.subtitle, x: 92, y: 461, size: 39, weight: .medium, fill: color(184, 182, 197), tracking: -0.4)

    let sourceURL = base.appendingPathComponent("source/\(slide.source).png")
    guard let source = NSImage(contentsOf: sourceURL), let rep = source.representations.first else {
        fatalError("Could not load source screenshot at \(sourceURL.path)")
    }
    let screenW: CGFloat = 900
    let screenH = screenW * CGFloat(rep.pixelsHigh) / CGFloat(rep.pixelsWide)
    let screen = NSRect(x: (CGFloat(W) - screenW) / 2, y: 710, width: screenW, height: screenH)
    let shell = screen.insetBy(dx: -17, dy: -17)

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.72)
    shadow.shadowBlurRadius = 58
    shadow.shadowOffset = NSSize(width: 0, height: 28)
    shadow.set()
    round(shell, radius: 108, fill: color(70, 65, 91))
    NSGraphicsContext.restoreGraphicsState()

    round(shell.insetBy(dx: 3, dy: 3), radius: 105, fill: color(9, 10, 15))
    let rim = NSBezierPath(roundedRect: shell.insetBy(dx: 1.5, dy: 1.5), xRadius: 107, yRadius: 107)
    color(187, 174, 255, alpha: 0.40).setStroke()
    rim.lineWidth = 2
    rim.stroke()

    round(NSRect(x: shell.minX - 4, y: shell.minY + 227, width: 4, height: 60), radius: 2, fill: color(82, 76, 103))
    round(NSRect(x: shell.minX - 4, y: shell.minY + 318, width: 4, height: 105), radius: 2, fill: color(82, 76, 103))
    round(NSRect(x: shell.minX - 4, y: shell.minY + 444, width: 4, height: 105), radius: 2, fill: color(82, 76, 103))
    round(NSRect(x: shell.maxX, y: shell.minY + 370, width: 4, height: 153), radius: 2, fill: color(82, 76, 103))

    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: screen, xRadius: 89, yRadius: 89).addClip()
    graphics.imageInterpolation = .high
    source.draw(in: screen, from: .zero, operation: .copy, fraction: 1, respectFlipped: true, hints: nil)
    NSGraphicsContext.restoreGraphicsState()
    NSGraphicsContext.restoreGraphicsState()

    let output = base.appendingPathComponent(slide.file + ".png")
    let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil)
    precondition(CGImageDestinationFinalize(destination))
    print(output.path)
}
