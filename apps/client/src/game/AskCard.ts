// A small centred question card (phase 5): the reminder soft ask, "start this puzzle over?" and
// the ad-break confirm (AdMob: a rewarded ad needs a clear disclosure before it plays). One of the
// few places with words: a short localized line and two labelled buttons. A picture on top keeps
// the card readable at a glance. Tap outside = "no".
import type PhaserTypes from "phaser";
import { drawPanel, rrectPath } from "../render/draw.ts";
import { PAL, rgba } from "../render/palette.ts";
import type { TextureBank } from "../render/textures.ts";
import { vis } from "../render/vis.ts";
import { clamp01, easeOutCubic, motion } from "./motion.ts";
import { primaryButton, secondaryPill, uiFont, wrapBalanced } from "./uiText.ts";

type Image = PhaserTypes.GameObjects.Image;
type Text = PhaserTypes.GameObjects.Text;
export type AskHit = "yes" | "no" | "inside" | "outside";

export interface AskSpec {
  /** what is asked ("notify" | "restart" | "break"): tests and logs */
  kind: string;
  /** a picture over the text (drawn once into a w × h canvas), cache key */
  art?: { key: string; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void };
  /** R2 (Reality #17): an optional bold title over the text (the daily cards: "Today's puzzle") */
  title?: string;
  text: string;
  yes: string;
  /** "" = one button only (v11: the first daily's welcome card) */
  no: string;
}

export class AskCard {
  private dim: Image;
  private panel: Image;
  private art: Image;
  private title: Text;
  private text: Text;
  private yesBtn: Image;
  private noBtn: Image;
  private yesTxt: Text;
  private noTxt: Text;
  private open = false;
  private t0 = -1e9;
  private W = 0;
  private H = 0;
  private u = 1;
  private x0 = 0;
  private y0 = 0;
  private pw = 0;
  private ph = 0;
  private spec: AskSpec | null = null;
  /** button rects relative to the panel */
  private yesR = { x: 0, y: 0, w: 0, h: 0 };
  private noR = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
    private readonly depth: number,
  ) {
    const s = scene;
    const d = depth;
    this.dim = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(d).setVisible(false);
    this.panel = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(d).setVisible(false);
    this.art = s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0).setDepth(d).setVisible(false);
    const style = { fontFamily: uiFont(), color: "#F4EBD0", align: "center" };
    this.title = s.add.text(0, 0, "", style).setOrigin(0.5, 0).setDepth(d).setVisible(false);
    this.text = s.add.text(0, 0, "", style).setOrigin(0.5, 0).setDepth(d).setVisible(false);
    this.yesBtn = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(d).setVisible(false);
    this.noBtn = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(d).setVisible(false);
    this.yesTxt = s.add.text(0, 0, "", { ...style, color: "#2A1A08" }).setOrigin(0.5, 0.5).setDepth(d).setVisible(false);
    this.noTxt = s.add.text(0, 0, "", style).setOrigin(0.5, 0.5).setDepth(d).setVisible(false);
  }

  get objects(): PhaserTypes.GameObjects.GameObject[] {
    return [this.dim, this.panel, this.art, this.title, this.text, this.yesBtn, this.noBtn, this.yesTxt, this.noTxt];
  }

  get isOpen(): boolean {
    return this.open;
  }

  get kind(): string | null {
    return this.open ? (this.spec?.kind ?? null) : null;
  }

  layout(W: number, H: number, u: number): void {
    this.W = W;
    this.H = H;
    this.u = u;
    if (this.spec) this.place();
  }

  private place(): void {
    const sp = this.spec;
    if (!sp) return;
    const { W, H, u } = this;
    const fk = Math.min(vis.p.fontScale, 1.4);
    const pw = Math.round(Math.min(W - 40 * u, 320 * u));
    const pad = 20 * u;
    const artH = sp.art ? Math.round(72 * u) : 0;
    // v11: the shared wrap (breaks CJK lines too — Phaser's own wrap only breaks at spaces)
    const ww = pw - pad * 2;
    for (const t of [this.title, this.text, this.yesTxt, this.noTxt]) t.setFontFamily(uiFont());
    this.title.setFontSize(Math.round(20 * u * fk)).setFontStyle(vis.p.boldText ? "900" : "800").setWordWrapCallback((str: string, obj: Text) => {
      const ctx = obj.context;
      return wrapBalanced((x) => ctx.measureText(x).width, str, ww);
    }).setText(sp.title ?? "");
    const titleH = sp.title ? this.title.height + 6 * u : 0;
    this.text.setFontSize(Math.round(18 * u * fk)).setFontStyle(vis.weight).setWordWrapCallback((str: string, obj: Text) => {
      const ctx = obj.context;
      return wrapBalanced((x) => ctx.measureText(x).width, str, ww);
    }).setText(sp.text);
    const bh = Math.round(48 * u * Math.max(1, fk * 0.9));
    const gap = 12 * u;
    const ph = Math.round(pad + (artH ? artH + 10 * u : 0) + titleH + this.text.height + 18 * u + bh + pad);
    this.pw = pw;
    this.ph = ph;
    this.x0 = Math.round((W - pw) / 2);
    this.y0 = Math.round((H - ph) / 2);
    this.dim.setTexture(this.bank.canvas("askDim", 4, 4, (ctx) => {
      ctx.fillStyle = "rgba(6,7,20,0.6)";
      ctx.fillRect(0, 0, 4, 4);
    })).setScale(W / 4, H / 4);
    this.panel.setTexture(this.bank.canvas(`askPanel${vis.sig}@${pw}x${ph}`, pw, ph, (ctx, w, h) => {
      // a centred card: no drag handle (it cannot be dragged — Reality #17)
      drawPanel(ctx, w, h, 22 * u, u, false);
      if (vis.p.increaseContrast) {
        ctx.strokeStyle = rgba(PAL.moon, 0.85);
        ctx.lineWidth = 1.6 * u;
        rrectPath(ctx, 1, 1, w - 2, h - 2, 22 * u);
        ctx.stroke();
      }
    }));
    if (sp.art) {
      const aw = pw - pad * 2;
      this.art.setTexture(this.bank.canvas(`askArt-${sp.art.key}@${aw}x${artH}`, aw, artH, sp.art.draw));
    }
    const one = !sp.no;
    const bw = one ? Math.round(pw - pad * 2) : Math.round((pw - pad * 2 - gap) / 2);
    const by = ph - pad - bh;
    this.noR = one ? { x: 0, y: by, w: 0, h: 0 } : { x: pad, y: by, w: bw, h: bh };
    this.yesR = one ? { x: pad, y: by, w: bw, h: bh } : { x: pad + bw + gap, y: by, w: bw, h: bh };
    // R2 HUD grammar: "no" is the secondary (outlined) pill, "yes" the one primary (lantern gold + lip)
    if (!one) this.noBtn.setTexture(secondaryPill(this.bank, bw, bh, u));
    this.yesBtn.setTexture(primaryButton(this.bank, bw, bh - 4 * u, u));
    const bfs = Math.round(16 * u * Math.min(fk, 1.25));
    this.yesTxt.setFontSize(bfs).setFontStyle("bold").setText(sp.yes);
    this.noTxt.setFontSize(bfs).setFontStyle(vis.weight).setText(sp.no);
    for (const t of [this.yesTxt, this.noTxt]) if (t.width > bw - 12 * u) t.setScale((bw - 12 * u) / t.width);
    else t.setScale(1);
    this.artY = pad;
    this.titleY = pad + (artH ? artH + 10 * u : 0);
    this.textY = this.titleY + titleH;
  }
  private artY = 0;
  private titleY = 0;
  private textY = 0;

  show(spec: AskSpec, now: number): void {
    this.spec = spec;
    this.place();
    this.art.setVisible(!!spec.art);
    this.open = true;
    this.t0 = now;
    console.info(`[ask] ${spec.kind}`);
  }

  hide(now: number): void {
    if (!this.open) return;
    this.open = false;
    this.t0 = now;
  }

  hit(px: number, py: number): AskHit {
    if (!this.open) return "outside";
    const x = px - this.x0;
    const y = py - this.y0;
    const inR = (r: { x: number; y: number; w: number; h: number }): boolean => x >= r.x - 4 * this.u && x <= r.x + r.w + 4 * this.u && y >= r.y - 6 * this.u && y <= r.y + r.h + 6 * this.u;
    if (inR(this.yesR)) return "yes";
    if (this.spec?.no && inR(this.noR)) return "no";
    return x >= 0 && y >= 0 && x <= this.pw && y <= this.ph ? "inside" : "outside";
  }

  buttonCenter(which: "yes" | "no"): { x: number; y: number } {
    const r = which === "yes" ? this.yesR : this.noR;
    return { x: this.x0 + r.x + r.w / 2, y: this.y0 + r.y + r.h / 2 };
  }

  /** VoiceOver: the question (a static control) and the two buttons, canvas px. */
  controls(): { id: "ask" | "yes" | "no"; label: string; x: number; y: number; w: number; h: number }[] {
    if (!this.open || !this.spec) return [];
    const sp = this.spec;
    const at = (id: "yes" | "no", r: { x: number; y: number; w: number; h: number }, label: string) => ({ id, label, x: this.x0 + r.x, y: this.y0 + r.y, w: r.w, h: r.h });
    return [
      { id: "ask", label: sp.title ? `${sp.title}. ${sp.text}` : sp.text, x: this.x0, y: this.y0 + (sp.title ? this.titleY : this.textY), w: this.pw, h: this.text.height + (this.textY - this.titleY) },
      ...(sp.no ? [at("no", this.noR, sp.no)] : []),
      at("yes", this.yesR, sp.yes),
    ];
  }

  update(now: number): void {
    const t = motion.reduced ? 1 : clamp01((now - this.t0) / (this.open ? 260 : 180));
    const v = this.open ? easeOutCubic(t) : 1 - t;
    const on = v > 0.001;
    const one = !this.spec?.no;
    for (const o of this.objects) (o as Image).setVisible(on && (o !== this.art || !!this.spec?.art) && (o !== this.title || !!this.spec?.title) && !(one && (o === this.noBtn || o === this.noTxt)));
    if (!on) return;
    const dy = (1 - v) * 24 * this.u;
    const x0 = this.x0;
    const y0 = this.y0 + dy;
    this.dim.setAlpha(v);
    this.panel.setAlpha(v).setPosition(x0, y0);
    this.art.setAlpha(v).setPosition(x0 + this.pw / 2, y0 + this.artY);
    this.title.setAlpha(v).setPosition(x0 + this.pw / 2, y0 + this.titleY);
    this.text.setAlpha(v).setPosition(x0 + this.pw / 2, y0 + this.textY);
    this.noBtn.setAlpha(v).setPosition(x0 + this.noR.x, y0 + this.noR.y);
    this.yesBtn.setAlpha(v).setPosition(x0 + this.yesR.x, y0 + this.yesR.y);
    this.noTxt.setAlpha(v).setPosition(x0 + this.noR.x + this.noR.w / 2, y0 + this.noR.y + this.noR.h / 2);
    // the primary pill's face is 4 pt shorter than its box (the lip under it)
    this.yesTxt.setAlpha(v).setPosition(x0 + this.yesR.x + this.yesR.w / 2, y0 + this.yesR.y + this.yesR.h / 2 - 2 * this.u);
  }
}
