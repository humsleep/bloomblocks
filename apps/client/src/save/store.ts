// Tiny file store on Capacitor Filesystem (Library/lanternly/…). Never
// localStorage (the OS may purge WebView storage). All writes go through one
// serial queue so per-move appends land in order.
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

const DIR = Directory.Library;
const ROOT = "lanternly";
const p = (name: string): string => `${ROOT}/${name}`;

let tail: Promise<unknown> = Promise.resolve();

/** Run `job` after every previously queued write. Errors are logged, never thrown into gameplay. */
export function enqueue(label: string, job: () => Promise<unknown>): Promise<void> {
  const next = tail.then(job).then(
    () => undefined,
    (e: unknown) => console.warn(`[store] ${label} failed`, e),
  );
  tail = next;
  return next;
}

/** Resolves when every queued write so far has finished. */
export function flush(): Promise<void> {
  return tail.then(() => undefined);
}

export async function readText(name: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({ path: p(name), directory: DIR, encoding: Encoding.UTF8 });
    return typeof r.data === "string" ? r.data : await r.data.text();
  } catch {
    return null;
  }
}

/**
 * Read a file written by writeAtomic. If the final name is missing but the
 * temp file exists (killed between the two steps of a non-atomic rename),
 * fall back to the temp file.
 */
export async function readAtomicText(name: string): Promise<string | null> {
  return (await readAtomic(name)).text;
}

/**
 * readAtomicText + where the text came from. `fromTmp` = the final file was missing and the
 * temp file was used (iOS rename = delete target, then move: a kill between the two leaves only
 * the .tmp). A caller that APPENDS to the file must rewrite it atomically first — an append would
 * otherwise create a new, partial final file next to the stranded .tmp.
 */
export async function readAtomic(name: string): Promise<{ text: string | null; fromTmp: boolean }> {
  const main = await readText(name);
  if (main !== null) return { text: main, fromTmp: false };
  const tmp = await readText(`${name}.tmp`);
  return { text: tmp, fromTmp: tmp !== null };
}

export async function appendText(name: string, data: string): Promise<void> {
  await Filesystem.appendFile({ path: p(name), directory: DIR, data, encoding: Encoding.UTF8 });
}

/** Temp file + rename. `base64` = binary payload already base64-encoded. */
export async function writeAtomic(name: string, data: string, base64 = false): Promise<void> {
  const tmp = `${name}.tmp`;
  await Filesystem.writeFile({
    path: p(tmp),
    directory: DIR,
    data,
    recursive: true,
    ...(base64 ? {} : { encoding: Encoding.UTF8 }),
  });
  await Filesystem.rename({ from: p(tmp), to: p(name), directory: DIR, toDirectory: DIR });
}

export function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s);
}

/** File names in a directory under the root ([] when it is missing). */
export async function listDir(name: string): Promise<string[]> {
  try {
    const r = await Filesystem.readdir({ path: p(name), directory: DIR });
    return r.files.map((f) => (typeof f === "string" ? f : f.name));
  } catch {
    return [];
  }
}

/** Modification time (ms) of a file, null when missing or unknown. */
export async function mtimeOf(name: string): Promise<number | null> {
  try {
    const r = (await Filesystem.stat({ path: p(name), directory: DIR })) as { mtime?: number | string };
    const t = Number(r.mtime);
    return Number.isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
}
