import Capacitor
import Foundation
import UIKit

/// App-local plugin: iCloud key-value store (NSUbiquitousKeyValueStore) for the silent
/// progress mirror (docs/phase2-plan.md "Phase 4 — iCloud sync"; JS: src/native/cloudkv.ts).
///   getAll()            → { available, values: {key: string} }   available = ubiquityIdentityToken != nil
///   set({key, value})   → write, then a coalesced synchronize() ~1 s later (and on resign-active)
///   remove({key})       → same
///   synchronize()       → { ok }   (false = no iCloud account / entitlement missing)
///   'change' event      → { reason: 'server'|'initialSync'|'quota'|'account', keys: [String] }
///                         ('account' from NSUbiquityIdentityDidChange carries keys: [] → call getAll)
/// Cold start: load() does nothing. The store, its observers and the first synchronize()
/// start on the first JS call (sync module is a dynamic import after first paint).
/// All state is touched on the main queue; KVS itself is thread-safe.
/// Limits (Apple): 1 MB total, 1024 keys, key ≤ 64 bytes UTF-8. The contract's per-value hard
/// cap (64 KB) is also enforced here so a bad caller cannot eat the whole quota.
@objc(CloudKVPlugin)
public class CloudKVPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudKVPlugin"
    public let jsName = "CloudKV"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "synchronize", returnType: CAPPluginReturnPromise),
    ]

    static let maxKeyBytes = 64
    static let maxValueBytes = 64 * 1024

    private var started = false
    private var pendingSync: DispatchWorkItem?
    private var store: NSUbiquitousKeyValueStore { NSUbiquitousKeyValueStore.default }

    deinit { NotificationCenter.default.removeObserver(self) }

    /// Main queue. Observers first, then synchronize() so the initial-sync notification
    /// (fresh install / new device) cannot be missed.
    private func startIfNeeded() {
        guard !started else { return }
        started = true
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(storeChanged(_:)),
                       name: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: store)
        nc.addObserver(self, selector: #selector(identityChanged(_:)),
                       name: .NSUbiquityIdentityDidChange, object: nil)
        nc.addObserver(self, selector: #selector(flushPending),
                       name: UIApplication.willResignActiveNotification, object: nil)
        store.synchronize()
    }

    private func onMain(_ call: CAPPluginCall, _ body: @escaping () -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return call.reject("plugin released") }
            self.startIfNeeded()
            body()
        }
    }

    // MARK: JS methods

    @objc func getAll(_ call: CAPPluginCall) {
        onMain(call) {
            let available = FileManager.default.ubiquityIdentityToken != nil
            var values: [String: String] = [:]
            for (k, v) in self.store.dictionaryRepresentation {
                if let s = v as? String { values[k] = s } // this app only ever writes strings
            }
            call.resolve(["available": available, "values": values])
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), Self.validKey(key) else {
            return call.reject("invalid key (1…\(Self.maxKeyBytes) UTF-8 bytes)", "BAD_KEY")
        }
        guard let value = call.getString("value") else { return call.reject("value must be a string", "BAD_VALUE") }
        guard value.utf8.count <= Self.maxValueBytes else {
            return call.reject("value exceeds \(Self.maxValueBytes) bytes", "TOO_LARGE")
        }
        onMain(call) {
            self.store.set(value, forKey: key)
            self.scheduleSync()
            call.resolve()
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), Self.validKey(key) else {
            return call.reject("invalid key", "BAD_KEY")
        }
        onMain(call) {
            self.store.removeObject(forKey: key)
            self.scheduleSync()
            call.resolve()
        }
    }

    @objc func synchronize(_ call: CAPPluginCall) {
        onMain(call) {
            self.pendingSync?.cancel()
            self.pendingSync = nil
            call.resolve(["ok": self.store.synchronize()])
        }
    }

    // MARK: lazy synchronize

    /// Writes land in the in-memory store immediately; synchronize() only flushes to disk and
    /// tells the daemon there is something to upload. Coalesce bursts into one call.
    private func scheduleSync() {
        pendingSync?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.pendingSync = nil
            self.store.synchronize()
        }
        pendingSync = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: work)
    }

    @objc private func flushPending() {
        DispatchQueue.main.async { [weak self] in
            guard let self, let work = self.pendingSync else { return }
            work.cancel()
            self.pendingSync = nil
            self.store.synchronize()
        }
    }

    // MARK: notifications → 'change'

    @objc private func storeChanged(_ note: Notification) {
        let info = note.userInfo ?? [:]
        let reasonCode = (info[NSUbiquitousKeyValueStoreChangeReasonKey] as? NSNumber)?.intValue ?? -1
        let keys = (info[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String]) ?? []
        let reason: String
        switch reasonCode {
        case NSUbiquitousKeyValueStoreServerChange: reason = "server"
        case NSUbiquitousKeyValueStoreInitialSyncChange: reason = "initialSync"
        case NSUbiquitousKeyValueStoreQuotaViolationChange: reason = "quota"
        case NSUbiquitousKeyValueStoreAccountChange: reason = "account"
        default: return
        }
        emit(reason, keys)
    }

    @objc private func identityChanged(_ note: Notification) {
        emit("account", [])
    }

    private func emit(_ reason: String, _ keys: [String]) {
        DispatchQueue.main.async { [weak self] in
            // Retained until the JS listener attaches (getAll may run before addListener).
            self?.notifyListeners("change", data: ["reason": reason, "keys": keys], retainUntilConsumed: true)
        }
    }

    static func validKey(_ k: String) -> Bool {
        let n = k.utf8.count
        return n > 0 && n <= maxKeyBytes
    }
}
