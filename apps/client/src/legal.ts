// Store-facing legal / support URLs — THE one place (App Store Connect uses the same values).
// App Review 5.1.1(i): the privacy policy must be linked in App Store Connect AND reachable inside
// the app (Settings sheet → privacy policy row, src/game/SettingsSheet.ts). The pages are NOT
// published yet: the pages are prepared in the owner's site repo humsleep/apps (apps/duskwick/, docs/web/README.md).
// scripts/release-gates.mjs parses these two string literals (https, no placeholder) — keep them flat.
export const PRIVACY_POLICY_URL = "https://humsleep.github.io/apps/duskwick/privacy/";
export const SUPPORT_URL = "https://humsleep.github.io/apps/duskwick/";
