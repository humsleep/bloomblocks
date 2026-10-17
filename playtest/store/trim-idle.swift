// Cuts the idle stretches out of a simulator screen recording (the waits between scripted taps) so the
// App Review video stays short, keeps every moment the screen changes, and writes a half-size H.264 MP4.
//   swift playtest/store/trim-idle.swift <in.mp4> <out.mp4> [threshold=0.012] [pad=0.6] [maxIdle=0.6]
// The cut points are printed (source time → output time) so the review notes can say what was removed.
import AVFoundation
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: trim-idle.swift in.mp4 out.mp4 [threshold] [pad] [maxIdle]"); exit(2) }
let src = URL(fileURLWithPath: args[1]), dst = URL(fileURLWithPath: args[2])
let threshold = args.count > 3 ? Double(args[3])! : 0.012
let pad = args.count > 4 ? Double(args[4])! : 0.6
let maxIdle = args.count > 5 ? Double(args[5])! : 0.6

let asset = AVURLAsset(url: src)
let duration = CMTimeGetSeconds(asset.duration)
let gen = AVAssetImageGenerator(asset: asset)
gen.maximumSize = CGSize(width: 66, height: 144)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero

func pixels(_ img: CGImage) -> [UInt8] {
  let w = 66, h = 144
  var buf = [UInt8](repeating: 0, count: w * h * 4)
  let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  return buf
}

let step = 0.25
var prev: [UInt8]? = nil
var active: [Double] = []
var t = 0.0
while t < duration {
  if let img = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
    let p = pixels(img)
    if let q = prev {
      var sum = 0
      for i in stride(from: 0, to: p.count, by: 4) { sum += abs(Int(p[i]) - Int(q[i])) + abs(Int(p[i + 1]) - Int(q[i + 1])) + abs(Int(p[i + 2]) - Int(q[i + 2])) }
      let d = Double(sum) / Double(p.count / 4 * 3 * 255)
      if d > threshold { active.append(t) }
    }
    prev = p
  }
  t += step
}
// keep ranges: every change ± pad, merged; the last 3 s (the prompt) always kept
var ranges: [(Double, Double)] = []
for a in active {
  let r = (max(0, a - pad), min(duration, a + pad))
  if let last = ranges.last, r.0 <= last.1 + maxIdle { ranges[ranges.count - 1].1 = max(last.1, r.1) } else { ranges.append(r) }
}
ranges.append((max(0, duration - 3), duration))
var merged: [(Double, Double)] = []
for r in ranges.sorted(by: { $0.0 < $1.0 }) {
  if let last = merged.last, r.0 <= last.1 { merged[merged.count - 1].1 = max(last.1, r.1) } else { merged.append(r) }
}

let comp = AVMutableComposition()
let vt = asset.tracks(withMediaType: .video)[0]
let track = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
var out = CMTime.zero
for (a, b) in merged {
  let range = CMTimeRange(start: CMTime(seconds: a, preferredTimescale: 600), end: CMTime(seconds: b, preferredTimescale: 600))
  try! track.insertTimeRange(range, of: vt, at: out)
  print(String(format: "keep %6.2f–%6.2f s → %6.2f s", a, b, CMTimeGetSeconds(out)))
  out = out + range.duration
}
print(String(format: "source %.1f s → output %.1f s", duration, CMTimeGetSeconds(out)))

let size = vt.naturalSize.applying(vt.preferredTransform)
let half = CGSize(width: (abs(size.width) / 2).rounded(), height: (abs(size.height) / 2).rounded())
let vc = AVMutableVideoComposition()
vc.renderSize = half
vc.frameDuration = CMTime(value: 1, timescale: 30)
let ins = AVMutableVideoCompositionInstruction()
ins.timeRange = CMTimeRange(start: .zero, duration: out)
let li = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
li.setTransform(vt.preferredTransform.concatenating(CGAffineTransform(scaleX: 0.5, y: 0.5)), at: .zero)
ins.layerInstructions = [li]
vc.instructions = [ins]

try? FileManager.default.removeItem(at: dst)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality)!
ex.outputURL = dst
ex.outputFileType = .mp4
ex.videoComposition = vc
let sem = DispatchSemaphore(value: 0)
ex.exportAsynchronously { sem.signal() }
sem.wait()
if ex.status != .completed { print("export failed: \(String(describing: ex.error))"); exit(1) }
print("wrote \(dst.path) \(Int(half.width))×\(Int(half.height))")
