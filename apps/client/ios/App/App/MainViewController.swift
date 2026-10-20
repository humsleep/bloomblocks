import Capacitor
import UIKit
import WebKit

/// Root VC: registers the app-local plugins (A11yPrefs, CloudKV, AdAudio, NotifyAuth, ReviewPrompt, GameCenter; ColdStartProbe only in
/// Debug/Measure builds) and keeps the WebView
/// a fixed, non-scrolling game surface.
class MainViewController: CAPBridgeViewController {
    /// Runs at the end of loadView, before viewDidLoad starts the first navigation.
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(A11yPrefsPlugin())
        bridge?.registerPluginInstance(CloudKVPlugin()) // load() is empty; KVS starts on first JS call
        bridge?.registerPluginInstance(AdAudioPlugin()) // no load(); touches GMA only on configure()
        bridge?.registerPluginInstance(NotifyAuthPlugin()) // no load(); prompts only on request()
        bridge?.registerPluginInstance(ReviewPromptPlugin()) // no load(); the system rating sheet only on request()
        bridge?.registerPluginInstance(GameCenterPlugin()) // no load(); GameKit only when the player turned rankings on
        #if PERF_PROBE
        bridge?.registerPluginInstance(ColdStartProbe())
        #endif
        // WKWebView reports env(safe-area-inset-*) = 0 until after first layout, which
        // would make the first board frame overlap the home indicator. Hand the
        // window's insets to CSS at document start (--safe-*); index.html uses
        // max(env(), var()) so nothing moves once env() catches up.
        let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        let i = scene?.windows.first?.safeAreaInsets ?? .zero
        let js = "var s=document.documentElement.style;s.setProperty('--safe-top','\(i.top)px');s.setProperty('--safe-bottom','\(i.bottom)px');s.setProperty('--safe-left','\(i.left)px');s.setProperty('--safe-right','\(i.right)px');"
        webView?.configuration.userContentController.addUserScript(
            WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        NSLog("[safe] insets top=%.0f bottom=%.0f", i.top, i.bottom)
    }

    /// UX P2-16: the launch image (LaunchDusk) stays visible behind a transparent WebView
    /// until the page has painted, so launch screen → page → first canvas frame never
    /// flashes the flat background colour. Called by SceneDelegate right after
    /// makeKeyAndVisible (before the first commit). The WebView becomes opaque again and
    /// the image view is released a few seconds later (no blending cost while playing).
    private var backdrop: UIImageView?
    func installLaunchBackdrop(in window: UIWindow) {
        guard let web = webView, let image = UIImage(named: "LaunchDusk") else { return }
        let iv = UIImageView(image: image)
        iv.contentMode = .scaleToFill
        iv.frame = window.bounds
        iv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        window.insertSubview(iv, at: 0)
        backdrop = iv
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            guard let self, let web = self.webView else { return }
            let bg = UIColor(red: 0.0588, green: 0.0706, blue: 0.1333, alpha: 1) // capacitor.config backgroundColor
            web.backgroundColor = bg
            web.scrollView.backgroundColor = bg
            web.isOpaque = true
            self.backdrop?.removeFromSuperview()
            self.backdrop = nil
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let sv = webView?.scrollView else { return }
        sv.bounces = false
        sv.alwaysBounceVertical = false
        sv.contentInsetAdjustmentBehavior = .never // CSS handles insets
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
