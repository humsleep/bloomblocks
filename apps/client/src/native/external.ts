// Opens a web page OUTSIDE the app (Safari) — never inside the game's WebView (no in-app browsing).
// iOS: a top-level navigation to a non-app URL is cancelled by Capacitor's WebViewDelegationHandler
// (decidePolicyFor) and handed to UIApplication.open, so Safari opens and the game page stays as it
// was (the policy check runs before any unload). Browser (dev / e2e): a new tab.
import { Capacitor } from "@capacitor/core";

export function openExternal(url: string): void {
  if (!/^https:\/\//.test(url)) return;
  try {
    if (Capacitor.isNativePlatform()) window.location.assign(url);
    else window.open(url, "_blank", "noopener");
  } catch (e) {
    console.warn("[external] open failed", e);
  }
}
