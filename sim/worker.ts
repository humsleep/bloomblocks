import { parentPort, workerData } from "node:worker_threads";
import { runChunk } from "./registry.ts";
import type { ChunkJob } from "./types.ts";

parentPort!.postMessage(runChunk(workerData as ChunkJob));
