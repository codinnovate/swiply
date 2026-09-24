import AppKit
import ImageIO
import UniformTypeIdentifiers

let base = URL(fileURLWithPath: CommandLine.arguments[1])
let W = 1260, H = 2736
func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> NSColor { NSColor(srgbRed:r/255, green:g/255, blue:b/255, alpha:1) }
let lime = color(183,255,60)
struct Slide { let file: String; let source: String; let first: String; let second: String; let subtitle: String }
let slides = [
 Slide(file:"01-post-with-purpose",source:"01-hero",first:"Post first.",second:"Scroll later.",subtitle:"Build a posting habit with POSTLOCK."),
 Slide(file:"02-make-a-plan",source:"02-plan",first:"Your goal.",second:"Your schedule.",subtitle:"Choose your posting days, target,\nand deadline."),
 Slide(file:"03-protect-your-focus",source:"03-blocking",first:"Give your goals",second:"your attention.",subtitle:"Stay focused when you miss\na posting deadline."),
 Slide(file:"04-see-your-progress",source:"04-progress",first:"See what’s left.",second:"Make it happen.",subtitle:"Check your progress toward\ntoday’s posting goal."),
 Slide(file:"05-confirm-your-profile",source:"05-profile",first:"Just your",second:"X username.",subtitle:"We only check your public posts."),
 Slide(file:"06-build-consistency",source:"06-complete",first:"Today’s goal,",second:"done.",subtitle:"Small daily wins.\nA consistent posting habit.")
]
let icon = NSImage(contentsOf: base.appendingPathComponent("../Postlock/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"))!
func round(_ rect: NSRect, _ radius: CGFloat, _ fill: NSColor) { fill.setFill(); NSBezierPath(roundedRect:rect,xRadius:radius,yRadius:radius).fill() }
func text(_ string: String, x: CGFloat, y: CGFloat, size: CGFloat, weight: NSFont.Weight, fill: NSColor, tracking: CGFloat = 0) {
 let font = NSFont.systemFont(ofSize:size,weight:weight)
 let attrs:[NSAttributedString.Key:Any] = [.font:font,.foregroundColor:fill,.kern:tracking]
 let value = NSAttributedString(string:string, attributes:attrs)
 precondition(value.size().width <= 1080, "Text exceeds safe area: \(string)")
 value.draw(at:NSPoint(x:x,y:y))
}
for slide in slides {
 let ctx = CGContext(data:nil,width:W,height:H,bitsPerComponent:8,bytesPerRow:W*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue)!
 let graphics = NSGraphicsContext(cgContext:ctx,flipped:true)
 NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = graphics
 ctx.translateBy(x:0,y:CGFloat(H)); ctx.scaleBy(x:1,y:-1)
 let gradient = NSGradient(colors:[color(11,12,14),color(18,22,18),color(33,40,24)])!
 gradient.draw(in:NSRect(x:0,y:0,width:W,height:H),angle:90)
 // Brand lockup, same across all six images.
 NSGraphicsContext.saveGraphicsState()
 NSBezierPath(roundedRect:NSRect(x:96,y:86,width:76,height:76),xRadius:19,yRadius:19).addClip()
 icon.draw(in:NSRect(x:96,y:86,width:76,height:76),from:.zero,operation:.sourceOver,fraction:1,respectFlipped:true,hints:nil)
 NSGraphicsContext.restoreGraphicsState()
 text("POSTLOCK",x:193,y:107,size:34,weight:.bold,fill:color(243,245,239),tracking:4)
 text(slide.first,x:90,y:224,size:120,weight:.bold,fill:color(247,249,244),tracking:-4)
 text(slide.second,x:90,y:352,size:120,weight:.bold,fill:lime,tracking:-4)
 for (i,line) in slide.subtitle.components(separatedBy:"\n").enumerated() {
  text(line,x:96,y:529+CGFloat(i)*55,size:43,weight:.regular,fill:color(175,181,171),tracking:-0.6)
 }
 let source = NSImage(contentsOf:base.appendingPathComponent("source/\(slide.source).png"))!
 let rep = source.representations.first!
 let screenW:CGFloat = 876
 let screenH = screenW * CGFloat(rep.pixelsHigh) / CGFloat(rep.pixelsWide)
 let screen = NSRect(x:(CGFloat(W)-screenW)/2,y:748,width:screenW,height:screenH)
 let shell = screen.insetBy(dx:-18,dy:-18)
 NSGraphicsContext.saveGraphicsState()
 let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.65); shadow.shadowBlurRadius=54; shadow.shadowOffset=NSSize(width:0,height:24); shadow.set()
 round(shell,108,color(67,71,66))
 NSGraphicsContext.restoreGraphicsState()
 round(shell.insetBy(dx:3,dy:3),105,color(14,16,15))
 let rim = NSBezierPath(roundedRect:shell.insetBy(dx:1.5,dy:1.5),xRadius:107,yRadius:107)
 color(92,99,87).withAlphaComponent(0.6).setStroke(); rim.lineWidth=1.5; rim.stroke()
 round(NSRect(x:shell.minX-4,y:shell.minY+227,width:4,height:60),2,color(71,76,67))
 round(NSRect(x:shell.minX-4,y:shell.minY+318,width:4,height:105),2,color(71,76,67))
 round(NSRect(x:shell.minX-4,y:shell.minY+444,width:4,height:105),2,color(71,76,67))
 round(NSRect(x:shell.maxX,y:shell.minY+370,width:4,height:153),2,color(71,76,67))
 NSGraphicsContext.saveGraphicsState()
 NSBezierPath(roundedRect:screen,xRadius:89,yRadius:89).addClip()
 graphics.imageInterpolation = .high
 source.draw(in:screen,from:.zero,operation:.copy,fraction:1,respectFlipped:true,hints:nil)
 NSGraphicsContext.restoreGraphicsState()
 NSGraphicsContext.restoreGraphicsState()
 let output=base.appendingPathComponent(slide.file+".png")
 let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
 CGImageDestinationAddImage(destination,ctx.makeImage()!,nil)
 precondition(CGImageDestinationFinalize(destination))
 print(output.path)
}
