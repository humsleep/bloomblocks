// save/store.ts: one serial write queue, errors logged (never thrown into gameplay),
// temp + rename atomic writes, and the read fallback to the temp file.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendText, bytesToBase64, enqueue, flush, readAtomicText, readText, writeAtomic } from "../src/save/store.ts";
import { fakeBackend, readFile, resetDevice, writeFile } from "./helpers.ts";

beforeEach(() => resetDevice());

describe("write queue", () => {
  it("runs jobs strictly in order, even when an earlier one is slower", async () => {
    const order: string[] = [];
    void enqueue("slow", () => new Promise((r) => setTimeout(() => r(order.push("slow")), 30)));
    void enqueue("fast", async () => order.push("fast"));
    await flush();
    expect(order).toEqual(["slow", "fast"]);
  });

  it("a failing job is logged and the queue keeps going", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const order: string[] = [];
    const p = enqueue("boom", async () => {
      throw new Error("disk full");
    });
    void enqueue("after", async () => order.push("after"));
    await expect(p).resolves.toBeUndefined();
    await flush();
    expect(order).toEqual(["after"]);
    expect(warn).toHaveBeenCalledWith("[store] boom failed", expect.any(Error));
  });

  it("appends land in order", async () => {
    await writeAtomic("j.log", "H\n");
    for (let k = 0; k < 20; k++) void enqueue("append", () => appendText("j.log", `${k}\n`));
    await flush();
    expect(readFile("j.log")).toBe(`H\n${Array.from({ length: 20 }, (_, k) => `${k}\n`).join("")}`);
  });
});

describe("atomic writes", () => {
  it("temp + rename: no temp left, content replaced", async () => {
    await writeAtomic("p.json", "1");
    await writeAtomic("p.json", "2");
    expect(readFile("p.json")).toBe("2");
    expect(readFile("p.json.tmp")).toBeNull();
  });

  it("creates the parent directories (runs/)", async () => {
    await writeAtomic("runs/a.bin", bytesToBase64(Uint8Array.of(1, 2, 255)), true);
    const f = fakeBackend.files.get("LIBRARY/lanternly/runs/a.bin")!;
    expect(f.enc).toBe("base64");
    expect(atob(f.data)).toBe("\u0001\u0002ÿ");
  });

  it("killed between temp write and rename: the old file wins, and a missing final falls back to the temp", async () => {
    await writeAtomic("p.json", "old");
    fakeBackend.failNext("rename");
    await expect(writeAtomic("p.json", "new")).rejects.toThrow();
    expect(await readAtomicText("p.json")).toBe("old");
    fakeBackend.files.delete("LIBRARY/lanternly/p.json");
    expect(await readAtomicText("p.json")).toBe("new");
  });

  it("missing files read as null, never throw", async () => {
    expect(await readText("nope")).toBeNull();
    expect(await readAtomicText("nope")).toBeNull();
    fakeBackend.failNext("readFile");
    writeFile("x", "1");
    expect(await readText("x")).toBeNull();
  });
});

describe("bytesToBase64", () => {
  it("matches Buffer for random bytes", () => {
    for (let n = 0; n < 70; n += 7) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
      expect(bytesToBase64(b)).toBe(Buffer.from(b).toString("base64"));
    }
  });
});
