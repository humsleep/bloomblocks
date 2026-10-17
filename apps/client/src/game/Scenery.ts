// Everything above (and behind) the courtyard: dusk sky, hills, the distant
// hill town (one light per solved house), the current house with its windows,
// chimney smoke, twinkling stars, fireflies and the completion light motes.
// Particle budget: 6 stars + 16 fireflies + 3 smoke + 12 motes = 37 (≤ 40).
import Phaser from "../phaser.ts";
import type PhaserTypes from "phaser";
import { bakeBough, bakeFront, bakeSky, boughBox, moonPos, type SceneryGeom, steppingStones, type TownRows } from "../render/backdrop.ts";
import { drawGlow, drawPlate, farTowerGeom } from "../render/draw.ts";
import { drawHouse, type HouseSpec } from "../render/house.ts";
import { LH_BOX_BELOW, lanternHouseFor } from "../render/village/lanternHouse.ts";
import { rgba, PAL } from "../render/palette.ts";
import { rng } from "../render/rng.ts";
import type { TextureBank } from "../render/textures.ts";
import { scaledPt, vis } from "../render/vis.ts";
import { clamp01, easeInCubic, easeInOutCubic, easeOutCubic, lerp, motion } from "./motion.ts";
import { ambient, governor } from "./frameGovernor.ts";

type Image = PhaserTypes.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;
const N_FLY = 16;
const N_STAR = 6;
const N_SMOKE = 3;
const N_MOTE = 12;

export const DEPTH = { sky: 0, stars: 1, town: 2, house: 3, smoke: 4, front: 5, board: 7, fireflies: 8, motes: 9, hud: 10 } as const;

/** The scenery of a scene (BoardView.playFinale finds it here when the caller passes none). */
export const sceneryOf = new WeakMap<PhaserTypes.Scene, Scenery>();

export class Scenery {
  private sky: Image;
  private front: Image;
  /** the moon: real phase of the day, the daily's entrance (breathes while today's daily is open) */
  private moonImg: Image;
  private moonPhase = -1;
  moonBreath = true;
  moonX = 0;
  moonY = 0;
  moonR = 0;
  private house: PhaserTypes.GameObjects.Container;
  private houseImg: Image;
  private winImgs: Image[] = [];
  private heartGlow: Image;
  /** house number plate = the level number, in-world (≥ 20 pt digits, ≈ 14:1) */
  private plate: Image;
  private plateText: Image;
  private plateN = 0;
  private plateCap = 0;
  private houseX = 0;
  /** extra x offset for the house (next house slides in from the right) */
  houseShift = 0;
  private winA = new Float32Array(8);
  private winFrom = new Float32Array(8);
  private winTo = new Float32Array(8);
  private winT0 = new Float64Array(8);
  private spec: HouseSpec | null = null;
  private hs = 1; // px per house unit
  private stars: Image[] = [];
  private smoke: Image[] = [];
  /** distant lights, one per cleared gentle level: the village on the far hill */
  private town: Image[] = [];
  private townPts: TownRows = { gentle: [], tower: { x: 0, y: 0 }, home: { x: 0, y: 0 } };
  private townLit = 0;
  private townT0 = -1e9;
  // round 5: the deduce track is a place — a tower on the far ridge (seen from home), and the
  // home house on the far hill (seen from the tower's courtyard)
  private farTower!: Image;
  private towerWins: Image[] = [];
  private towerBeacon!: Image;
  private towerRoom!: Image;
  private farHome!: Image;
  /** the far home's window breathes (U's request 4: "a breathing window drawn into the far home") */
  private farHomeWin!: Image;
  private farPlate!: Image;
  /** v14 (Reality G1 #26): the lantern-house's number hangs on a little signpost beside it, not over the door */
  private platePost!: Image;
  private farPlateText!: Image;
  private farCap = 0;
  private far = { mode: "gentle" as "gentle" | "deduce", lit: 0, beacon: false, unlocked: false, towerLevel: 1, homeLevel: 1 };
  private towerLitT0 = -1e9;
  private beaconT0 = -1e9;
  private towerW = 0;
  private towerH = 0;
  private towerHidden = false;
  private flies: Image[] = [];
  private motes: Image[] = [];
  private moonHalo!: Image;
  private incoming!: Image;
  private boardGlow!: Image;
  private incomingKey = "";
  private incT0 = -1e9;
  private incOff = -1e9;
  private incReduced = false;
  /** the incoming silhouette is shown (finale hold) */
  incomingOn = false;
  private lastFit = { maxW: 1, maxH: 1, u: 1 };
  // v9 finale (playFinale): sky warmth overlay, light pools under lit lower windows, camera push
  private skyWarm!: Image;
  /** v9: the bough with its hanging lantern (right sky); hidden on the tower screen (floor column) */
  private bough!: Image;
  private winPools: Image[] = [];
  private fin = { on: false, t0: 0, reduced: false, end: 0, z0: 1, sx0: 0, sy0: 0, next: 0, flipped: false, cam: false, preview: -1, alley: false, len: 2600, ax: 0, ay: 0, cutAt: -1, zCut: 1 };
  /** the town light this finale previewed (setTown then does not flash it again) */
  private townPreviewed = -1;
  private geom: SceneryGeom | null = null;
  private skyKey = "";
  private frontKey = "";
  houseBaseY = 0;
  private smokeX = 0;
  private smokeY = 0;
  /** extra y offset for the house (slide in/out) */
  houseOffset = 0;
  decorated = false;

  // firefly state (typed arrays, no per-frame allocation)
  private fHX = new Float32Array(N_FLY);
  private fHY = new Float32Array(N_FLY);
  private fAX = new Float32Array(N_FLY);
  private fAY = new Float32Array(N_FLY);
  private fFq = new Float32Array(N_FLY);
  private fPh = new Float32Array(N_FLY);
  private fW = new Float32Array(N_FLY);
  private fTX = new Float32Array(N_FLY);
  private fTY = new Float32Array(N_FLY);
  private fGoal = new Uint8Array(N_FLY);
  private riseT0 = -1e9;
  // motes
  private mSX = new Float32Array(N_MOTE);
  private mSY = new Float32Array(N_MOTE);
  private mT0 = new Float64Array(N_MOTE);
  private mDur = 520;
  private mTX = 0;
  private mTY = 0;
  private mActive = false;

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
  ) {
    const s = scene;
    sceneryOf.set(scene, this);
    this.sky = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(DEPTH.sky);
    // ambient(): breathing / flicker / drift that reads the same at the governor's 20 fps (frameGovernor.ts)
    this.moonImg = ambient(s.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.stars));
    this.house = s.add.container(0, 0).setDepth(DEPTH.house);
    this.houseImg = s.add.image(0, 0, "__DEFAULT");
    this.heartGlow = ambient(s.add.image(0, 0, "__DEFAULT").setBlendMode(ADD).setVisible(false));
    this.platePost = s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0).setVisible(false);
    this.plate = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.plateText = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.house.add([this.houseImg, this.heartGlow]);
    for (let k = 0; k < 8; k++) {
      const w = ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false));
      this.winImgs.push(w);
      this.house.add(w);
    }
    this.house.add([this.platePost, this.plate, this.plateText]);
    this.front = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(DEPTH.front);
    // reduce motion: a still halo ring marks the moon while today's daily waits (instead of breathing)
    this.moonHalo = s.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.stars).setVisible(false);
    // finale hold (audit P1-10): the next house's silhouette + a breathing light where the board goes
    this.incoming = s.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.house).setVisible(false);
    this.boardGlow = s.add.image(0, 0, "__DEFAULT").setBlendMode(ADD).setDepth(DEPTH.board).setVisible(false);
    this.bough = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(DEPTH.town).setVisible(false);
    this.skyWarm = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setBlendMode(ADD).setDepth(DEPTH.sky + 0.5).setVisible(false);
    for (let k = 0; k < 6; k++) this.winPools.push(s.add.image(0, 0, "__DEFAULT").setBlendMode(ADD).setDepth(DEPTH.front + 0.2).setVisible(false));
  }

  /** Bake the static layers for this screen. Cheap enough for the first frame (gradients + a few paths). */
  layout(g: SceneryGeom): void {
    this.geom = g;
    const k = Math.min(1, 2 / g.u); // bake at ≤2x: soft shapes, a third of the pixels on 3x phones
    const skyH = g.crestY + 40 * g.u;
    const key = `sky@${g.W}x${Math.round(skyH)}:${Math.round(g.houseBaseY)}`;
    let town: TownRows = { gentle: [], tower: { x: 0, y: 0 }, home: { x: 0, y: 0 } };
    if (key !== this.skyKey) {
      if (this.skyKey) this.bank.remove(this.skyKey);
      this.skyKey = this.bank.canvas(key, g.W * k, skyH * k, (ctx) => {
        town = bakeSky(ctx, g, k);
      });
      this.townPts = town;
    }
    this.sky.setTexture(this.skyKey).setScale(1 / k).setPosition(0, 0);
    {
      const b = boughBox(g);
      const bk = this.bank.canvas(`bough@${g.W}x${Math.round(b.y)}`, b.w * k, b.h * k, (ctx) => bakeBough(ctx, g, k));
      this.bough.setTexture(bk).setScale(1 / k).setPosition(b.x, b.y).setVisible(this.far.mode === "gentle");
    }
    {
      // finale warmth: skyGlow strongest at the horizon, baked tiny and stretched (it is a gradient)
      const wk = this.bank.canvas(`skyWarm@${Math.round(skyH / 8)}`, 8, Math.max(8, Math.round(skyH / 8)), (ctx, w, h) => {
        const gg = ctx.createLinearGradient(0, 0, 0, h);
        gg.addColorStop(0, "rgba(232,160,138,0.08)");
        gg.addColorStop(0.6, "rgba(232,160,138,0.3)");
        gg.addColorStop(1, "rgba(255,190,140,0.55)");
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, w, h);
      });
      this.skyWarm.setTexture(wk).setDisplaySize(g.W, skyH).setPosition(0, 0);
    }
    const m = moonPos(g);
    this.moonX = m.x;
    this.moonY = m.y;
    this.moonR = m.r;
    if (this.moonPhase >= 0) this.setMoon(this.moonPhase);
    const frontTop = g.crestY - 18 * g.u;
    const frontH = g.H - frontTop;
    const hudSig = g.hud?.length ? `:${Math.round((g.hud[0]!.y - g.crestY) / (8 * g.u))}` : "";
    const fkey = `front@${g.W}x${Math.round(frontH)}${hudSig}`;
    if (fkey !== this.frontKey) {
      if (this.frontKey) this.bank.remove(this.frontKey);
      this.frontKey = this.bank.canvas(fkey, g.W * k, frontH * k, (ctx) => bakeFront(ctx, g, k, frontH));
    }
    this.front.setTexture(this.frontKey).setScale(1 / k).setPosition(0, frontTop);
    this.houseBaseY = g.houseBaseY;
    if (this.decorated) this.placeDecor();
  }

  /** Moon with phase p ∈ [0, 1) (0 = new, 0.5 = full). */
  setMoon(p: number): void {
    this.moonPhase = p;
    if (!this.geom) return;
    const size = Math.round(this.moonR / 0.2);
    this.moonImg.setTexture(this.bank.moon(size, p)).setPosition(this.moonX, this.moonY);
  }

  /** Second-frame work: live particles (stars, fireflies, smoke, town lights). */
  decorate(): void {
    if (this.decorated || !this.geom) return;
    this.decorated = true;
    const s = this.scene;
    const u = this.geom.u;
    const star = this.bank.star(Math.round(9 * u));
    for (let k = 0; k < N_STAR; k++) this.stars.push(ambient(s.add.image(0, 0, star).setBlendMode(ADD).setDepth(DEPTH.stars)));
    const fly = this.bank.firefly(Math.round(16 * u));
    for (let k = 0; k < N_FLY; k++) this.flies.push(ambient(s.add.image(0, 0, fly).setBlendMode(ADD).setDepth(DEPTH.fireflies).setAlpha(0)));
    const smoke = this.bank.smoke(Math.round(26 * u));
    for (let k = 0; k < N_SMOKE; k++) {
      const im = ambient(s.add.image(0, 0, smoke).setDepth(DEPTH.smoke).setVisible(false));
      this.smoke.push(im);
    }
    const mote = this.bank.firefly(Math.round(30 * u));
    for (let k = 0; k < N_MOTE; k++) this.motes.push(s.add.image(0, 0, mote).setBlendMode(ADD).setDepth(DEPTH.motes).setVisible(false));
    const townKey = this.bank.canvas(`town@${Math.round(u)}`, 14 * u, 14 * u, (ctx, w) => {
      drawGlow(ctx, w / 2, w / 2, w / 2, [[0, rgba(PAL.flame, 0.8)], [0.4, rgba(PAL.flame, 0.25)], [1, rgba(PAL.flame, 0)]]);
      ctx.fillStyle = PAL.windowLitCore;
      ctx.fillRect(w / 2 - 1.3 * u, w / 2 - 1.3 * u, 2.6 * u, 2.6 * u);
    });
    for (let k = 0; k < 12; k++) this.town.push(s.add.image(0, 0, townKey).setDepth(DEPTH.town).setVisible(false));
    // far tower + far home (textures per size in placeDecor)
    this.farTower = s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 1).setDepth(DEPTH.town);
    for (let k = 0; k < 5; k++) this.towerWins.push(ambient(s.add.image(0, 0, townKey).setDepth(DEPTH.town).setVisible(false)));
    this.towerRoom = s.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.town).setVisible(false);
    this.towerBeacon = ambient(s.add.image(0, 0, this.bank.windowGlow(Math.round(70 * u))).setBlendMode(ADD).setDepth(DEPTH.town).setVisible(false));
    this.farHome = s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 1).setDepth(DEPTH.town).setVisible(false);
    this.farHomeWin = ambient(s.add.image(0, 0, this.bank.windowGlow(Math.round(22 * u))).setBlendMode(ADD).setDepth(DEPTH.town).setVisible(false));
    this.farPlate = s.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.town).setVisible(false);
    this.farPlateText = s.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.town).setVisible(false);

    this.placeDecor();
  }

  private placeDecor(): void {
    const g = this.geom!;
    const r = rng(0x51a2);
    // R2 (Reality #11): no twinkle / firefly over a HUD disc (radius + 8 pt); a few retries, same seed
    const keep = g.keep ?? [];
    const clear = (x: number, y: number, pad: number): boolean => keep.every((b) => Math.hypot(x - b.x, y - b.y) > b.r + 8 * g.u + pad);
    for (const st of this.stars) {
      let x = 0;
      let y = 0;
      for (let k = 0; k < 6; k++) {
        x = r() * g.W;
        y = g.safeTop + 10 * g.u + r() * (g.houseBaseY - g.safeTop) * 0.4;
        if (clear(x, y, 5 * g.u)) break;
      }
      st.setPosition(x, y).setScale(0.5 + r() * 0.6).setVisible(clear(x, y, 5 * g.u));
    }
    const top = g.safeTop + (g.houseBaseY - g.safeTop) * 0.3;
    for (let k = 0; k < N_FLY; k++) {
      this.fAX[k] = (14 + r() * 26) * g.u;
      this.fAY[k] = (8 + r() * 16) * g.u;
      for (let j = 0; j < 6; j++) {
        this.fHX[k] = g.W * (0.05 + 0.9 * r());
        this.fHY[k] = lerp(top, g.crestY + 24 * g.u, r());
        if (clear(this.fHX[k]!, this.fHY[k]!, Math.max(this.fAX[k]!, this.fAY[k]!) + 8 * g.u)) break;
      }
      this.fFq[k] = 0.00025 + r() * 0.0004;
      this.fPh[k] = r() * 100;
      this.flies[k]!.setScale(0.45 + r() * 0.45);
    }
    const pts = this.townPts.gentle;
    for (let k = 0; k < this.town.length; k++) {
      const p = pts[k];
      if (p) this.town[k]!.setPosition(p.x, p.y);
    }
    this.setTown(this.townLit, false, 0);
    // far tower: 26 × 96 pt on the ridge; its windows and lantern room are live lights
    const u = g.u;
    // audit P1-14: on short screens (< 700 pt, iPhone SE) the tower is 0.8× so it clears the gear
    let small = g.H / u < 700 ? 0.8 : 1;
    // R2: and never up into the top HUD row (its captions sit under the discs now)
    const tpy = this.townPts.tower.y;
    // v14 (Reality G1 #25): it shrinks as far as it must to stay under the captions (SE ≈ 0.28×). It is the
    // deduce track's door, so it is ALWAYS drawn where it is tappable (lead: no invisible tap target); its
    // tap target keeps ≥ 48 pt. (towerHidden stays as a guard for a screen with no room at all.)
    const room = g.topBottom !== undefined && tpy > 0 ? (tpy - g.topBottom - 4 * u) / (96 * u) : 1;
    this.towerHidden = room < 0.12;
    if (g.topBottom !== undefined && tpy > 0) small = Math.max(0.12, Math.min(small, room));
    const tw = Math.round(26 * u * small);
    const th = Math.round(96 * u * small);
    this.towerW = tw;
    this.towerH = th;
    const tp = this.townPts.tower;
    this.farTower.setTexture(this.bank.farTower(tw, th)).setPosition(tp.x, tp.y);
    const tg = farTowerGeom(tw, th);
    const ox = tp.x - tw / 2;
    const oy = tp.y - th;
    tg.windows.forEach((w, k) => this.towerWins[k]!.setPosition(ox + w.x, oy + w.y).setScale(0.8));
    this.towerRoom.setTexture(this.bank.litWindow(tw * 0.26, th * 0.14, false)).setPosition(ox + tg.beacon.x, oy + tg.beacon.y);
    this.towerBeacon.setPosition(ox + tg.beacon.x, oy + tg.beacon.y);
    const hp = this.townPts.home;
    const fw = Math.round(34 * u);
    const fh = Math.round(36 * u);
    this.farHome.setTexture(this.bank.farHome(fw, fh)).setPosition(hp.x, hp.y);
    this.farHomeWin.setPosition(hp.x - 0.1512 * fw, hp.y - 0.2964 * fh);
    this.layoutFarPlate();
    this.applyFar();
    // moon halo (reduce motion) + the finale-hold placeholders
    const mh = Math.round(this.moonR * 4.2);
    this.moonHalo.setTexture(this.bank.ringColor(mh, u, PAL.moon)).setPosition(this.moonX, this.moonY);
    this.incomingKey = "";
  }

  /** Far plate digits: max(14, 11 × text size) pt (audit P1-6; v6 was 11 pt). */
  private layoutFarPlate(): void {
    const u = this.geom!.u;
    const fpt = Math.max(14, scaledPt(11, 20));
    const pw = Math.round((fpt * 0.64 * 2 + 8) * u);
    const ph = Math.round((fpt + 4) * u);
    this.farPlate.setTexture(this.bank.canvas(`farPlate@${pw}x${ph}`, pw, ph, (ctx, w, h) => drawPlate(ctx, w, h, u, "deduce")));
    this.farCap = Math.round(fpt * u * 0.72);
  }

  /** Text size / bold changed: plates are re-laid (the house plate on the next setHouse). */
  refreshPlates(): void {
    if (!this.decorated) return;
    this.layoutFarPlate();
    this.applyFar();
    if (this.plateN > 0) this.plateText.setTexture(this.bank.numerals(String(this.plateN), this.plateCap));
  }

  /** Village lights for solved gentle houses. */
  setTown(cleared: number, animate: boolean, now: number): void {
    const n = Math.min(cleared, this.townPts.gentle.length, this.town.length);
    if (animate && n > this.townLit && this.townPreviewed !== n - 1) this.townT0 = now;
    this.townPreviewed = -1;
    this.townLit = n;
    for (let k = 0; k < this.town.length; k++) this.town[k]!.setVisible(k < n);
  }

  /**
   * The far landmark: on the gentle track the tower (left ridge; its windows = deduce
   * levels cleared, the lantern room lit once the tower is open), on the deduce track the
   * home house (right hill). Each carries a small door plate with its own level.
   */
  setFar(mode: "gentle" | "deduce", o: { cleared: number; unlocked: boolean; beacon: boolean; towerLevel: number; homeLevel: number }, animate: boolean, now: number): void {
    const lit = Math.min(5, o.cleared);
    if (animate && lit > this.far.lit) this.towerLitT0 = now;
    if (animate && o.beacon && !this.far.beacon) this.beaconT0 = now;
    this.far = { mode, lit, beacon: o.beacon, unlocked: o.unlocked, towerLevel: o.towerLevel, homeLevel: o.homeLevel };
    this.applyFar();
  }

  /** First unlock: the lantern room and the windows light up one by one (≈ 0.8 s). */
  revealTower(now: number): void {
    this.far.beacon = true;
    this.far.unlocked = true;
    this.beaconT0 = now;
    this.towerLitT0 = now + 250;
    this.applyFar();
  }

  private applyFar(): void {
    if (!this.decorated) return;
    const f = this.far;
    const tower = f.mode === "gentle";
    this.farTower.setVisible(tower && !this.towerHidden).setAlpha(f.unlocked ? 1 : 0.8);
    this.farHome.setVisible(!tower);
    this.bough.setVisible(tower);
    this.farHomeWin.setVisible(!tower);
    const tv = tower && !this.towerHidden;
    for (let k = 0; k < this.towerWins.length; k++) this.towerWins[k]!.setVisible(tv && k < f.lit);
    this.towerRoom.setVisible(tv && f.beacon);
    this.towerBeacon.setVisible(tv && f.beacon);
    // the landmark's own door plate (its track's level)
    const show = tower ? f.unlocked : true;
    const n = tower ? f.towerLevel : f.homeLevel;
    const p = tower ? this.townPts.tower : this.townPts.home;
    // the tower's plate hangs at its door; the far home's above its roof (it is too small for a door plate)
    const ph = this.farPlate.height;
    const py = tower ? p.y - Math.max(12 * this.geom!.u, ph / 2 + 2 * this.geom!.u) : p.y - 38 * this.geom!.u - ph / 2;
    const px = p.x + (tower ? 0 : 0);
    // v14 (Reality G1 #25, R11): no number plate on the far landmark (it overlapped the Settings caption on SE)
    void show;
    void n;
    this.farPlate.setVisible(false).setPosition(px, py);
    this.farPlateText.setVisible(false);
  }

  /** World centre of the far landmark that is shown (tap target / camera pan target), and its hit half-size. */
  get farTarget(): { x: number; y: number; hw: number; hh: number; kind: "tower" | "home" } {
    const u = this.geom?.u ?? 1;
    if (this.far.mode === "gentle") {
      const p = this.townPts.tower;
      // never an invisible tap target: a tower that is not drawn has no hit box
      if (this.towerHidden) return { x: -1e4, y: -1e4, hw: 0, hh: 0, kind: "tower" };
      return { x: p.x, y: p.y - this.towerH * 0.5, hw: Math.max(24 * u, this.towerW), hh: Math.max(24 * u, this.towerH * 0.55), kind: "tower" };
    }
    const p = this.townPts.home;
    return { x: p.x, y: p.y - 18 * u, hw: 26 * u, hh: 26 * u, kind: "home" };
  }

  /** Is (px, py) on a village house (far hill, gentle lights)? 44 pt targets. */
  villageAt(px: number, py: number): boolean {
    const r = 22 * (this.geom?.u ?? 1);
    for (const p of this.townPts.gentle) if (Math.abs(px - p.x) <= r && Math.abs(py - p.y) <= r) return true;
    return false;
  }

  /** New house for a level. (cx, baseY) = body bottom-centre; fits in maxW × maxH. */
  setHouse(spec: HouseSpec, cx: number, baseY: number, maxW: number, maxH: number, u: number, plate: { n: number; track: "gentle" | "deduce" }): void {
    this.spec = spec;
    const wHu = spec.left + spec.right;
    const s = Math.min(maxW / wHu, maxH / spec.top, 230 * u);
    this.hs = s;
    const tw = Math.ceil(wHu * s);
    const th = Math.ceil((spec.top + 0.05) * s);
    const key = `house:${spec.seed}@${Math.round(s)}`;
    const old = this.houseImg.texture.key;
    this.bank.canvas(key, tw, th, (ctx) => drawHouse(ctx, spec, spec.left * s, spec.top * s, s, u));
    if (old !== key && old.startsWith("house:")) this.bank.remove(old);
    this.houseImg.setTexture(key).setOrigin(spec.left / wHu, spec.top / (spec.top + 0.05)).setPosition(0, 0);
    this.houseX = cx;
    this.house.setPosition(cx + this.houseShift, baseY + this.houseOffset);
    this.houseBaseY = baseY;
    const label = plate.n > 0 ? String(plate.n) : "";
    const d = spec.door;
    // round 5 (Denise: "the plate number is small"): digits ≥ 20 pt (22 pt on roomy doors), ink
    // #1E1A33 on the cream / moonlit enamel ≈ 14:1; the plate may overhang a narrow door
    // phase 2 (audit P1-6): × iOS text size, up to 34 pt
    const { fpt, pw, ph } = housePlateSize(label, d.h * s, u);
    const pkey = this.bank.canvas(`plate-${plate.track}-${pw}x${ph}`, pw, ph, (ctx, w, h) => drawPlate(ctx, w, h, u, plate.track));
    let py = Math.max(-d.h * s * 0.68, -d.h * s + ph / 2 + 2 * u);
    // v14 (Reality re-review #4): the plate never touches a window (or its flower box) above it
    for (let k = 1; k < spec.windows.length; k++) {
      const w = spec.windows[k]!;
      if (Math.abs(w.x - d.x) * s >= pw / 2 + (w.w * s) / 2 + 2 * u) continue;
      const bottom = (w.y + w.h / 2 + (w.glass === "lantern" ? LH_BOX_BELOW : 0)) * s;
      if (bottom < py) py = Math.max(py, bottom + ph / 2 + 3 * u);
    }
    let px = d.x * s;
    if (spec.kind === "lantern") {
      // beside the house on a wooden post (the door stays visible at every size; SE included)
      px = (58 / 128) * s + 4 * u + pw / 2;
      py = -(ph / 2 + 14 * u);
      const postW = Math.max(3, Math.round(4 * u));
      const postH = Math.round(14 * u + ph / 2 + 2 * u);
      this.platePost.setTexture(this.bank.canvas(`platePost@${postW}x${postH}`, postW, postH, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "#A57B5C");
        g.addColorStop(0.45, "#7A5440");
        g.addColorStop(1, "#4A3328");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, w / 2);
        ctx.fill();
      })).setPosition(px, py).setVisible(label !== "");
    } else this.platePost.setVisible(false);
    this.plate.setTexture(pkey).setPosition(px, py).setVisible(label !== "");
    this.plateN = plate.n;
    this.plateCap = Math.round(fpt * u * 0.72);
    if (label !== "") this.plateText.setTexture(this.bank.numerals(label, this.plateCap));
    this.plateText.setPosition(px, py - 0.5 * u).setScale(1).setVisible(label !== "");
    this.lastFit = { maxW, maxH, u };
    for (let k = 0; k < this.winImgs.length; k++) {
      const w = spec.windows[k];
      const im = this.winImgs[k]!;
      this.winA[k] = 0;
      this.winTo[k] = 0;
      this.winFrom[k] = 0;
      this.winT0[k] = -1e9;
      if (!w) {
        im.setVisible(false);
        continue;
      }
      im.setTexture(this.bank.litWindow(w.w * s, w.h * s, w.round, w.glass)).setPosition(w.x * s, w.y * s).setVisible(false);
    }
    // light pools on the ground under the lit lower windows (ADD ≈ 25 %)
    for (let k = 0; k < this.winPools.length; k++) {
      const w = spec.windows[k];
      const im = this.winPools[k]!;
      if (!w || k === 0 || w.y < -spec.bodyH * 0.5) {
        im.setVisible(false).setData("w", -1);
        continue;
      }
      const pw = Math.round(w.w * s * 2.8);
      const ph = Math.max(8, Math.round(12 * u));
      im.setTexture(this.bank.canvas(`winPool@${pw}x${ph}`, pw, ph, (ctx, a, b) => {
        ctx.save();
        ctx.scale(1, b / a);
        drawGlow(ctx, a / 2, a / 2, a / 2, [[0, "rgba(255,200,120,0.6)"], [0.5, "rgba(255,180,100,0.22)"], [1, "rgba(255,170,90,0)"]]);
        ctx.restore();
      })).setData("w", k).setData("dx", w.x * s).setVisible(false);
    }
    const heart = spec.windows[0]!;
    this.heartGlow.setTexture(this.bank.windowGlow(Math.round(heart.w * s * 6))).setPosition(heart.x * s, heart.y * s).setVisible(false);
    // smoke source
    if (spec.chimney) {
      const c = spec.chimney;
      this.smokeX = c.x * s;
      this.smokeY = (-spec.bodyH - c.h - 0.1) * s;
    }
  }

  /** Progress windows lit: count k of (n-1). Heart window via lightHeart(). */
  setProgress(k: number, now: number, animate: boolean): void {
    const sp = this.spec;
    if (!sp) return;
    for (let j = 0; j < sp.order.length; j++) {
      const w = sp.order[j]!;
      this.fadeWindow(w, j < k ? 1 : 0, now, animate ? j * 60 : 0, animate);
    }
  }

  lightHeart(on: boolean, now: number, animate: boolean): void {
    this.fadeWindow(0, on ? 1 : 0, now, 0, animate);
  }

  private fadeWindow(w: number, to: number, now: number, delay: number, animate: boolean): void {
    if (this.winTo[w] === to && (animate || this.winA[w] === to)) return;
    this.winFrom[w] = this.winA[w]!;
    this.winTo[w] = to;
    this.winT0[w] = animate ? now + delay : -1e9;
    if (!animate) this.winA[w] = to;
  }

  /** Height of the current house drawing, px (for sinking it behind the hill). */
  /** v12 (Wick): the house number plate's box in world px, or null when it is not shown. */
  plateBox(): { x: number; y: number; w: number; h: number } | null {
    if (!this.plate.visible) return null;
    const w = this.plate.displayWidth * this.house.scaleX;
    const h = this.plate.displayHeight * this.house.scaleY;
    return { x: this.house.x + this.plate.x * this.house.scaleX - w / 2, y: this.house.y + this.plate.y * this.house.scaleY - h / 2, w, h };
  }

  /** v12 (Wick): the stepping stones (world px) of the current layout. */
  stones(): { x: number; y: number; rx: number; ry: number }[] {
    return this.geom ? steppingStones(this.geom) : [];
  }

  get houseHeight(): number {
    return (this.spec?.top ?? 1) * this.hs;
  }

  heartWorld(): { x: number; y: number } {
    const h = this.spec?.windows[0];
    if (!h) return { x: this.house.x, y: this.house.y };
    return { x: this.house.x + h.x * this.hs, y: this.house.y + h.y * this.hs };
  }

  /** World points the fireflies should gather at (near-complete dark cells), or none. */
  setFireflyTargets(pts: readonly number[]): void {
    for (let k = 0; k < N_FLY; k++) this.fGoal[k] = 0;
    if (pts.length === 0) return;
    // the 3 closest-in-index fireflies per target
    const nT = pts.length / 2;
    for (let k = 0; k < Math.min(N_FLY, nT * 3); k++) {
      const t = k % nT;
      this.fGoal[k] = 1;
      this.fTX[k] = pts[t * 2]!;
      this.fTY[k] = pts[t * 2 + 1]!;
    }
  }

  rise(now: number): void {
    this.riseT0 = now;
  }

  /** Light flows from the board (world points) into the heart window. */
  flow(points: readonly number[], now: number, dur: number): void {
    if (!this.decorated) return;
    const t = this.heartWorld();
    this.mTX = t.x;
    this.mTY = t.y;
    this.mDur = dur;
    this.mActive = true;
    const n = points.length / 2;
    for (let k = 0; k < N_MOTE; k++) {
      this.mSX[k] = points[(k % n) * 2] ?? t.x;
      this.mSY[k] = points[(k % n) * 2 + 1] ?? t.y;
      this.mT0[k] = now + (k * 160) / N_MOTE;
      this.motes[k]!.setVisible(false);
    }
  }

  stopFlow(): void {
    this.mActive = false;
    for (const m of this.motes) m.setVisible(false);
  }

  /**
   * Finale hold (the worker is still making the next level): the next house's silhouette drifts
   * in from the right and settles a little right of centre; a soft light breathes where the
   * board will appear (`board` = its centre and size, canvas px). Off: both fade out (200 ms).
   */
  setIncoming(on: boolean, now: number, board?: { x: number; y: number; w: number; h: number }, reduced = motion.reduced): void {
    if (!this.decorated || !this.geom) return;
    if (!on) {
      if (this.incomingOn) {
        this.incomingOn = false;
        this.incOff = now;
      }
      return;
    }
    if (this.incomingOn) return;
    this.incomingOn = true;
    this.incT0 = now;
    this.incOff = -1e9;
    this.incReduced = reduced;
    const g = this.geom;
    if (!this.incomingKey) {
      // a generic house, flat dusk silhouette with a faint moonlit rim
      const spec = lanternHouseFor("incoming", 1);
      const f = this.lastFit;
      const wHu = spec.left + spec.right;
      const sc = Math.min(f.maxW / wHu, f.maxH / spec.top, 230 * f.u) * 0.92;
      const tw = Math.ceil(wHu * sc) + 4;
      const th = Math.ceil((spec.top + 0.05) * sc) + 4;
      this.incomingKey = this.bank.canvas(`incoming@${Math.round(sc)}`, tw, th, (ctx, w, h) => {
        drawHouse(ctx, spec, spec.left * sc + 2, spec.top * sc + 2, sc, f.u);
        ctx.globalCompositeOperation = "source-atop";
        const sg = ctx.createLinearGradient(0, 0, 0, h);
        sg.addColorStop(0, "#2A2346");
        sg.addColorStop(1, "#1A1631");
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      });
      this.incoming.setTexture(this.incomingKey).setOrigin(spec.left / wHu, 1);
    }
    if (board) {
      const gs = Math.round(Math.max(board.w, board.h) * 0.9);
      this.boardGlow
        .setTexture(this.bank.canvas(`boardGlow@${gs}`, gs, gs, (ctx, w) =>
          drawGlow(ctx, w / 2, w / 2, w / 2, [[0, "rgba(255,206,120,0.42)"], [0.45, "rgba(255,190,100,0.16)"], [1, "rgba(255,170,80,0)"]])))
        .setPosition(board.x, board.y);
    }
    this.incoming.setPosition(g.W / 2 + g.W, this.houseBaseY + 2 * g.u);
  }

  /** Where the incoming silhouette is now (house shift px), for the real house to continue from. */
  incomingShift(now: number, W: number): number {
    if (this.incReduced) return W;
    const t = clamp01((now - this.incT0) / 1400);
    return W * (1 - 0.62 * easeOutCubic(t));
  }

  setHouseOffset(dy: number): void {
    this.houseOffset = dy;
    this.house.y = this.houseBaseY + dy;
  }

  setHouseShift(dx: number): void {
    this.houseShift = dx;
    this.house.x = this.houseX + dx;
  }


  private stepIncoming(now: number): void {
    if (!this.decorated || !this.geom) return;
    const on = this.incomingOn;
    const out = on ? 0 : clamp01((now - this.incOff) / 200);
    if (!on && out >= 1) {
      if (this.incoming.visible) {
        this.incoming.setVisible(false);
        this.boardGlow.setVisible(false);
      }
      return;
    }
    const g = this.geom;
    const t = now - this.incT0;
    const fade = clamp01(t / 300) * (1 - out);
    const shift = this.incomingShift(now, g.W);
    if (!this.incReduced) this.incoming.setVisible(true).setPosition(g.W / 2 + shift, this.houseBaseY + 2 * g.u).setAlpha(0.85 * fade);
    const b = this.incReduced ? 0.6 : 0.45 + 0.4 * (0.5 - 0.5 * Math.cos((t / 1600) * Math.PI * 2));
    this.boardGlow.setVisible(true).setAlpha(b * fade).setScale(this.incReduced ? 1 : 0.96 + 0.04 * b);
  }

  /**
   * v9 finale, scenery side (phase 5 #6). From `now`: +400 ms the camera pushes 6 % toward the
   * heart window (600 ms ease-in-out-sine) while the house's windows light one by one at 90 ms;
   * +700 the sky warms toward skyGlow and fades back over 1.2 s, the village light this level earns
   * comes on and the next two flicker as a promise; +1200 the door plate turns to `nextNumber`
   * (if given); the camera eases back from 2.1 s; done at 2.6 s. Reduce Motion: windows (90 ms) and
   * the village light only, no camera, no sky, done at 1.0 s. `finaleDone(now)` / `skipFinale(now)`.
   */
  playFinale(o: { now: number; reduced?: boolean | undefined; camera?: boolean | undefined; nextNumber?: number | undefined; kind?: string | undefined }): number {
    const reduced = o.reduced ?? motion.reduced;
    const cam = this.scene.cameras.main;
    // "alley" (10th level of a block) = 1.5× longer, every window, the roof glows; "daily" = no camera
    const alley = o.kind === "alley";
    const len = reduced ? 1000 : alley ? 3900 : 2600;
    this.fin = { on: true, t0: o.now, reduced, end: o.now + len, z0: cam.zoom, sx0: cam.scrollX, sy0: cam.scrollY, next: o.nextNumber ?? 0, flipped: false, cam: o.camera !== false && o.kind !== "daily" && !reduced, preview: -1, alley, len, ax: 0, ay: 0, cutAt: -1, zCut: 1 };
    // the camera pushes toward where the heart window is NOW (fixed: the house may slide away later)
    const hw = this.heartWorld();
    this.fin.ax = hw.x;
    this.fin.ay = hw.y;
    const sp = this.spec;
    if (sp) {
      const start = reduced ? 0 : 400;
      const step = alley && !reduced ? 135 : 90;
      let k = 0;
      for (let j = 0; j < sp.order.length; j++) if (this.winTo[sp.order[j]!] !== 1) this.fadeWindow(sp.order[j]!, 1, o.now, start + step * k++, true);
      this.fadeWindow(0, 1, o.now, start + step * k + 120, true);
    }
    return this.fin.end;
  }

  get finaleOn(): boolean {
    return this.fin.on;
  }

  finaleDone(now: number): boolean {
    return !this.fin.on || now >= this.fin.end;
  }

  /** Jump the finale to its end state (tap to skip). */
  skipFinale(now: number): void {
    if (!this.fin.on) return;
    this.fin.end = now;
    this.stepFinale(now);
  }

  private stepFinale(now: number): void {
    const f = this.fin;
    if (!f.on) return;
    const t = now - f.t0;
    const cam = this.scene.cameras.main;
    const done = now >= f.end;
    // camera push toward the heart window
    if (f.cam) {
      // the caller moves the house away (or a new house arrives) before the end: ease the push
      // back over 300 ms from there instead of zooming into the next level
      if (f.cutAt < 0 && (this.houseShift !== 0 || this.houseOffset !== 0)) {
        f.cutAt = now;
        f.zCut = cam.zoom / f.z0;
      }
      const zin = clamp01((t - 400) / 600);
      const zout = clamp01((t - (f.len - 500)) / 500);
      const ease = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * x);
      let z = done ? 1 : 1 + 0.06 * ease(zin) * (1 - ease(zout));
      if (f.cutAt >= 0 && !done) z = 1 + (f.zCut - 1) * (1 - ease(clamp01((now - f.cutAt) / 300)));
      const cx = cam.width / 2;
      const cy = cam.height / 2;
      cam.setZoom(f.z0 * z);
      cam.setScroll(f.sx0 + (f.ax - cx) * (1 - 1 / z), f.sy0 + (f.ay - cy) * (1 - 1 / z));
    }
    // sky warmth: up over 400 ms from +700, back over 1.2 s
    if (!f.reduced) {
      const up = clamp01((t - 700) / 400);
      const down = clamp01((t - (f.alley ? 2200 : 1300)) / 1200);
      const w = done ? 0 : easeOutCubic(up) * (1 - easeInOutCubic(down));
      if (w > 0.005) this.skyWarm.setVisible(true).setAlpha(w);
      else if (this.skyWarm.visible) this.skyWarm.setVisible(false);
    }
    // the village light this level earns, and two more as a promise
    if (this.decorated && t >= (f.reduced ? 0 : 700)) {
      const k = this.townLit;
      if (f.preview < 0 && k < this.town.length && k < this.townPts.gentle.length) {
        f.preview = k;
        this.townPreviewed = k;
      }
      for (let j = 0; j < 3; j++) {
        const im = this.town[k + j];
        if (!im || k + j >= this.townPts.gentle.length) continue;
        const tj = t - (f.reduced ? 0 : 700) - j * 150;
        if (tj < 0) continue;
        const a = j === 0 ? clamp01(tj / 500) : f.reduced ? 0 : Math.sin(Math.PI * clamp01(tj / 900)) * 0.55;
        im.setVisible(a > 0.01 || j === 0).setAlpha(done && j > 0 ? 0 : a);
        if (done && j > 0) im.setVisible(false);
      }
    }
    // the door plate turns to the next number
    if (f.next > 0 && !f.flipped && t >= (f.reduced ? 600 : 1200)) {
      const ft = clamp01((t - (f.reduced ? 600 : 1200)) / 300);
      const sc = f.reduced ? 1 : Math.abs(Math.cos(Math.PI * ft));
      if (ft >= 0.5 && this.plateN !== f.next) {
        this.plateN = f.next;
        this.plateText.setTexture(this.bank.numerals(String(f.next), this.plateCap));
      }
      this.plateText.setScale(1, sc);
      this.plate.setScale(1, Math.max(0.15, sc));
      if (ft >= 1 || done) {
        f.flipped = true;
        this.plateText.setScale(1);
        this.plate.setScale(1);
      }
    }
    if (f.alley && !f.reduced) {
      const a = done ? 0 : Math.sin(Math.PI * clamp01((t - 900) / (f.len - 1200)));
      this.heartGlow.setScale(1 + 0.9 * a);
    }
    if (done) {
      f.on = false;
      this.heartGlow.setScale(1);
      if (f.cam) cam.setZoom(f.z0).setScroll(f.sx0, f.sy0);
      this.skyWarm.setVisible(false);
    }
  }

  private flyT = 0;

  update(now: number): void {
    this.stepFinale(now);
    const reduced = motion.reduced;
    // the moon breathes softly while today's daily waits (the only "come here" in the sky)
    if (this.moonBreath && !reduced) this.moonImg.setScale(1 + 0.05 * Math.sin(now / 700)).setAlpha(0.88 + 0.12 * Math.sin(now / 700));
    else this.moonImg.setScale(1).setAlpha(1);
    // audit P0-4: with Reduce Motion the waiting moon gets a still halo ring instead of breathing
    const halo = this.moonBreath && reduced && this.decorated;
    if (halo !== this.moonHalo.visible) this.moonHalo.setVisible(halo).setAlpha(0.7);
    this.stepIncoming(now);
    // windows
    for (let k = 0; k < this.winImgs.length; k++) {
      const im = this.winImgs[k]!;
      if (!this.spec || k >= this.spec.windows.length) continue;
      const t = (now - this.winT0[k]!) / (k === 0 ? 260 : 160);
      if (t >= 0 && t < 1) this.winA[k] = lerp(this.winFrom[k]!, this.winTo[k]!, easeOutCubic(t));
      else if (t >= 1) this.winA[k] = this.winTo[k]!;
      const a = this.winA[k]!;
      if (a > 0.01) {
        const flick = reduced ? 1 : 0.95 + 0.05 * Math.sin(now / 230 + k * 2.1) * Math.sin(now / 97 + k);
        im.setVisible(true).setAlpha(a * flick);
      } else if (im.visible) im.setVisible(false);
    }
    for (const pm of this.winPools) {
      const wk = pm.getData("w") as number;
      if (wk === undefined || wk < 0) continue;
      const a = this.winA[wk]!;
      if (a > 0.01) pm.setVisible(true).setAlpha(a * 0.5).setPosition(this.house.x + (pm.getData("dx") as number), this.houseBaseY + this.houseOffset + 5 * (this.geom?.u ?? 1));
      else if (pm.visible) pm.setVisible(false);
    }
    const ha = this.winA[0]!;
    if (ha > 0.01) this.heartGlow.setVisible(true).setAlpha(ha * (reduced ? 0.8 : 0.7 + 0.1 * Math.sin(now / 400)));
    else if (this.heartGlow.visible) this.heartGlow.setVisible(false);
    if (!this.decorated || !this.geom) return;
    const g = this.geom;
    // town (newest light fades in)
    {
      const last = this.townLit > 0 ? this.town[this.townLit - 1] : undefined;
      if (last) last.setAlpha(clamp01((now - this.townT0) / 600));
    }
    // far tower: windows light one after another, the lantern room breathes once open
    if (this.far.mode === "gentle") {
      for (let k = 0; k < this.towerWins.length; k++) {
        const w = this.towerWins[k]!;
        if (!w.visible) continue;
        const a = clamp01((now - this.towerLitT0 - k * 140) / 260);
        w.setAlpha(reduced ? 1 : a * (0.9 + 0.1 * Math.sin(now / 310 + k)));
      }
      if (this.far.beacon) {
        const b = clamp01((now - this.beaconT0) / 420);
        const breathe = reduced ? 1 : 0.8 + 0.2 * Math.sin(now / 900);
        this.towerRoom.setAlpha(b);
        this.towerBeacon.setAlpha(b * breathe * 0.9).setScale(reduced ? 1 : 1 + 0.6 * (1 - b) + 0.06 * Math.sin(now / 900));
      }
    }
    if (this.farHomeWin.visible) this.farHomeWin.setAlpha(reduced ? 0.8 : 0.55 + 0.45 * Math.sin(now / 1100));
    // stars
    for (let k = 0; k < this.stars.length; k++) {
      this.stars[k]!.setAlpha(reduced ? 0.6 : 0.25 + 0.75 * Math.abs(Math.sin(now / (900 + k * 170) + k)));
    }
    // smoke
    if (this.spec?.chimney && !reduced) {
      for (let k = 0; k < N_SMOKE; k++) {
        const sm = this.smoke[k]!;
        const t = ((now / 2600 + k / N_SMOKE) % 1 + 1) % 1;
        const x0 = this.house.x + this.smokeX;
        const y0 = this.house.y + this.smokeY;
        sm.setVisible(true)
          .setPosition(x0 + Math.sin(t * 3 + k) * 6 * g.u + t * 14 * g.u, y0 - t * 46 * g.u)
          .setScale(0.4 + t * 1.3)
          .setAlpha(Math.sin(Math.PI * t) * 0.85);
      }
    } else for (const sm of this.smoke) sm.setVisible(false);
    // fireflies
    const rk = (now - this.riseT0) / 1400;
    // gather easing: 2.5 % of the way per 60 Hz frame, made time-based so it is the same at the
    // governor's ambient rate; while fireflies are still flying to a target, stay at full rate
    const flyDt = Math.min(100, Math.max(0, now - this.flyT));
    this.flyT = now;
    const kW = 1 - Math.pow(0.975, flyDt / (1000 / 60));
    let gathering = false;
    for (let k = 0; k < N_FLY; k++) {
      const f = this.flies[k]!;
      const ph = this.fPh[k]!;
      const q = now * this.fFq[k]!;
      let x = this.fHX[k]! + (reduced ? 0 : Math.sin(q + ph) * this.fAX[k]! + Math.sin(q * 2.3 + ph * 0.7) * this.fAX[k]! * 0.3);
      let y = this.fHY[k]! + (reduced ? 0 : Math.cos(q * 1.3 + ph) * this.fAY[k]!);
      const goal = this.fGoal[k]!;
      const w = this.fW[k]! + ((goal ? 1 : 0) - this.fW[k]!) * kW;
      this.fW[k] = w;
      if (Math.abs((goal ? 1 : 0) - w) > 0.03) gathering = true;
      if (w > 0.001) {
        const ox = this.fTX[k]! + Math.cos(now / 700 + ph) * g.u * 16;
        const oy = this.fTY[k]! + Math.sin(now / 560 + ph) * g.u * 12;
        x = lerp(x, ox, w);
        y = lerp(y, oy, w);
      }
      let a = reduced ? 0.6 : 0.2 + 0.8 * Math.pow(Math.max(0, Math.sin(now / (520 + k * 37) + ph)), 2);
      if (w > 0.5) a = Math.max(a, 0.55);
      if (rk >= 0 && rk < 1 && !reduced) {
        y -= easeInCubic(rk) * (g.H * 0.45) * (0.6 + 0.4 * ((k * 7) % 5) / 4);
        a = Math.max(a, 0.8) * (1 - rk * rk);
      } else if (rk >= 1 && rk < 1.45) {
        a *= (rk - 1) / 0.45;
      }
      f.setPosition(x, y).setAlpha(a);
    }
    if (gathering) governor.keepAwake(200);
    // motes
    if (this.mActive) {
      let alive = false;
      for (let k = 0; k < N_MOTE; k++) {
        const m = this.motes[k]!;
        const t = (now - this.mT0[k]!) / this.mDur;
        if (t < 0) continue;
        if (t >= 1) {
          m.setVisible(false);
          continue;
        }
        alive = true;
        const e = easeInOutCubic(t);
        const sx = this.mSX[k]!;
        const sy = this.mSY[k]!;
        const cx = lerp(sx, this.mTX, 0.3) + (k % 2 ? 1 : -1) * 40 * g.u;
        const cy = Math.min(sy, this.mTY) - 50 * g.u;
        const ix = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * this.mTX;
        const iy = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * this.mTY;
        m.setVisible(true).setPosition(ix, iy).setScale(1.2 - 0.6 * e).setAlpha(Math.min(1, t * 6) * (1 - 0.3 * e));
      }
      if (!alive && now > this.mT0[N_MOTE - 1]! + this.mDur) this.mActive = false;
    }
  }
}

/**
 * The house number plate's size (px) for a door `doorPx` tall: digits ≥ 20 pt (22 on roomy doors),
 * × iOS text size up to 34 pt (round 5 / audit P1-6). Shared by setHouse and the lantern-house's room check.
 */
export function housePlateSize(label: string, doorPx: number, u: number): { fpt: number; pw: number; ph: number } {
  const base = Math.max(20, Math.min(22, (doorPx / u) * 0.5));
  const fpt = scaledPt(base, 34);
  const ph = Math.round((fpt + 8) * u);
  const pw = Math.round(Math.max(fpt * 1.7, fpt * 0.64 * label.length + 14) * u);
  return { fpt, pw, ph };
}
