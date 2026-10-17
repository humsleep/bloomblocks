// DEV ONLY: config for the lit-street harness (src/town/dev/index.html).
//   cd apps/client && npx vite --config src/town/dev/vite.config.ts --host --port 5180
// Same as ../../../vite.config.ts, plus the Phaser feature-flag transform applied
// to the dependency pre-bundle too (the dev server pre-bundles phaser-core
// without the app's plugin, which pulls in the WebGL debug require).
import { defineConfig, mergeConfig, type UserConfig } from "vite";
import base from "../../../vite.config.ts";

const FLAGS: Record<string, boolean> = {
  CANVAS_RENDERER: true,
  WEBGL_RENDERER: false,
  WEBGL_DEBUG: false,
  FEATURE_SOUND: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
};
const flagRe = new RegExp(`typeof (${Object.keys(FLAGS).join("|")})\\b`, "g");

export default defineConfig((env) => {
  const b = (typeof base === "function" ? base(env) : base) as UserConfig;
  return mergeConfig(b, {
    optimizeDeps: {
      rolldownOptions: {
        plugins: [
          {
            name: "phaser-flags-prebundle",
            transform(code: string, id: string) {
              if (!id.includes("/node_modules/phaser/src/")) return null;
              const out = code
                .replace(flagRe, (_m: string, f: string) => (FLAGS[f] ? '"boolean"' : "undefined"))
                .replace(/^global\.Phaser = Phaser;$/m, "globalThis.Phaser = Phaser;");
              return out === code ? null : { code: out, map: null };
            },
          },
        ],
      },
    },
  } as UserConfig);
});
