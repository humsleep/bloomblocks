import AVFoundation
import Capacitor
import Foundation
import GoogleMobileAds

/// Ad sound rules (docs/ads-plan.md §9-4; r6: "ad sound = uninstall", 8/8).
///   • The app's AVAudioSession is `.ambient`: the Ring/Silent switch silences the game AND ads,
///     and the player's own music keeps playing (mixes). Set at launch (AppDelegate, off the main
///     thread) and again right before the ads SDK starts.
///   • GMA is told the app manages the session (`isAudioSessionApplicationManaged = true`), so a
///     video ad cannot switch it to `.soloAmbient` and play through other audio.
///   • The game's mute toggle goes to `MobileAds.shared.isApplicationMuted` (video ads start muted;
///     muted-ineligible video demand is not requested).
/// JS: src/native/adAudio.ts → `configure({ muted })`, called by src/ads/AdMobAds.ts before
/// `AdMob.initialize` and on every mute change. Touching `MobileAds.shared` happens only here,
/// i.e. after the first move, never on the cold-start path.
/// VERIFY ON DEVICE (simulator has no silent switch): src/ads/README.md "Device checks".
enum AppAudioSession {
    static func setAmbient() {
        do {
            let s = AVAudioSession.sharedInstance()
            if s.category != .ambient { try s.setCategory(.ambient, mode: .default, options: []) }
        } catch {
            NSLog("[audio] setCategory(.ambient) failed: %@", error.localizedDescription)
        }
    }
}

@objc(AdAudioPlugin)
public class AdAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AdAudioPlugin"
    public let jsName = "AdAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buildKind", returnType: CAPPluginReturnPromise),
    ]

    /// Real (non-test) ads only when this is true: a Release configuration on a device. Debug,
    /// the Measure configs (PERF_PROBE) and the simulator are never "release". The web bundle is
    /// identical in all of them, so this is the only trustworthy signal (src/ads/AdMobAds.ts).
    @objc func buildKind(_ call: CAPPluginCall) {
        #if DEBUG || PERF_PROBE || targetEnvironment(simulator)
        NSLog("[ads] buildKind release=false")
        call.resolve(["release": false])
        #else
        NSLog("[ads] buildKind release=true")
        call.resolve(["release": true])
        #endif
    }

    @objc func configure(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        // AudioVideoManager must be accessed on the main thread (GMA header)
        DispatchQueue.main.async {
            AppAudioSession.setAmbient()
            let ads = MobileAds.shared
            ads.audioVideoManager.isAudioSessionApplicationManaged = true
            ads.isApplicationMuted = muted
            call.resolve([
                "category": AVAudioSession.sharedInstance().category.rawValue,
                "applicationManaged": ads.audioVideoManager.isAudioSessionApplicationManaged,
                "muted": ads.isApplicationMuted,
            ])
        }
    }
}
