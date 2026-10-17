// VoiceOver layer + iOS accessibility preferences (phase 2 contract, docs/phase2-plan.md).
//
// The game draws everything on a Phaser canvas and shows no text. For VoiceOver this module keeps
// a hidden DOM layer over the canvas: transparent <button>s with aria-labels for the HUD controls and
// an ARIA grid for the board, in top→bottom, left→right order, plus a polite live region.
// Sighted touch never hits the layer (pointer-events: none) so the canvas still gets every tap;
// VoiceOver's double-tap activates the focused element (a click on it). When the native plugin
// reports VoiceOver on, buttons also take pointer events so hit-tested activation lands on them.
//
// Cost: nothing happens until init(). All DOM work is batched into one rAF; reads (canvas rect,
// Dynamic Type probe) come before writes, and only changed nodes / attributes are touched.
// Usage for the UI: src/a11y/README.md.
import { DEFAULT_PREFS, mediaFlag, merge, nativePlugin, readProbe, samePrefs, type A11yPrefs, type A11yPrefsPlugin, type NativePrefs, type WebPrefs } from "./prefs.ts";
import { format, listSep, pickLang, sentenceSep, type Lang } from "./strings.ts";

export type { A11yPrefs, A11yPrefsPlugin, NativePrefs } from "./prefs.ts";
export { isCJK, LANGS, langOf, pickLang, type Lang } from "./strings.ts";

/** A HUD control. Geometry in CSS px relative to the canvas element. */
export interface A11yControl {
  id: string;
  label: string;
  hint?: string;
  /** Toggle segments (settings sheet): true = the chosen one (aria-pressed). Omit for plain buttons. */
  pressed?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  onActivate(): void;
}

/** The board. Geometry in CSS px relative to the canvas; rows × cols equal cells. r, c are 0-based. */
export interface A11yBoard {
  rows: number;
  cols: number;
  x: number;
  y: number;
  w: number;
  h: number;
  describe(r: number, c: number): string;
  activate(r: number, c: number): void;
}

/** What a cell holds, for a11y.cell(). row, col 0-based (spoken 1-based). */
export interface CellInfo {
  row: number;
  col: number;
  kind: "floor" | "lantern" | "rock";
  /** floor: lit by a lantern */
  lit?: boolean;
  /** lantern: sees another lantern */
  conflict?: boolean;
  /** rock: its number 0–4, or null / undefined for a plain rock */
  number?: number | null;
  /** rock: lanterns now on its four neighbours */
  around?: number;
  /** rock: can no longer reach its number (the ⊘ mark) */
  stuck?: boolean;
}

export interface A11y {
  init(canvas: HTMLCanvasElement): void;
  /** Replaces the previous set for that screen. All screens' controls are shown together. */
  setControls(screen: string, controls: A11yControl[]): void;
  /** Pass the board again after every state change to refresh the cell labels (only changed ones are written). */
  setBoard(board: A11yBoard | null): void;
  /** Polite live region. Several calls in one frame are spoken together. */
  announce(text: string): void;
  prefs(): A11yPrefs;
  /** Fires when a preference changes (and when the spoken language changes: re-send labels then). */
  onChange(cb: (p: A11yPrefs) => void): () => void;
  t(key: string, vars?: Record<string, string | number>): string;
  /** Localized cell description built from CellInfo (for A11yBoard.describe). */
  cell(info: CellInfo): string;
  /** The language t() speaks. */
  lang(): Lang;
  /** Apply pending DOM updates now (tests; normally a rAF does it). */
  flush(): void;
  /** Remove the layer and listeners (tests / HMR). */
  destroy(): void;
}

export interface A11yOptions {
  /** Force a language (tests). Default: native plugin language, then navigator.languages. */
  lang?: string;
  /** Native plugin; default: registerPlugin('A11yPrefs') when available on a native platform. */
  plugin?: () => A11yPrefsPlugin | null;
  /** Frame scheduler (tests). Default: requestAnimationFrame. */
  raf?: (cb: () => void) => void;
  /** How long a spoken message stays in the live region before it is cleared (ms). */
  liveClearMs?: number;
}

const CSS = `
.a11y-root{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:1;overflow:visible}
.a11y-root button{position:absolute;margin:0;padding:0;border:0;border-radius:8px;background:transparent;color:transparent;font:inherit;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;pointer-events:none;outline:none}
.a11y-root.a11y-vo button{pointer-events:auto}
.a11y-root button:focus-visible{outline:3px solid #ffd58a;outline-offset:1px}
.a11y-grid,.a11y-row,.a11y-cell{position:absolute}
.a11y-cell button{left:0;top:0;width:100%;height:100%}
.a11y-hide{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.a11y-probe{position:absolute;left:0;top:0;visibility:hidden;font:-apple-system-body}
`;

interface CtrlEntry {
  kind: "ctrl";
  key: string;
  el: HTMLButtonElement;
  ctrl: A11yControl;
  label: string;
  hint: string;
  pressed: boolean | undefined;
  geo: string;
  desc: HTMLSpanElement | null;
}

interface GridState {
  el: HTMLDivElement;
  rows: number;
  cols: number;
  geo: string;
  label: string;
  rowEls: HTMLDivElement[];
  btns: HTMLButtonElement[][];
  labels: string[][];
  ar: number;
  ac: number;
}

const BOARD_KEY = "\u0000board";
const px = (v: number): string => `${Math.round(v * 100) / 100}px`;

function place(el: HTMLElement, x: number, y: number, w: number, h: number): void {
  const s = el.style;
  s.left = px(x);
  s.top = px(y);
  s.width = px(Math.max(0, w));
  s.height = px(Math.max(0, h));
}

interface Box {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Reading order: top→bottom by lines, left→right within a line. An item joins a line when its top is above the line's first item's middle. */
export function readingOrder<T extends Box>(items: readonly T[]): T[] {
  const byY = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const out: T[] = [];
  for (let i = 0; i < byY.length; ) {
    const first = byY[i]!;
    const mid = first.y + first.h / 2;
    let j = i + 1;
    while (j < byY.length && byY[j]!.y < mid) j++;
    out.push(...byY.slice(i, j).sort((a, b) => a.x - b.x || a.y - b.y));
    i = j;
  }
  return out;
}

export function createA11y(opts: A11yOptions = {}): A11y {
  // --- state (cheap; no DOM until init) ---
  const screens = new Map<string, A11yControl[]>();
  let board: A11yBoard | null = null;
  const listeners = new Set<(p: A11yPrefs) => void>();
  let cur: A11yPrefs = { ...DEFAULT_PREFS };
  let web: WebPrefs = { fontScale: 1, boldText: false, increaseContrast: false, reduceMotion: false };
  let native: NativePrefs | null = null;
  let langCache: Lang | null = opts.lang ? pickLang([opts.lang]) : null;
  let pending: string[] = [];
  let lastSpoken = "";
  let nbsp = false;

  // --- DOM (after init) ---
  let win: Window | null = null;
  let doc: Document | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let root: HTMLDivElement | null = null;
  let list: HTMLDivElement | null = null;
  let live: HTMLDivElement | null = null;
  let probe: HTMLSpanElement | null = null;
  let styleEl: HTMLStyleElement | null = null;
  const entries = new Map<string, CtrlEntry>();
  let grid: GridState | null = null;
  let order: string[] = [];
  let scheduled = false;
  let geomDirty = false;
  let probeDirty = false;
  let listDirty = false;
  let liveTimer: ReturnType<typeof setTimeout> | null = null;
  let idSeq = 0;
  const cleanups: (() => void)[] = [];

  function lang(): Lang {
    if (langCache) return langCache;
    const nav = typeof navigator !== "undefined" ? navigator : null;
    langCache = pickLang([native?.language, ...(nav?.languages ?? []), nav?.language]);
    return langCache;
  }

  const t = (key: string, vars?: Record<string, string | number>): string => format(lang(), key, vars);

  function cell(info: CellInfo): string {
    const parts = [t("cell.pos", { row: info.row + 1, col: info.col + 1 })];
    if (info.kind === "floor") parts.push(t(info.lit ? "cell.lit" : "cell.dark"));
    else if (info.kind === "lantern") parts.push(t(info.conflict ? "cell.conflict" : "cell.lantern"));
    else if (info.number === null || info.number === undefined) parts.push(t("cell.rock"));
    else {
      const n = info.number;
      const k = info.around ?? 0;
      parts.push(t("cell.rockN", { n }));
      if (k === n) parts.push(t("cell.ok"));
      else if (k < n) parts.push(t("cell.needs", { k: n - k }));
      else parts.push(t("cell.over", { k: k - n }));
      if (info.stuck && k < n) parts.push(t("cell.stuck"));
    }
    return parts.join(listSep(lang()));
  }

  function schedule(): void {
    if (scheduled || !root) return;
    scheduled = true;
    const run = (): void => {
      if (scheduled) flush();
    };
    if (opts.raf) opts.raf(run);
    else if (win && typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function emit(): void {
    const snap = { ...cur };
    for (const cb of [...listeners]) {
      try {
        cb(snap);
      } catch (e) {
        console.error("[a11y] onChange", e);
      }
    }
  }

  function recompute(): void {
    const next = merge(web, native);
    if (samePrefs(next, cur)) return;
    const voChanged = next.voiceOver !== cur.voiceOver;
    cur = next;
    if (voChanged && root) root.classList.toggle("a11y-vo", cur.voiceOver);
    emit();
  }

  function onNative(p: NativePrefs | null | undefined): void {
    if (!p || typeof p !== "object") return;
    native = { ...native, ...p };
    let langChanged = false;
    if (typeof p.language === "string" && p.language && !opts.lang) {
      const prev = langCache;
      langCache = null;
      const next = lang();
      if (root) root.lang = next;
      langChanged = prev !== null && prev !== next;
    }
    const before = cur;
    recompute();
    // labels already handed to us are in the old language: ask the UI to re-send them
    if (langChanged && before === cur) emit();
  }

  async function startNative(): Promise<void> {
    let plugin: A11yPrefsPlugin | null = null;
    try {
      plugin = opts.plugin ? opts.plugin() : nativePlugin();
    } catch {
      plugin = null;
    }
    if (!plugin) return;
    const p = plugin;
    const refresh = (): void => {
      p.get().then(onNative, () => {
        /* not implemented / unavailable: keep web fallbacks */
      });
    };
    refresh();
    try {
      const handle = await p.addListener("change", onNative);
      if (root) cleanups.push(() => void handle.remove());
      else void handle.remove();
    } catch {
      /* no events: resume / visibility refresh still works */
    }
    const onVis = (): void => {
      if (doc?.visibilityState === "visible") refresh();
    };
    doc?.addEventListener("visibilitychange", onVis);
    cleanups.push(() => doc?.removeEventListener("visibilitychange", onVis));
  }

  function watchMedia(query: string, apply: (v: boolean) => void): void {
    if (!win || typeof win.matchMedia !== "function") return;
    let mql: MediaQueryList;
    try {
      mql = win.matchMedia(query);
    } catch {
      return;
    }
    const on = (e: MediaQueryListEvent): void => {
      apply(e.matches);
      recompute();
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", on);
      cleanups.push(() => mql.removeEventListener("change", on));
    }
  }

  // --- controls ---
  function makeCtrl(key: string, c: A11yControl): CtrlEntry {
    const el = doc!.createElement("button");
    el.type = "button";
    el.dataset.a11yKey = key;
    return { kind: "ctrl", key, el, ctrl: c, label: "", hint: "", pressed: undefined, geo: "", desc: null };
  }

  function syncCtrl(e: CtrlEntry, c: A11yControl): void {
    e.ctrl = c;
    if (e.label !== c.label) {
      e.label = c.label;
      e.el.setAttribute("aria-label", c.label);
    }
    const hint = c.hint ?? "";
    if (e.hint !== hint) {
      e.hint = hint;
      if (hint) {
        if (!e.desc) {
          e.desc = doc!.createElement("span");
          e.desc.className = "a11y-hide";
          e.desc.id = `a11y-d${++idSeq}`;
          e.el.appendChild(e.desc);
          e.el.setAttribute("aria-describedby", e.desc.id);
        }
        e.desc.textContent = hint;
      } else if (e.desc) {
        e.desc.remove();
        e.desc = null;
        e.el.removeAttribute("aria-describedby");
      }
    }
    if (e.pressed !== c.pressed) {
      e.pressed = c.pressed;
      if (c.pressed === undefined) e.el.removeAttribute("aria-pressed");
      else e.el.setAttribute("aria-pressed", c.pressed ? "true" : "false");
    }
    const geo = `${c.x},${c.y},${c.w},${c.h}`;
    if (e.geo !== geo) {
      e.geo = geo;
      place(e.el, c.x, c.y, c.w, c.h);
    }
  }

  // --- board grid ---
  function buildGrid(): GridState {
    const el = doc!.createElement("div");
    el.className = "a11y-grid";
    el.setAttribute("role", "grid");
    el.dataset.a11yKey = BOARD_KEY;
    return { el, rows: 0, cols: 0, geo: "", label: "", rowEls: [], btns: [], labels: [], ar: 0, ac: 0 };
  }

  function syncGrid(g: GridState, b: A11yBoard): void {
    const rows = Math.max(0, Math.floor(b.rows));
    const cols = Math.max(0, Math.floor(b.cols));
    const resized = rows !== g.rows || cols !== g.cols;
    if (resized) {
      g.el.textContent = "";
      g.rowEls = [];
      g.btns = [];
      g.labels = [];
      g.rows = rows;
      g.cols = cols;
      g.geo = "";
      g.ar = 0;
      g.ac = 0;
      g.el.setAttribute("aria-rowcount", String(rows));
      g.el.setAttribute("aria-colcount", String(cols));
      for (let r = 0; r < rows; r++) {
        const row = doc!.createElement("div");
        row.className = "a11y-row";
        row.setAttribute("role", "row");
        row.setAttribute("aria-rowindex", String(r + 1));
        const rb: HTMLButtonElement[] = [];
        for (let c = 0; c < cols; c++) {
          const gc = doc!.createElement("div");
          gc.className = "a11y-cell";
          gc.setAttribute("role", "gridcell");
          gc.setAttribute("aria-colindex", String(c + 1));
          const btn = doc!.createElement("button");
          btn.type = "button";
          btn.dataset.r = String(r);
          btn.dataset.c = String(c);
          btn.tabIndex = r === 0 && c === 0 ? 0 : -1;
          gc.appendChild(btn);
          row.appendChild(gc);
          rb.push(btn);
        }
        g.el.appendChild(row);
        g.rowEls.push(row);
        g.btns.push(rb);
        g.labels.push(new Array<string>(cols).fill("\u0000"));
      }
    }
    const label = t("board", { rows, cols });
    if (g.label !== label) {
      g.label = label;
      g.el.setAttribute("aria-label", label);
    }
    const geo = `${b.x},${b.y},${b.w},${b.h}`;
    if (g.geo !== geo) {
      g.geo = geo;
      place(g.el, b.x, b.y, b.w, b.h);
      const ch = rows ? b.h / rows : 0;
      const cw = cols ? b.w / cols : 0;
      for (let r = 0; r < rows; r++) {
        place(g.rowEls[r]!, 0, r * ch, b.w, ch);
        const cells = g.rowEls[r]!.children;
        for (let c = 0; c < cols; c++) place(cells[c] as HTMLElement, c * cw, 0, cw, ch);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let s: string;
        try {
          s = b.describe(r, c);
        } catch (e) {
          console.error("[a11y] describe", e);
          s = t("cell.pos", { row: r + 1, col: c + 1 });
        }
        if (g.labels[r]![c] !== s) {
          g.labels[r]![c] = s;
          g.btns[r]![c]!.setAttribute("aria-label", s);
        }
      }
    }
  }

  /** Roving tabindex: the last focused / activated cell is the grid's one tab stop. */
  function rove(btn: HTMLButtonElement): void {
    if (!grid) return;
    const prev = grid.btns[grid.ar]?.[grid.ac];
    if (prev && prev !== btn) prev.tabIndex = -1;
    btn.tabIndex = 0;
    grid.ar = +(btn.dataset.r ?? 0);
    grid.ac = +(btn.dataset.c ?? 0);
  }

  function focusCell(r: number, c: number): void {
    if (!grid) return;
    const rr = Math.min(grid.rows - 1, Math.max(0, r));
    const cc = Math.min(grid.cols - 1, Math.max(0, c));
    const prev = grid.btns[grid.ar]?.[grid.ac];
    const next = grid.btns[rr]?.[cc];
    if (!next) return;
    if (prev && prev !== next) prev.tabIndex = -1;
    next.tabIndex = 0;
    grid.ar = rr;
    grid.ac = cc;
    next.focus();
  }

  // --- the batched update ---
  function flush(): void {
    scheduled = false;
    if (!root || !win || !list) return;
    // reads first
    const rect = geomDirty && canvas ? canvas.getBoundingClientRect() : null;
    const probed = probeDirty && probe ? readProbe(probe, win) : null;
    geomDirty = false;
    probeDirty = false;
    // writes
    if (rect) place(root, rect.left, rect.top, rect.width, rect.height);
    if (probed) {
      web = { ...web, ...probed };
      recompute();
    }
    if (listDirty) {
      listDirty = false;
      syncList();
    }
    if (pending.length && live) {
      let text = pending.join(sentenceSep(lang()));
      pending = [];
      if (text === lastSpoken) {
        nbsp = !nbsp;
        if (nbsp) text += " ";
      } else nbsp = false;
      lastSpoken = text.replace(/ $/, "");
      live.textContent = text;
      if (liveTimer) clearTimeout(liveTimer);
      const ms = opts.liveClearMs ?? 6000;
      liveTimer = setTimeout(() => {
        liveTimer = null;
        if (live) live.textContent = "";
        lastSpoken = "";
      }, ms);
    }
  }

  function syncList(): void {
    const boxes: Box[] = [];
    const seen = new Set<string>();
    for (const [screen, ctrls] of screens) {
      for (const c of ctrls) {
        const key = `${screen}\u0000${c.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let e = entries.get(key);
        if (!e) {
          e = makeCtrl(key, c);
          entries.set(key, e);
        }
        syncCtrl(e, c);
        boxes.push({ key, x: c.x, y: c.y, w: c.w, h: c.h });
      }
    }
    for (const [key, e] of entries) {
      if (!seen.has(key)) {
        e.el.remove();
        entries.delete(key);
      }
    }
    if (board) {
      if (!grid) grid = buildGrid();
      syncGrid(grid, board);
      boxes.push({ key: BOARD_KEY, x: board.x, y: board.y, w: board.w, h: board.h });
    } else if (grid) {
      grid.el.remove();
      grid = null;
    }
    // reorder only when the sequence changed
    const want = readingOrder(boxes).map((b) => b.key);
    const same = want.length === order.length && want.every((k, i) => k === order[i]) && list!.childElementCount === want.length;
    if (!same) {
      let at: ChildNode | null = list!.firstChild;
      for (const key of want) {
        const el = key === BOARD_KEY ? grid!.el : entries.get(key)!.el;
        if (el === at) at = at.nextSibling;
        else list!.insertBefore(el, at);
      }
      order = want;
    }
  }

  // --- events on the layer (delegated) ---
  function onClick(ev: Event): void {
    const target = ev.target as Element | null;
    const btn = target?.closest?.("button");
    if (!btn || !list?.contains(btn)) return;
    const r = btn.dataset.r;
    const c = btn.dataset.c;
    if (r !== undefined && c !== undefined) {
      rove(btn);
      try {
        board?.activate(+r, +c);
      } catch (e) {
        console.error("[a11y] activate", e);
      }
      return;
    }
    const key = btn.dataset.a11yKey;
    const e = key ? entries.get(key) : undefined;
    if (!e) return;
    try {
      e.ctrl.onActivate();
    } catch (err) {
      console.error("[a11y] onActivate", err);
    }
  }

  function onKey(ev: KeyboardEvent): void {
    const btn = (ev.target as Element | null)?.closest?.("button");
    if (!grid || !btn || btn.dataset.r === undefined) return;
    const r = +btn.dataset.r;
    const c = +(btn.dataset.c ?? 0);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
      Home: [r, 0],
      End: [r, grid.cols - 1],
    };
    const to = moves[ev.key];
    if (!to) return;
    ev.preventDefault();
    focusCell(to[0], to[1]);
  }

  function init(cv: HTMLCanvasElement): void {
    if (canvas === cv && root) return;
    if (root) destroy();
    canvas = cv;
    doc = cv.ownerDocument;
    win = doc.defaultView;
    if (!win) return;
    styleEl = doc.createElement("style");
    styleEl.textContent = CSS;
    doc.head.appendChild(styleEl);
    root = doc.createElement("div");
    root.className = "a11y-root";
    root.lang = lang();
    live = doc.createElement("div");
    live.className = "a11y-hide";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    probe = doc.createElement("span");
    probe.className = "a11y-probe";
    probe.setAttribute("aria-hidden", "true");
    probe.textContent = "x";
    list = doc.createElement("div");
    root.append(list, live, probe);
    // the layer sits right after the canvas so it is read in place of it
    if (cv.parentNode) cv.parentNode.insertBefore(root, cv.nextSibling);
    else doc.body.appendChild(root);
    cv.setAttribute("aria-hidden", "true");
    list.addEventListener("click", onClick);
    list.addEventListener("keydown", onKey);
    list.addEventListener("focusin", (ev) => {
      const b = (ev.target as Element | null)?.closest?.("button");
      if (b?.dataset.r !== undefined) rove(b);
    });

    // preferences: media queries now (no layout), probe in the first frame, native async
    web = { ...web, increaseContrast: mediaFlag(win, "(prefers-contrast: more)"), reduceMotion: mediaFlag(win, "(prefers-reduced-motion: reduce)") };
    watchMedia("(prefers-contrast: more)", (v) => (web = { ...web, increaseContrast: v }));
    watchMedia("(prefers-reduced-motion: reduce)", (v) => (web = { ...web, reduceMotion: v }));
    recompute();
    root.classList.toggle("a11y-vo", cur.voiceOver);
    const onVis = (): void => {
      if (doc?.visibilityState !== "visible") return;
      probeDirty = true;
      geomDirty = true;
      schedule();
    };
    doc.addEventListener("visibilitychange", onVis);
    cleanups.push(() => doc?.removeEventListener("visibilitychange", onVis));
    const onResize = (): void => {
      geomDirty = true;
      schedule();
    };
    win.addEventListener("resize", onResize);
    cleanups.push(() => win?.removeEventListener("resize", onResize));
    const RO = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (RO) {
      const ro = new RO(onResize);
      ro.observe(cv);
      cleanups.push(() => ro.disconnect());
    }
    geomDirty = true;
    probeDirty = true;
    listDirty = true;
    schedule();
    void startNative();
  }

  function destroy(): void {
    for (const f of cleanups.splice(0)) {
      try {
        f();
      } catch {
        /* ignore */
      }
    }
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = null;
    root?.remove();
    styleEl?.remove();
    canvas?.removeAttribute("aria-hidden");
    root = list = live = probe = null;
    styleEl = null;
    canvas = null;
    entries.clear();
    grid = null;
    order = [];
    scheduled = false;
  }

  return {
    init,
    setControls(screen, controls) {
      if (controls.length) screens.set(screen, controls.slice());
      else screens.delete(screen);
      listDirty = true;
      schedule();
    },
    setBoard(b) {
      board = b;
      listDirty = true;
      schedule();
    },
    announce(text) {
      if (!text) return;
      pending.push(text);
      schedule();
    },
    prefs: () => ({ ...cur }),
    onChange(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    t,
    cell,
    lang,
    flush,
    destroy,
  };
}

/** The app-wide instance. Nothing runs until a11y.init(canvas). */
export const a11y: A11y = createA11y();
