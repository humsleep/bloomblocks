// Fake @capacitor/filesystem (tests / e2e only). Semantics follow the native plugin
// where the app relies on them:
//   readFile    missing file → rejects ("File does not exist")
//   writeFile   missing parent directory → rejects unless recursive: true
//   appendFile  creates the file when missing (iOS/Android do); parent must exist
//   rename      overwrites the destination (POSIX rename); missing source → rejects
// Paths are keyed "<DIRECTORY>/<path>".
import { type FakeFile, fakeBackend, maybeFail } from "./backend.ts";

export enum Directory {
  Documents = "DOCUMENTS",
  Data = "DATA",
  Library = "LIBRARY",
  Cache = "CACHE",
  External = "EXTERNAL",
  ExternalStorage = "EXTERNAL_STORAGE",
  LibraryNoCloud = "LIBRARY_NO_CLOUD",
}

export enum Encoding {
  UTF8 = "utf8",
  ASCII = "ascii",
  UTF16 = "utf16",
}

interface PathOpts {
  path: string;
  directory?: Directory | string;
}
interface WriteOpts extends PathOpts {
  data: string | Blob;
  encoding?: Encoding | string;
  recursive?: boolean;
}

const key = (o: PathOpts): string => `${o.directory ?? "NONE"}/${o.path.replace(/^\/+/, "")}`;
const parentOf = (k: string): string => k.slice(0, k.lastIndexOf("/"));

const dirs = new Set<string>();

function dirExists(dir: string): boolean {
  // A directory "exists" if it was created, or any file lives under it, or it is a root.
  if (!dir.includes("/")) return true;
  if (dirs.has(dir)) return true;
  for (const k of fakeBackend.files.keys()) if (k.startsWith(`${dir}/`)) return true;
  return false;
}

function mkdirs(dir: string): void {
  let d = dir;
  while (d.includes("/")) {
    dirs.add(d);
    d = parentOf(d);
  }
}

function asString(data: string | Blob): string {
  if (typeof data !== "string") throw new Error("fake filesystem: Blob data not supported");
  return data;
}

export const Filesystem = {
  async readFile(o: PathOpts & { encoding?: Encoding | string }): Promise<{ data: string }> {
    const k = key(o);
    maybeFail("readFile", k);
    const f = fakeBackend.files.get(k);
    if (!f) throw new Error("File does not exist.");
    if (o.encoding) return { data: f.enc === "utf8" ? f.data : atob(f.data) };
    // no encoding → base64, like the native plugin
    return { data: f.enc === "base64" ? f.data : btoa(f.data) };
  },

  async writeFile(o: WriteOpts): Promise<{ uri: string }> {
    const k = key(o);
    maybeFail("writeFile", k);
    const parent = parentOf(k);
    if (!dirExists(parent)) {
      if (!o.recursive) throw new Error(`Parent directory must exist (${parent})`);
      mkdirs(parent);
    }
    const file: FakeFile = { data: asString(o.data), enc: o.encoding ? "utf8" : "base64", mtime: Date.now() };
    fakeBackend.files.set(k, file);
    fakeBackend.persist();
    return { uri: `fake://${k}` };
  },

  async appendFile(o: WriteOpts): Promise<void> {
    const k = key(o);
    maybeFail("appendFile", k);
    const parent = parentOf(k);
    if (!dirExists(parent)) {
      if (!o.recursive) throw new Error(`Parent directory must exist (${parent})`);
      mkdirs(parent);
    }
    const prev = fakeBackend.files.get(k);
    const add = asString(o.data);
    if (!prev) fakeBackend.files.set(k, { data: add, enc: o.encoding ? "utf8" : "base64", mtime: Date.now() });
    else if (prev.enc === "utf8" && o.encoding) {
      prev.data += add;
      prev.mtime = Date.now();
    }
    else throw new Error("fake filesystem: mixed-encoding append not supported");
    fakeBackend.persist();
  },

  async rename(o: { from: string; to: string; directory?: Directory | string; toDirectory?: Directory | string }): Promise<void> {
    const from = key({ path: o.from, ...(o.directory ? { directory: o.directory } : {}) });
    const to = key({ path: o.to, directory: o.toDirectory ?? o.directory ?? "NONE" });
    maybeFail("rename", `${from} -> ${to}`);
    const f = fakeBackend.files.get(from);
    if (!f) throw new Error("File does not exist.");
    fakeBackend.files.delete(from);
    fakeBackend.files.set(to, f);
    fakeBackend.persist();
  },

  async deleteFile(o: PathOpts): Promise<void> {
    const k = key(o);
    maybeFail("deleteFile", k);
    if (!fakeBackend.files.delete(k)) throw new Error("File does not exist.");
    fakeBackend.persist();
  },

  async mkdir(o: PathOpts & { recursive?: boolean }): Promise<void> {
    mkdirs(key(o));
  },

  async readdir(o: PathOpts): Promise<{ files: Array<{ name: string; type: "file" | "directory" }> }> {
    const k = key(o).replace(/\/$/, "");
    const names = new Set<string>();
    for (const p of fakeBackend.files.keys()) if (p.startsWith(`${k}/`)) names.add(p.slice(k.length + 1).split("/")[0]!);
    return { files: [...names].sort().map((name) => ({ name, type: fakeBackend.files.has(`${k}/${name}`) ? "file" : "directory" })) };
  },

  async stat(o: PathOpts): Promise<{ type: "file"; size: number; uri: string; mtime?: number }> {
    const k = key(o);
    const f = fakeBackend.files.get(k);
    if (!f) throw new Error("File does not exist.");
    return { type: "file", size: f.data.length, uri: `fake://${k}`, ...(f.mtime !== undefined ? { mtime: f.mtime } : {}) };
  },
};

/** Test helper: full key of a file the app stores under Library/lanternly/. */
export const lanternlyPath = (name: string): string => `${Directory.Library}/lanternly/${name}`;
