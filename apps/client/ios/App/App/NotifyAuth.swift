import Capacitor
import Foundation
import UserNotifications

/// Alert-only notification permission (docs/phase2-plan.md "Requests to N" #5, from U).
/// The stock @capacitor/local-notifications plugin asks for alert + sound + badge; the daily
/// reminder is a quiet banner, so the ONE system prompt is made here with `.alert` only. iOS
/// shows the prompt once per install: the stock plugin's later requests (with sound / badge)
/// do not prompt again and do not add those options.
///   request() → { granted, status }   prompts only while status is "notDetermined"
///   status()  → { status }            never prompts
/// status: "notDetermined" | "denied" | "authorized" | "provisional" | "ephemeral"
/// No load(): nothing runs at launch. Local notifications need no Info.plist key / entitlement.
@objc(NotifyAuthPlugin)
public class NotifyAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NotifyAuthPlugin"
    public let jsName = "NotifyAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    private static func name(_ s: UNAuthorizationStatus) -> String {
        switch s {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "denied"
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            call.resolve(["status": Self.name(s.authorizationStatus)])
        }
    }

    @objc func request(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert]) { granted, error in
            if let error { NSLog("[notify] requestAuthorization: %@", error.localizedDescription) }
            center.getNotificationSettings { s in
                call.resolve(["granted": granted, "status": Self.name(s.authorizationStatus)])
            }
        }
    }
}
