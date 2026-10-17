// Generates the next level of a track (or today's daily) off the main thread
// (the generator can take tens of ms on older phones; on the main thread that
// would hitch the completion / switch animation). Same deterministic code as the main thread.
import { levelForDaily, levelForTrack, type Track } from "./pipsApi.ts";

self.onmessage = (e: MessageEvent<{ track?: Track; n?: number; daily?: string }>) => {
  const { track, n, daily } = e.data;
  try {
    if (daily) self.postMessage({ daily, level: levelForDaily(daily) });
    else self.postMessage({ track, n, level: levelForTrack(track!, n!) });
  } catch (err) {
    self.postMessage(daily ? { daily, error: String(err) } : { track, n, error: String(err) });
  }
};
