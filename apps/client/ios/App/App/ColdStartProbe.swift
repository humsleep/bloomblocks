// Measurement-only: compiled in Debug and Measure (SWIFT_ACTIVE_COMPILATION_CONDITIONS
// contains PERF_PROBE), never in Release / App Store archives. src/native/probe.ts
// treats a missing native plugin as a no-op.
#if PERF_PROBE
import Capacitor
import Foundation
import os

/// W1 cold-start probe. start = kernel process start time (p_starttime), or
/// didFinishLaunching when iOS prewarmed the process (env ActivePrewarm=1).
/// end = JS mark() (M1: two rAFs after board draw + input enabled).
/// Writes os_signpost + OSLog and appends one JSON line to Documents/perf.jsonl.
@objc(ColdStartProbe)
public class ColdStartProbe: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ColdStartProbe"
    public let jsName = "ColdStartProbe"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "mark", returnType: CAPPluginReturnPromise)]
    static var didFinishLaunchingAt = Date() // set first thing in AppDelegate
    private static let log = Logger(subsystem: "lanternly.perf", category: "coldstart")
    private static let signposter = OSSignposter(subsystem: "lanternly.perf", category: .pointsOfInterest)
    private var marked = false

    static func processStart() -> Date? {
        var info = kinfo_proc(), size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        guard sysctl(&mib, 4, &info, &size, nil, 0) == 0 else { return nil }
        let tv = info.kp_proc.p_starttime
        return Date(timeIntervalSince1970: Double(tv.tv_sec) + Double(tv.tv_usec) / 1_000_000)
    }

    @objc func mark(_ call: CAPPluginCall) {
        let end = Date()
        guard !marked else { return call.resolve(["ms": -1]) } // first mark per process only
        marked = true
        let prewarm = ProcessInfo.processInfo.environment["ActivePrewarm"] == "1"
        let start = prewarm ? Self.didFinishLaunchingAt : (Self.processStart() ?? Self.didFinishLaunchingAt)
        let ms = (end.timeIntervalSince(start) * 1000).rounded()
        let dflMs = (Self.didFinishLaunchingAt.timeIntervalSince(start) * 1000).rounded()
        #if DEBUG
        let config = "debug"
        #else
        let config = "release" // Measure configuration = Release settings + probe
        #endif
        let variant = call.getString("variant") ?? "?"
        let line: [String: Any] = [
            "t": ISO8601DateFormatter().string(from: end), "variant": variant, "ms": ms, "dflMs": dflMs,
            "webMs": call.getDouble("webMs") ?? -1, "prewarm": prewarm, "config": config,
        ]
        Self.signposter.emitEvent("coldstart", "\(variant, privacy: .public) \(ms, privacy: .public) ms")
        Self.log.notice("coldstart \(variant, privacy: .public) ms=\(ms, privacy: .public) dfl=\(dflMs, privacy: .public) prewarm=\(prewarm, privacy: .public)")
        if var data = try? JSONSerialization.data(withJSONObject: line, options: [.sortedKeys]) {
            data.append(0x0A)
            let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("perf.jsonl")
            if let h = try? FileHandle(forWritingTo: url) { _ = try? h.seekToEnd(); try? h.write(contentsOf: data); try? h.close() }
            else { try? data.write(to: url) }
        }
        call.resolve(["ms": ms, "prewarm": prewarm])
    }
}
#endif
