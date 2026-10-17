import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Phaser "custom build" without webpack: we import phaser/src/phaser-core.js
 * (no physics, no tilemaps, no bitmap text…) and resolve Phaser's compile-time
 * feature flags the same way its webpack DefinePlugin does. Canvas renderer
 * only (no WebGL shader compile at startup), no Phaser sound (Sfx uses WebAudio
 * directly), no FB Instant / Camera3D plugins.
 */
const PHASER_FLAGS: Record<string, boolean> = {
  CANVAS_RENDERER: true,
  WEBGL_RENDERER: false,
  WEBGL_DEBUG: false,
  FEATURE_SOUND: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
};

function phaserCustomBuild(): Plugin {
  const flagRe = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join("|")})\\b`, "g");
  return {
    name: "phaser-custom-build",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/node_modules/phaser/src/")) return null;
      let out = code.replace(flagRe, (_m, flag: string) => (PHASER_FLAGS[flag] ? '"boolean"' : "undefined"));
      // `global` does not exist in a browser; the entry assigns window.Phaser.
      out = out.replace(/^global\.Phaser = Phaser;$/m, "globalThis.Phaser = Phaser;");
      return out === code ? null : { code: out, map: null };
    },
  };
}

/**
 * Dev server fix: `vite` pre-bundles phaser-core with rolldown *without* the plugin
 * above, so the WebGL debug branch survives and its `require("phaser3spectorjs")`
 * breaks the page. Apply the same flag transform to the dependency pre-bundle.
 */
function phaserPrebundleFlags(): { name: string; transform(code: string, id: string): { code: string; map: null } | null } {
  const p = phaserCustomBuild();
  return {
    name: "phaser-flags-prebundle",
    transform(code: string, id: string) {
      return (p.transform as (c: string, i: string) => { code: string; map: null } | null)(code, id);
    },
  };
}

/**
 * Test mode (`--mode e2e`, Playwright only): @capacitor/* plugins are replaced by the
 * in-memory fakes in tests/fakes (mirrored to localStorage, so a reload = a relaunch),
 * and e2e/bridge.ts is loaded before the app to expose the running Phaser game to tests
 * (window.__e2e). Nothing of this exists in the m0 / m1 builds.
 */
const CAP_FAKES = ["app", "filesystem", "haptics", "preferences", "share"] as const;

function e2eBridge(): Plugin {
  return {
    name: "e2e-bridge",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string) => html.replace('<script type="module" src="/src/main.ts"></script>', '<script type="module" src="/e2e/bridge.ts"></script>\n    <script type="module" src="/src/main.ts"></script>'),
    },
  };
}

// build:m0 → empty WebView floor page (m0/index.html). build:m1 → the real shell.
export default defineConfig(({ mode }) => {
  const m0 = mode === "m0";
  const e2e = mode === "e2e";
  return {
    root: m0 ? here("./m0") : here("."),
    base: "./",
    publicDir: m0 ? false : here("./public"),
    plugins: [phaserCustomBuild(), ...(e2e ? [e2eBridge()] : [])],
    resolve: {
      alias: [
        { find: "@core", replacement: here("../../core") },
        { find: "@games", replacement: here("../../games") },
        ...(e2e ? CAP_FAKES.map((n) => ({ find: new RegExp(`^@capacitor/${n}$`), replacement: here(`./tests/fakes/${n}.ts`) })) : []),
      ],
    },
    optimizeDeps: {
      // only the app's own entry (build/ holds copies of index.html inside the iOS .app bundles)
      entries: ["index.html"],
      rolldownOptions: { plugins: [phaserPrebundleFlags()] },
    },
    define: {
      __VARIANT__: JSON.stringify(m0 ? "m0" : "m1"),
    },
    build: {
      // the e2e build never overwrites dist/ (that one is what cap sync ships); build/ is git-ignored
      outDir: e2e ? here("./build/e2e-web") : here("./dist"),
      emptyOutDir: true,
      // WKWebView on iOS 17+: modern syntax is fine and smaller.
      target: "safari17",
      assetsInlineLimit: 0,
      modulePreload: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1200,
    },
    server: {
      fs: { allow: [here("../..")] },
      // Xcode build products, the native project and build outputs are not app sources
      watch: { ignored: ["**/build/**", "**/ios/**", "**/dist/**", "**/test-results/**"] },
    },
  };
});
