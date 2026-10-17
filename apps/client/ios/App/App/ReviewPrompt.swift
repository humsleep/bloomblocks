import Capacitor
import Foundation
import StoreKit
import UIKit

/// R2 (decision A2): the system rating prompt — Apple's own sheet, nothing custom in front of it
/// (App Review 5.6.1: no "do you like us?" pre-prompt). The system decides whether it shows
/// (at most 3 times in 365 days per app, never in TestFlight; always in a debug build).
/// WHEN to ask is decided in JS only (src/game/rating.ts: three happy moments, never after a hint, a
/// dead end, an ad or another prompt in the same session, never in the first session, ≥ 60 days
/// apart, ≤ 3 in 365 days). JS: src/native/review.ts → `request()`. No load(): nothing at launch.
@objc(ReviewPromptPlugin)
public class ReviewPromptPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReviewPromptPlugin"
    public let jsName = "ReviewPrompt"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
    ]

    @objc func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // the foreground-active scene of this app (the prompt needs one)
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
            guard let scene else {
                call.resolve(["requested": false, "reason": "no-active-scene"])
                return
            }
            AppStore.requestReview(in: scene)
            call.resolve(["requested": true])
        }
    }
}
