// Store-facing legal / support URLs — THE one place (App Store Connect uses the same values).
// App Review 5.1.1(i): the privacy policy must be linked in App Store Connect AND reachable inside
// the app (Settings sheet → privacy policy row, src/game/SettingsSheet.ts). The pages are NOT
// published yet: the text is in docs/app-store-connect-pack.md (developer's own GitHub Pages).
// scripts/release-gates.mjs parses these two string literals (https, no placeholder) — keep them flat.
export const PRIVACY_POLICY_URL = "https://humsleep.github.io/duskwick/privacy";
export const SUPPORT_URL = "https://humsleep.github.io/duskwick/support";
