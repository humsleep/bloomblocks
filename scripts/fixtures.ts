// npm run fixtures — regenerate golden fixtures. Only run after an
// INTENDED rules/format change, then review `git diff fixtures/` (see CLAUDE.md).

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLanternsFixture, lanternsFixtureInputs, lanternsRejectFixtures, rngFixture } from "./fixtureLib.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const write = (path: string, data: unknown): void => writeFileSync(path, JSON.stringify(data, null, 2) + "\n");

const coreDir = join(root, "fixtures", "core");
mkdirSync(coreDir, { recursive: true });
write(join(coreDir, "rng.json"), rngFixture());

const dir = join(root, "fixtures", "lanterns");
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.endsWith(".json")) rmSync(join(dir, f));
const inputs = lanternsFixtureInputs();
for (const input of inputs) write(join(dir, `${input.name}.json`), buildLanternsFixture(input));

const rejectDir = join(dir, "reject");
mkdirSync(rejectDir, { recursive: true });
for (const f of readdirSync(rejectDir)) if (f.endsWith(".json")) rmSync(join(rejectDir, f));
const rejects = lanternsRejectFixtures();
for (const r of rejects) write(join(rejectDir, `${r.name}.json`), r);
console.log(`wrote fixtures/core/rng.json, ${inputs.length} fixtures to fixtures/lanterns/ and ${rejects.length} to fixtures/lanterns/reject/`);
