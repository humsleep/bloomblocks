// The scene's side of the VoiceOver layer (agent A's src/a11y, README there). The scene hands
// over what is on screen (canvas px); this converts to CSS px, skips unchanged sets (no DOM work
// unless something moved, appeared or changed label) and forwards announcements.
// Refreshed at ≤ 4 Hz from the scene (never per frame), plus right after state changes.
import { a11y, type CellInfo } from "../a11y/index.ts";

export interface Ctl {
  id: string;
  /** a11y.t key (README "Label keys") */
  key: string;
  vars?: Record<string, string | number>;
  pressed?: boolean;
  /** canvas px */
  x: number;
  y: number;
  w: number;
  h: number;
  act: () => void;
}

export interface BoardSpec {
  rows: number;
  cols: number;
  /** canvas px */
  x: number;
  y: number;
  w: number;
  h: number;
  info: (r: number, c: number) => CellInfo;
  activate: (r: number, c: number) => void;
}

/** Announcement kinds the scene raises → a11y.t keys (first key with a translation wins). */
const ANN: Record<string, readonly string[]> = {
  placed: ["ann.placed"],
  removed: ["ann.removed"],
  conflict: ["ann.conflict"],
  undone: ["ann.undone"],
  hint: ["ann.hint"],
  complete: ["ann.solved"],
  "daily.done": ["ann.solved"],
  stuck: ["ann.stuck"],
  level: ["level"],
};

export class A11yLayer {
  private sigs = new Map<string, string>();
  private boardSig = "";
  private inited = false;

  constructor(private readonly u: number) {}

  init(canvas: HTMLCanvasElement): void {
    if (this.inited) return;
    this.inited = true;
    a11y.init(canvas);
  }

  get voiceOver(): boolean {
    return a11y.prefs().voiceOver;
  }

  /** Language changed (A's onChange): send every label again. */
  invalidate(): void {
    this.sigs.clear();
    this.boardSig = "";
  }

  controls(screen: string, list: readonly Ctl[]): void {
    const u = this.u;
    let sig = "";
    for (const c of list) sig += `${c.id}:${c.key}:${c.vars ? JSON.stringify(c.vars) : ""}:${c.pressed ?? "-"}:${Math.round(c.x / u)},${Math.round(c.y / u)},${Math.round(c.w / u)},${Math.round(c.h / u)}|`;
    if (this.sigs.get(screen) === sig) return;
    this.sigs.set(screen, sig);
    a11y.setControls(
      screen,
      list.map((c) => ({
        id: c.id,
        label: a11y.t(c.key, c.vars),
        ...(c.pressed === undefined ? {} : { pressed: c.pressed }),
        x: c.x / u,
        y: c.y / u,
        w: c.w / u,
        h: c.h / u,
        onActivate: c.act,
      })),
    );
  }

  /** `stateSig` changes whenever any cell's description can change (the scene passes its state ref id). */
  board(b: BoardSpec | null, stateSig: string): void {
    const u = this.u;
    const sig = b ? `${stateSig}:${b.rows}x${b.cols}:${Math.round(b.x / u)},${Math.round(b.y / u)},${Math.round(b.w / u)}` : "null";
    if (sig === this.boardSig) return;
    this.boardSig = sig;
    if (!b) {
      a11y.setBoard(null);
      return;
    }
    a11y.setBoard({
      rows: b.rows,
      cols: b.cols,
      x: b.x / u,
      y: b.y / u,
      w: b.w / u,
      h: b.h / u,
      describe: (r, c) => a11y.cell(b.info(r, c)),
      activate: b.activate,
    });
  }

  /** Speak a shown line as it is (v11: error / tutorial lines are already localized text). */
  say(text: string): void {
    if (text) a11y.announce(text);
  }

  announce(kind: string, vars?: Record<string, string | number>, extra?: CellInfo): void {
    const keys = ANN[kind] ?? [kind];
    let text = "";
    for (const k of keys) {
      const t = a11y.t(k, vars);
      if (t !== k) {
        text = t;
        break;
      }
    }
    if (!text) return;
    if (extra) text += `, ${a11y.cell(extra)}`;
    a11y.announce(text);
  }
}

export { a11y };
