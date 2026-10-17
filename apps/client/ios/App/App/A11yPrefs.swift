import Capacitor
import UIKit

/// App-local plugin: the iOS accessibility settings the WebView cannot see (or sees late).
/// JS: registerPlugin('A11yPrefs') → get() and the 'change' event, both with
///   { contentSizeCategory: "XS"|"S"|"M"|"L"|"XL"|"XXL"|"XXXL"|"AX1"…"AX5",
///     fontScale: Number   // body-text scale vs. the default size "L" (1.0), via UIFontMetrics
///     boldText, increaseContrast, reduceMotion, voiceOver: Bool,
///     language?: String  // Locale.preferredLanguages[0], e.g. "ko-KR", "pt-BR" (absent if unknown) }
/// Registered in MainViewController.capacitorDidLoad. Observers are added in load() and
/// only post to JS when a listener exists; bursts (e.g. the Settings app toggling several
/// switches) are coalesced into one 'change' 150 ms after the last notification.
@objc(A11yPrefsPlugin)
public class A11yPrefsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "A11yPrefsPlugin"
    public let jsName = "A11yPrefs"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)]

    private var pending: DispatchWorkItem?
    private var last: [String: Any]?

    override public func load() {
        let names: [Notification.Name] = [
            UIContentSizeCategory.didChangeNotification,
            UIAccessibility.boldTextStatusDidChangeNotification,
            UIAccessibility.darkerSystemColorsStatusDidChangeNotification,
            UIAccessibility.reduceMotionStatusDidChangeNotification,
            UIAccessibility.voiceOverStatusDidChangeNotification,
            NSLocale.currentLocaleDidChangeNotification,
        ]
        for n in names {
            NotificationCenter.default.addObserver(self, selector: #selector(changed), name: n, object: nil)
        }
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(Self.snapshot()) }
    }

    @objc private func changed() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.pending?.cancel()
            let work = DispatchWorkItem { [weak self] in
                guard let self else { return }
                let now = Self.snapshot()
                if let last = self.last, NSDictionary(dictionary: last).isEqual(to: now) { return }
                self.last = now
                self.notifyListeners("change", data: now)
            }
            self.pending = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: work)
        }
    }

    /// Main thread only (UIApplication / UIAccessibility).
    static func snapshot() -> [String: Any] {
        let cat = UIApplication.shared.preferredContentSizeCategory
        let traits = UITraitCollection(preferredContentSizeCategory: cat)
        let base: CGFloat = 17 // UIFont.TextStyle.body at the default "L" category
        let scaled = UIFontMetrics(forTextStyle: .body).scaledValue(for: base, compatibleWith: traits)
        let fontScale = (Double(scaled / base) * 1000).rounded() / 1000
        var out: [String: Any] = [
            "contentSizeCategory": shortName(cat),
            "fontScale": fontScale,
            "boldText": UIAccessibility.isBoldTextEnabled,
            "increaseContrast": UIAccessibility.isDarkerSystemColorsEnabled,
            "reduceMotion": UIAccessibility.isReduceMotionEnabled,
            "voiceOver": UIAccessibility.isVoiceOverRunning,
        ]
        if let lang = Locale.preferredLanguages.first { out["language"] = lang }
        return out
    }

    static func shortName(_ c: UIContentSizeCategory) -> String {
        switch c {
        case .extraSmall: return "XS"
        case .small: return "S"
        case .medium: return "M"
        case .large: return "L"
        case .extraLarge: return "XL"
        case .extraExtraLarge: return "XXL"
        case .extraExtraExtraLarge: return "XXXL"
        case .accessibilityMedium: return "AX1"
        case .accessibilityLarge: return "AX2"
        case .accessibilityExtraLarge: return "AX3"
        case .accessibilityExtraExtraLarge: return "AX4"
        case .accessibilityExtraExtraExtraLarge: return "AX5"
        default: return "L"
        }
    }
}
