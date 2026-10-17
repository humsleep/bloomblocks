import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync } from "node:fs";

// App identity lives in app.identity.json only (see the note there).
const identity = JSON.parse(readFileSync(new URL("./app.identity.json", import.meta.url), "utf8")) as {
  bundleId: string;
  appName: string;
};
const BG = "#0f1222";

const config: CapacitorConfig = {
  appId: identity.bundleId,
  appName: identity.appName,
  webDir: "dist",
  backgroundColor: BG,
  // Fully bundled offline app: no server.url, no remote content.
  ios: {
    contentInset: "never",
    scrollEnabled: false, // no WKWebView rubber-band
    allowsLinkPreview: false, // no long-press link previews
    backgroundColor: BG,
    preferredContentMode: "mobile",
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
