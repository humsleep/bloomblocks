// JS side of the app-local ColdStartProbe plugin (ios/App/App/ColdStartProbe.swift).
// The native plugin exists only in Debug and Measure builds (PERF_PROBE); in Release /
// App Store builds mark() rejects or falls back to the web stub — both are silent no-ops.
import { registerPlugin } from "@capacitor/core";

interface ColdStartProbePlugin {
  mark(o: { variant: string; webMs: number }): Promise<{ ms: number; prewarm?: boolean }>;
}

export const ColdStartProbe = registerPlugin<ColdStartProbePlugin>("ColdStartProbe", {
  web: {
    mark: async (o: { variant: string; webMs: number }) => {
      console.info(`[probe] web mark ${o.variant} at ${o.webMs.toFixed(0)} ms since navigation`);
      return { ms: o.webMs };
    },
  },
});

/** End of cold start: call once the board is drawn and input is enabled. Two rAFs = presented frame. */
export function markInteractive(variant: string): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      ColdStartProbe.mark({ variant, webMs: performance.now() }).then(
        (r) => console.info(`[probe] ${variant} tap→interactive ${r.ms} ms`),
        () => undefined, // Release build: no native probe
      );
    }),
  );
}
