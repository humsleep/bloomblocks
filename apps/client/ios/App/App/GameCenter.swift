import Capacitor
import Foundation
import GameKit
import UIKit

/// R4 rankings: Game Center, opt-in. Nothing happens at launch unless the player turned rankings on earlier
/// (JS calls `authenticate` after the first frame then). The first sign-in is always the player's own tap on
/// the result sheet's trophy. Leaderboard ids and when scores are sent: src/game/ranking.ts.
/// JS: src/native/gamecenter.ts. No load(): GameKit is untouched until a call.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
    ]

    private var pending: [CAPPluginCall] = []
    private var handlerSet = false

    /// Signs the local player in (Apple's own sheet when needed). Resolves { authenticated }.
    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let local = GKLocalPlayer.local
            if local.isAuthenticated {
                call.resolve(["authenticated": true])
                return
            }
            self.pending.append(call)
            if self.handlerSet { return }
            self.handlerSet = true
            local.authenticateHandler = { [weak self] vc, error in
                guard let self else { return }
                if let vc {
                    self.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                let ok = GKLocalPlayer.local.isAuthenticated
                if let error { NSLog("[gamecenter] auth: %@", error.localizedDescription) }
                let calls = self.pending
                self.pending = []
                for c in calls { c.resolve(["authenticated": ok]) }
            }
        }
    }

    /// Submits one score: { id, score, context? }. Resolves { submitted }; never rejects.
    @objc func submit(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let score = call.getInt("score") else {
            call.resolve(["submitted": false, "reason": "bad-args"])
            return
        }
        let context = call.getInt("context") ?? 0
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["submitted": false, "reason": "not-signed-in"])
            return
        }
        GKLeaderboard.submitScore(score, context: context, player: GKLocalPlayer.local, leaderboardIDs: [id]) { error in
            if let error { NSLog("[gamecenter] submit %@: %@", id, error.localizedDescription) }
            call.resolve(["submitted": error == nil])
        }
    }

    /// Opens Apple's leaderboard screen on one board ({ id }), today's scores first.
    @objc func show(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.resolve(["shown": false])
            return
        }
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated, let host = self.bridge?.viewController else {
                call.resolve(["shown": false])
                return
            }
            let vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .today)
            vc.gameCenterDelegate = self
            host.present(vc, animated: true)
            call.resolve(["shown": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
