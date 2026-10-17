// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createA11y, readingOrder, type A11y, type A11yBoard, type A11yControl, type A11yOptions, type A11yPrefsPlugin, type NativePrefs } from "../index.ts";
import { LANGS, langOf, pickLang, STRINGS } from "../strings.ts";
import { nativePlugin } from "../prefs.ts";

const ctrl = (id: string, x: number, y: number, extra: Partial<A11yControl> = {}): A11yControl => ({
  id,
  label: id,
  x,
  y,
  w: 48,
  h: 48,
  onActivate: () => {},
  ...extra,
});

let canvas: HTMLCanvasElement;
let inst: A11y | null = null;
const frames: (() => void)[] = [];

function make(opts: A11yOptions = {}): A11y {
  inst = createA11y({ lang: "en", raf: (cb) => void frames.push(cb), plugin: () => null, ...opts });
  return inst;
}
function runFrames(): void {
  for (const f of frames.splice(0)) f();
}
const root = (): HTMLElement => document.querySelector(".a11y-root") as HTMLElement;
const ctrlButtons = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(".a11y-root > div:first-child > button")];
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"><canvas></canvas></div>';
  canvas = document.querySelector("canvas")!;
  frames.length = 0;
});
afterEach(() => {
  inst?.destroy();
  inst = null;
  vi.useRealTimers();
});

describe("cold start", () => {
  it("does no DOM work and schedules nothing before init()", () => {
    const a = make();
    a.setControls("hud", [ctrl("undo", 0, 0)]);
    a.setBoard({ rows: 2, cols: 2, x: 0, y: 0, w: 10, h: 10, describe: () => "", activate: () => {} });
    a.announce("hello");
    expect(a.t("undo")).toBe("Undo");
    expect(document.querySelector(".a11y-root")).toBeNull();
    expect(document.head.querySelector("style")).toBeNull();
    expect(frames.length).toBe(0);
    a.init(canvas);
    expect(frames.length).toBe(1);
    runFrames();
    expect(ctrlButtons().length).toBe(1);
  });

  it("batches many updates into one frame", () => {
    const a = make();
    a.init(canvas);
    for (let i = 0; i < 10; i++) a.setControls("hud", [ctrl("undo", i, 0)]);
    expect(frames.length).toBe(1);
  });
});

describe("controls", () => {
  it("renders transparent buttons in reading order with labels and geometry", () => {
    const a = make();
    a.init(canvas);
    a.setControls("hud", [ctrl("hint", 300, 700), ctrl("settings", 12, 40), ctrl("undo", 200, 702), ctrl("moon", 250, 120)]);
    runFrames();
    const b = ctrlButtons();
    expect(b.map((e) => e.getAttribute("aria-label"))).toEqual(["settings", "moon", "undo", "hint"]);
    expect(b.every((e) => e.type === "button" && e.textContent === "")).toBe(true);
    const s = b[0]!.style;
    expect([s.left, s.top, s.width, s.height]).toEqual(["12px", "40px", "48px", "48px"]);
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(root().getAttribute("lang")).toBe("en");
  });

  it("keeps nodes and only writes what changed", () => {
    const a = make();
    a.init(canvas);
    a.setControls("hud", [ctrl("undo", 0, 0), ctrl("hint", 60, 0)]);
    runFrames();
    const [undo, hint] = ctrlButtons();
    const seen: MutationRecord[] = [];
    const mo = new MutationObserver((m) => seen.push(...m));
    mo.observe(root(), { subtree: true, childList: true, attributes: true });
    a.setControls("hud", [ctrl("undo", 0, 0), ctrl("hint", 60, 0)]);
    runFrames();
    seen.push(...mo.takeRecords());
    expect(seen.length).toBe(0);
    a.setControls("hud", [ctrl("undo", 0, 0, { label: "Undo!" }), ctrl("hint", 60, 0)]);
    runFrames();
    seen.push(...mo.takeRecords());
    mo.disconnect();
    expect(seen.map((m) => m.attributeName)).toEqual(["aria-label"]);
    expect(ctrlButtons()[0]).toBe(undo);
    expect(ctrlButtons()[1]).toBe(hint);
  });

  it("replaces per screen, merges screens, removes stale nodes", () => {
    const a = make();
    a.init(canvas);
    a.setControls("hud", [ctrl("undo", 0, 600), ctrl("hint", 60, 600)]);
    a.setControls("sheet", [ctrl("soundOn", 0, 300, { pressed: true }), ctrl("soundOff", 60, 300, { pressed: false })]);
    runFrames();
    expect(ctrlButtons().map((e) => e.getAttribute("aria-label"))).toEqual(["soundOn", "soundOff", "undo", "hint"]);
    expect(ctrlButtons()[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(ctrlButtons()[1]!.getAttribute("aria-pressed")).toBe("false");
    expect(ctrlButtons()[2]!.hasAttribute("aria-pressed")).toBe(false);
    a.setControls("hud", [ctrl("undo", 0, 600)]);
    runFrames();
    expect(ctrlButtons().map((e) => e.getAttribute("aria-label"))).toEqual(["soundOn", "soundOff", "undo"]);
    a.setControls("sheet", []);
    runFrames();
    expect(ctrlButtons().map((e) => e.getAttribute("aria-label"))).toEqual(["undo"]);
  });

  it("activation (VoiceOver double-tap = click) calls the latest onActivate", () => {
    const a = make();
    a.init(canvas);
    const first = vi.fn();
    const second = vi.fn();
    a.setControls("hud", [ctrl("undo", 0, 0, { onActivate: first })]);
    runFrames();
    a.setControls("hud", [ctrl("undo", 0, 0, { onActivate: second })]);
    runFrames();
    ctrlButtons()[0]!.click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("speaks a hint through aria-describedby", () => {
    const a = make();
    a.init(canvas);
    a.setControls("hud", [ctrl("moon", 0, 0, { hint: "Opens today's puzzle" })]);
    runFrames();
    const b = ctrlButtons()[0]!;
    const id = b.getAttribute("aria-describedby")!;
    expect(document.getElementById(id)?.textContent).toBe("Opens today's puzzle");
    a.setControls("hud", [ctrl("moon", 0, 0)]);
    runFrames();
    expect(b.hasAttribute("aria-describedby")).toBe(false);
  });

  it("is pointer-transparent unless VoiceOver is on", async () => {
    let fire: ((p: NativePrefs) => void) | null = null;
    const plugin: A11yPrefsPlugin = {
      get: () => Promise.resolve({ voiceOver: false }),
      addListener: (_e, cb) => {
        fire = cb;
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
    };
    const a = make({ plugin: () => plugin });
    a.init(canvas);
    runFrames();
    await tick();
    expect(root().classList.contains("a11y-vo")).toBe(false);
    expect(document.head.querySelector("style")!.textContent).toMatch(/\.a11y-root button\{[^}]*pointer-events:none/);
    fire!({ voiceOver: true });
    expect(a.prefs().voiceOver).toBe(true);
    expect(root().classList.contains("a11y-vo")).toBe(true);
  });
});

describe("board grid", () => {
  function board(state: string[][], activate = vi.fn()): A11yBoard {
    return { rows: state.length, cols: state[0]!.length, x: 20, y: 300, w: 300, h: 200, describe: (r, c) => state[r]![c]!, activate };
  }

  it("builds an ARIA grid with rows, gridcells and labelled buttons", () => {
    const a = make();
    a.init(canvas);
    a.setBoard(board([["a", "b", "c"], ["d", "e", "f"]]));
    runFrames();
    const g = document.querySelector('[role="grid"]')!;
    expect(g.getAttribute("aria-label")).toBe("Puzzle, 2 by 3");
    expect(g.getAttribute("aria-rowcount")).toBe("2");
    expect(g.getAttribute("aria-colcount")).toBe("3");
    const rows = g.querySelectorAll('[role="row"]');
    expect(rows.length).toBe(2);
    expect(rows[1]!.getAttribute("aria-rowindex")).toBe("2");
    const cells = rows[1]!.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(3);
    expect(cells[2]!.getAttribute("aria-colindex")).toBe("3");
    expect(cells[2]!.querySelector("button")!.getAttribute("aria-label")).toBe("f");
    // geometry: 3 cols over 300 px, 2 rows over 200 px
    expect((cells[2] as HTMLElement).style.left).toBe("200px");
    expect((rows[1] as HTMLElement).style.top).toBe("100px");
    expect((g as HTMLElement).style.top).toBe("300px");
    // single tab stop
    expect(g.querySelectorAll('button[tabindex="0"]').length).toBe(1);
  });

  it("refreshes only changed cell labels and activates cells", () => {
    const a = make();
    a.init(canvas);
    const state = [["dark", "dark"], ["rock", "dark"]];
    const activate = vi.fn();
    const b = board(state, activate);
    a.setBoard(b);
    runFrames();
    const seen: MutationRecord[] = [];
    const mo = new MutationObserver((m) => seen.push(...m));
    mo.observe(root(), { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-label"] });
    state[0]![1] = "lantern";
    a.setBoard(b);
    runFrames();
    seen.push(...mo.takeRecords());
    mo.disconnect();
    expect(seen.length).toBe(1);
    const btn = document.querySelector<HTMLButtonElement>('button[data-r="0"][data-c="1"]')!;
    expect(btn.getAttribute("aria-label")).toBe("lantern");
    btn.click();
    expect(activate).toHaveBeenCalledWith(0, 1);
    expect(btn.tabIndex).toBe(0);
  });

  it("sits in reading order among controls and goes away with setBoard(null)", () => {
    const a = make();
    a.init(canvas);
    a.setControls("hud", [ctrl("undo", 0, 600), ctrl("settings", 0, 10)]);
    a.setBoard(board([["x"]]));
    runFrames();
    const kids = [...root().firstElementChild!.children].map((e) => e.getAttribute("aria-label"));
    expect(kids).toEqual(["settings", "Puzzle, 1 by 1", "undo"]);
    a.setBoard(null);
    runFrames();
    expect(document.querySelector('[role="grid"]')).toBeNull();
  });

  it("moves focus with arrow keys", () => {
    const a = make();
    a.init(canvas);
    a.setBoard(board([["a", "b"], ["c", "d"]]));
    runFrames();
    const first = document.querySelector<HTMLButtonElement>('button[data-r="0"][data-c="0"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement?.getAttribute("aria-label")).toBe("c");
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement?.getAttribute("aria-label")).toBe("d");
    expect(first.tabIndex).toBe(-1);
  });

  it("rebuilds when the board size changes", () => {
    const a = make();
    a.init(canvas);
    a.setBoard(board([["a"]]));
    runFrames();
    a.setBoard(board([["a", "b"], ["c", "d"]]));
    runFrames();
    expect(document.querySelectorAll('[role="gridcell"]').length).toBe(4);
  });
});

describe("live region", () => {
  it("announces politely, joins a frame's messages, re-speaks repeats, then clears", () => {
    vi.useFakeTimers();
    const a = make({ liveClearMs: 1000 });
    a.init(canvas);
    runFrames();
    const live = document.querySelector('[aria-live="polite"]')!;
    expect(live.getAttribute("role")).toBe("status");
    expect(live.getAttribute("aria-atomic")).toBe("true");
    a.announce("Lantern placed");
    a.announce("Solved");
    runFrames();
    expect(live.textContent).toBe("Lantern placed. Solved");
    a.announce("Undone");
    runFrames();
    const firstText = live.textContent;
    a.announce("Undone");
    runFrames();
    expect(live.textContent).not.toBe(firstText); // changed content so VoiceOver speaks it again
    expect(live.textContent!.trim()).toBe("Undone");
    vi.advanceTimersByTime(1000);
    expect(live.textContent).toBe("");
  });
});

describe("preferences", () => {
  function stubMedia(matches: Record<string, boolean>): void {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (q: string) => ({ matches: !!matches[q], media: q, addEventListener: () => {}, removeEventListener: () => {} }),
    });
  }
  function stubProbe(fontSize: string, fontWeight = "400"): void {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      if (el instanceof HTMLElement && el.classList.contains("a11y-probe")) return { fontSize, fontWeight } as CSSStyleDeclaration;
      return real(el);
    });
  }
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("defaults before init and without any signal", () => {
    const a = make();
    expect(a.prefs()).toEqual({ fontScale: 1, boldText: false, increaseContrast: false, reduceMotion: false, voiceOver: false });
    a.init(canvas);
    runFrames();
    expect(a.prefs().fontScale).toBe(1);
  });

  it("reads contrast and reduce-motion media queries", () => {
    stubMedia({ "(prefers-contrast: more)": true, "(prefers-reduced-motion: reduce)": true });
    const a = make();
    a.init(canvas);
    expect(a.prefs().increaseContrast).toBe(true);
    expect(a.prefs().reduceMotion).toBe(true);
  });

  it("derives fontScale from the -apple-system-body probe (/17, clamped to [1, 2]) and bold from its weight", () => {
    stubProbe("25.5px", "700");
    const a = make();
    const cb = vi.fn();
    a.onChange(cb);
    a.init(canvas);
    runFrames();
    expect(a.prefs().fontScale).toBe(1.5);
    expect(a.prefs().boldText).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
    for (const [size, want] of [["53px", 2], ["14px", 1], ["", 1]] as const) {
      inst!.destroy();
      stubProbe(size);
      const b = make();
      b.init(canvas);
      runFrames();
      expect(b.prefs().fontScale).toBe(want);
      vi.restoreAllMocks();
    }
  });

  it("re-reads on visibility change and emits only on change", () => {
    stubProbe("17px");
    const a = make();
    const cb = vi.fn();
    a.onChange(cb);
    a.init(canvas);
    runFrames();
    expect(cb).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    stubProbe("23.8px");
    document.dispatchEvent(new Event("visibilitychange"));
    runFrames();
    expect(a.prefs().fontScale).toBe(1.4);
    expect(cb).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("visibilitychange"));
    runFrames();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("native plugin values win; 'not implemented' keeps web fallbacks", async () => {
    stubMedia({ "(prefers-reduced-motion: reduce)": true });
    const failing: A11yPrefsPlugin = {
      get: () => Promise.reject(Object.assign(new Error("A11yPrefs not implemented"), { code: "UNIMPLEMENTED" })),
      addListener: () => Promise.reject(new Error("not implemented")),
    };
    const a = make({ plugin: () => failing });
    a.init(canvas);
    runFrames();
    await tick();
    expect(a.prefs()).toMatchObject({ reduceMotion: true, voiceOver: false, fontScale: 1 });
    a.destroy();

    let fire: ((p: NativePrefs) => void) | null = null;
    const ok: A11yPrefsPlugin = {
      get: () => Promise.resolve({ contentSizeCategory: "UICTContentSizeCategoryAccessibilityXXL", fontScale: 3.1, boldText: true, increaseContrast: true, reduceMotion: false, voiceOver: true }),
      addListener: (_e, cb) => {
        fire = cb;
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
    };
    const b = make({ plugin: () => ok });
    const cb = vi.fn();
    b.onChange(cb);
    b.init(canvas);
    runFrames();
    await tick();
    expect(b.prefs()).toEqual({ fontScale: 2, boldText: true, increaseContrast: true, reduceMotion: false, voiceOver: true });
    expect(cb).toHaveBeenCalled();
    const n = cb.mock.calls.length;
    fire!({ fontScale: 1.2 });
    expect(b.prefs().fontScale).toBe(1.2);
    expect(cb.mock.calls.length).toBe(n + 1);
    expect(cb.mock.calls.at(-1)![0]).toMatchObject({ fontScale: 1.2, voiceOver: true });
  });

  it("finds no native plugin on web", () => {
    expect(nativePlugin()).toBeNull();
  });

  it("unsubscribes", () => {
    stubProbe("34px");
    const a = make();
    const cb = vi.fn();
    const off = a.onChange(cb);
    off();
    a.init(canvas);
    runFrames();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("language and strings", () => {
  it("picks the best supported language with an English fallback", () => {
    expect(pickLang(["ko-KR"])).toBe("ko");
    expect(pickLang(["ja"])).toBe("ja");
    expect(pickLang(["de-AT"])).toBe("de");
    expect(pickLang(["fr-CA"])).toBe("fr");
    expect(pickLang(["es-419"])).toBe("es");
    expect(pickLang(["pt-PT"])).toBe("pt-BR");
    expect(pickLang(["pt_BR"])).toBe("pt-BR");
    expect(pickLang(["th-TH", "ko"])).toBe("ko");
    expect(pickLang(["th-TH"])).toBe("en");
    expect(pickLang([undefined, ""])).toBe("en");
  });

  it("maps Chinese by script first, then by region (v12)", () => {
    const cases: [string, string][] = [
      // Traditional: Taiwan, Hong Kong, Macau, any explicit Hant (iOS sends "zh-Hant-TW" style tags)
      ["zh-TW", "zh-Hant"], ["zh-HK", "zh-Hant"], ["zh-MO", "zh-Hant"], ["zh_TW", "zh-Hant"], ["zh-hk", "zh-Hant"],
      ["zh-Hant", "zh-Hant"], ["zh-Hant-TW", "zh-Hant"], ["zh-Hant-HK", "zh-Hant"], ["zh-Hant-MO", "zh-Hant"], ["zh-Hant-US", "zh-Hant"], ["zh-Hant-CN", "zh-Hant"],
      ["yue", "zh-Hant"], ["yue-Hant-HK", "zh-Hant"], ["cmn-Hant-TW", "zh-Hant"],
      // Simplified: Singapore, Malaysia, mainland tags, explicit Hans (even with a Traditional region), plain "zh"
      ["zh", "zh-Hans"], ["zh-CN", "zh-Hans"], ["zh-SG", "zh-Hans"], ["zh-MY", "zh-Hans"], ["zh_CN", "zh-Hans"],
      ["zh-Hans", "zh-Hans"], ["zh-Hans-CN", "zh-Hans"], ["zh-Hans-SG", "zh-Hans"], ["zh-Hans-MY", "zh-Hans"], ["zh-Hans-HK", "zh-Hans"], ["zh-Hans-US", "zh-Hans"],
      ["yue-Hans-CN", "zh-Hans"],
      // Italian: every region
      ["it", "it"], ["it-IT", "it"], ["it-CH", "it"], ["it-SM", "it"], ["it_IT", "it"],
      // Spanish: one neutral es for Spain and the Americas
      ["es", "es"], ["es-ES", "es"], ["es-MX", "es"], ["es-419", "es"], ["es-US", "es"], ["es-AR", "es"], ["es-CO", "es"],
      // English for everything we do not ship
      ["en-GB", "en"], ["nl-NL", "en"], ["th-TH", "en"], ["ar", "en"], ["ru-RU", "en"], ["vi-VN", "en"], ["id-ID", "en"],
    ];
    for (const [tag, want] of cases) expect(pickLang([tag]), tag).toBe(want);
    expect(langOf("nl")).toBeNull();
    expect(langOf("  zh-Hant-TW ")).toBe("zh-Hant");
    // first supported tag wins (the device order)
    expect(pickLang(["nl-NL", "zh-Hant-TW", "en-US"])).toBe("zh-Hant");
    expect(pickLang(["ja-JP", "zh-Hant-TW"])).toBe("ja");
  });

  it("joins spoken parts with the language's own punctuation", () => {
    expect(make({ lang: "zh-Hant" }).cell({ row: 0, col: 1, kind: "floor", lit: false })).toBe("第 1 列，第 2 欄，未照亮");
    expect(make({ lang: "zh-Hans" }).cell({ row: 0, col: 1, kind: "rock", number: 2, around: 1 })).toBe("第 1 行，第 2 列，数字 2 的石头，还差 1 盏");
    expect(make({ lang: "it" }).cell({ row: 2, col: 0, kind: "lantern" })).toBe("Riga 3, colonna 1, lanterna");
  });

  it("uses navigator.languages when no language is forced", () => {
    const spy = vi.spyOn(navigator, "languages", "get").mockReturnValue(["ja-JP", "en-US"]);
    const a = createA11y({ plugin: () => null });
    expect(a.lang()).toBe("ja");
    expect(a.t("undo")).toBe("元に戻す");
    spy.mockRestore();
  });

  it("takes the native plugin's language and asks the UI to re-send labels", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);
    const plugin: A11yPrefsPlugin = {
      get: () => Promise.resolve({ language: "de-DE" }),
      addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
    };
    const a = createA11y({ raf: (cb) => void frames.push(cb), plugin: () => plugin });
    inst = a;
    expect(a.t("undo")).toBe("Undo");
    const cb = vi.fn();
    a.onChange(cb);
    a.init(canvas);
    await tick();
    expect(a.lang()).toBe("de");
    expect(a.t("undo")).toBe("Rückgängig");
    expect(root().getAttribute("lang")).toBe("de");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("has every key in every language, with the same placeholders", () => {
    const en = STRINGS.en;
    for (const l of LANGS) {
      const d = STRINGS[l];
      expect(Object.keys(d).sort(), l).toEqual(Object.keys(en).sort());
      for (const k of Object.keys(en)) {
        const ph = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
        expect(ph(d[k]!), `${l}.${k}`).toEqual(ph(en[k]!));
        expect(d[k]!.length, `${l}.${k}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it("v12 languages are fully translated (no English left behind) and Chinese scripts differ", () => {
    for (const l of ["it", "zh-Hans", "zh-Hant"] as const) {
      for (const k of Object.keys(STRINGS.en)) expect(STRINGS[l][k], `${l}.${k}`).not.toBe(STRINGS.en[k]);
    }
    const same = Object.keys(STRINGS.en).filter((k) => STRINGS["zh-Hans"][k] === STRINGS["zh-Hant"][k]);
    // only script-neutral lines may be identical (e.g. 提示, 分享, 完成)
    expect(same.length).toBeLessThan(25);
    for (const k of same) expect(STRINGS["zh-Hans"][k]!.length, k).toBeLessThanOrEqual(6);
  });

  it("formats variables and falls back to English, then the key", () => {
    const a = make({ lang: "ko" });
    expect(a.t("level", { n: 12 })).toBe("퍼즐 12");
    expect(a.t("nope")).toBe("nope");
    expect(make({ lang: "fr" }).t("cell.needs", { k: 2 })).toBe("encore 2");
  });

  it("covers every label the screens need", () => {
    const a = make();
    for (const k of ["settings", "undo", "hint", "street", "home", "daily", "tower", "house", "nextLevel", "share", "adBreak", "close", "soundOn", "soundOff", "hapticsOn", "hapticsOff", "numbersDigits", "numbersDots", "replayGuide", "town.house", "shields"]) {
      expect(a.t(k), k).not.toBe(k);
    }
  });

  it("has every announcement the scene raises, in every language (no fallbacks)", () => {
    for (const lang of LANGS) {
      const a = make({ lang });
      for (const k of ["ann.placed", "ann.removed", "ann.undone", "ann.conflict", "ann.solved", "ann.hint", "ann.stuck"]) {
        expect(a.t(k), `${lang}.${k}`).not.toBe(k);
        if (lang !== "en") expect(a.t(k), `${lang}.${k}`).not.toBe(STRINGS.en[k]);
      }
    }
    expect(make({ lang: "en" }).t("ann.stuck")).toBe("Stuck: one lantern blocks the rest");
    expect(make({ lang: "ko" }).t("ann.stuck")).toBe("막혔어요: 등불 하나가 길을 막아요");
  });

  it("describes cells", () => {
    const a = make();
    expect(a.cell({ row: 0, col: 2, kind: "floor", lit: false })).toBe("Row 1, column 3, dark");
    expect(a.cell({ row: 1, col: 0, kind: "floor", lit: true })).toBe("Row 2, column 1, lit");
    expect(a.cell({ row: 1, col: 1, kind: "lantern" })).toBe("Row 2, column 2, lantern");
    expect(a.cell({ row: 1, col: 1, kind: "lantern", conflict: true })).toBe("Row 2, column 2, lantern, sees another lantern");
    expect(a.cell({ row: 3, col: 3, kind: "rock" })).toBe("Row 4, column 4, stone");
    expect(a.cell({ row: 3, col: 3, kind: "rock", number: 2, around: 2 })).toBe("Row 4, column 4, stone 2, done");
    expect(a.cell({ row: 3, col: 3, kind: "rock", number: 3, around: 1 })).toBe("Row 4, column 4, stone 3, needs 2 more");
    expect(a.cell({ row: 3, col: 3, kind: "rock", number: 3, around: 1, stuck: true })).toBe("Row 4, column 4, stone 3, needs 2 more, can't be met");
    expect(a.cell({ row: 3, col: 3, kind: "rock", number: 0, around: 1 })).toBe("Row 4, column 4, stone 0, 1 too many");
    const ko = make({ lang: "ko" });
    expect(ko.cell({ row: 0, col: 0, kind: "rock", number: 2, around: 0 })).toBe("1행 1열, 돌 2, 2개 더 필요");
    const ja = make({ lang: "ja" });
    expect(ja.cell({ row: 0, col: 0, kind: "rock" })).toBe("1行 1列、石");
    expect(ja.cell({ row: 0, col: 0, kind: "floor", lit: true })).toBe("1行 1列、明るい");
  });
});

describe("readingOrder", () => {
  it("orders by lines, then left to right", () => {
    const b = (key: string, x: number, y: number, h = 40) => ({ key, x, y, w: 40, h });
    const out = readingOrder([b("r", 300, 12), b("l", 10, 10), b("m", 150, 25), b("board", 0, 100, 300), b("u", 10, 450)]);
    expect(out.map((o) => o.key)).toEqual(["l", "m", "r", "board", "u"]);
  });
});
