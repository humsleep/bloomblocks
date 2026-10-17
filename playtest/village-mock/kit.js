// Duskwick village art kit (r2-village-art.md). Canvas2D only — every asset is a parametric path
// function, shaded by ONE recipe (base → key light → AO → rim → grain) under ONE light model:
//   key   warm afterglow from the upper LEFT (#FFD6B0)   → highlights on top-left edges
//   fill  cool sky from above (#9C8FD0)                  → lifts the shadow side, never black
//   local lantern / window light (#FFC864)               → pools on the ground, glows (additive)
//   ink   #3B2C45, never pure black; shadows are plum (#140F2C)
// Coordinates are pt; the page renders at dpr 3 (1290×2796 for 430×932).
(function () {
  const T = {
    skyTop: "#191838", skyMid: "#352C5E", skyMauve: "#77598C", skyRose: "#D18E9D", skyPeach: "#F4BFA0",
    hillFar: "#8B6CA0", hillMid: "#5E4A80", hillNear: "#3F3469", ground: "#302957", groundDeep: "#1D1938",
    grass: "#4B4A7A", grassHi: "#6A6A9E", moss: "#7FA678", leaf: "#4F7F68", leafHi: "#86C29C", leafLo: "#2E4D4B",
    wood: "#7A5440", woodHi: "#A57B5C", woodLo: "#4A3328", stone: "#8E88AE", stoneHi: "#D4D0E6", stoneLo: "#5B557E",
    paper: "#FFF3DE", paperLo: "#F2DCBC", cream: "#FFF3DE", ink: "#3B2C45", inkSoft: "#7A6A86",
    amber: "#FFC864", amberLip: "#D9983F", glow: "#FFD98A", pink: "#F6A7B8", mint: "#A8DCC8", lilac: "#C9B6F0", lemon: "#FFE59A", coral: "#F2907A",
    water: "#3C4A86", waterHi: "#7F95D6", plum: "#140F2C", key: "#FFD6B0", fill: "#9C8FD0",
    glass: "rgba(28,24,58,0.66)", glassLine: "rgba(255,243,222,0.38)",
  };
  const FONT = 'Fredoka, "Apple SD Gothic Neo", sans-serif';
  const HAND = '"Noteworthy", "Chalkboard SE", "Bradley Hand", Fredoka, sans-serif';
  // v2: letters use a bundleable face only (Patrick Hand / Gaegu / Klee One / LXGW WenKai, OFL — not installed here → Fredoka)
  const LETTER = '"Patrick Hand", Fredoka, "Apple SD Gothic Neo", sans-serif';

  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const mix = (a, b, t) => {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
    return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
  };
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const reseed = (s) => (seed = s >>> 0);

  // ---------------------------------------------------------------- shading recipe
  /**
   * One recipe for every solid: base fill, key light (upper-left warm → lower-right plum),
   * bottom AO, inner rim light on the top-left edge, inner shade on the bottom-right edge, outline.
   */
  function solid(ctx, path, base, box, o = {}) {
    const k = o.k ?? 1;
    ctx.fillStyle = base;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w * 0.55, box.y + box.h);
    g.addColorStop(0, hexA(T.key, (o.lit ?? 0.26) * k));
    g.addColorStop(0.45, hexA(T.key, 0));
    g.addColorStop(1, hexA(T.plum, (o.shade ?? 0.34) * k));
    ctx.fillStyle = g;
    ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    if (o.ao !== 0) {
      const a = ctx.createLinearGradient(0, box.y + box.h * 0.62, 0, box.y + box.h);
      a.addColorStop(0, hexA(T.plum, 0));
      a.addColorStop(1, hexA(T.plum, (o.ao ?? 0.22) * k));
      ctx.fillStyle = a;
      ctx.fillRect(box.x - 2, box.y, box.w + 4, box.h + 2);
    }
    const rw = o.rim ?? 1.6;
    if (rw > 0) {
      ctx.save();
      ctx.translate(rw, rw);
      ctx.lineWidth = rw * 2.2;
      ctx.strokeStyle = hexA(o.rimCol ?? T.key, (o.rimA ?? 0.55) * k);
      ctx.stroke(path);
      ctx.restore();
      ctx.save();
      ctx.translate(-rw * 0.8, -rw * 0.8);
      ctx.lineWidth = rw * 2;
      ctx.strokeStyle = hexA(T.plum, 0.22 * k);
      ctx.stroke(path);
      ctx.restore();
    }
    ctx.restore();
    if (o.tex) texture(ctx, path, box, o.tex, o.texA);
    if (o.line !== false) {
      // ONE outline rule everywhere (v2, Reality R4): 2.5 % of the object's on-screen height,
      // min 0.5 pt (1.5 px @3x), max 1.6 pt; colour = the fill pulled 55 % to plum, never darker than ink
      const ts = userScale(ctx);
      ctx.lineWidth = outlinePt(box.h * ts) / ts;
      ctx.lineJoin = "round";
      ctx.strokeStyle = typeof o.line === "string" ? o.line : base.startsWith("#") ? mix(base, T.ink, 0.55) : hexA(T.ink, 0.6);
      ctx.stroke(path);
    }
  }
  /** pt per user unit under the current transform (the page sets Kit.DPR). */
  function userScale(ctx) {
    const m = ctx.getTransform();
    return Math.hypot(m.a, m.b) / (window.Kit?.DPR ?? 3);
  }
  const OUTLINE = { k: 0.025, minPt: 0.5, maxPt: 1.6 };
  const outlinePt = (hPt) => Math.min(OUTLINE.maxPt, Math.max(OUTLINE.minPt, OUTLINE.k * hPt));
  /** Stroke width (user units) for a drawn line on an object `hUser` tall (handles, muntins, stems). */
  function lineW(ctx, hUser) {
    const ts = userScale(ctx);
    return outlinePt(hUser * ts) / ts;
  }
  let texC = null;
  /** Painterly material inside a shape: paper fibres, wood grain, foliage dabs, stone — soft-light noise. */
  function texture(ctx, path, box, kind, a) {
    if (!texC) {
      texC = document.createElement("canvas");
      texC.width = texC.height = 128;
      const x = texC.getContext("2d");
      const d = x.createImageData(128, 128);
      reseed(1234);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = 128 + (rnd() - 0.5) * 200;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      const b = document.createElement("canvas");
      b.width = b.height = 128;
      const bx = b.getContext("2d");
      bx.filter = "blur(0.6px)";
      bx.drawImage(texC, 0, 0);
      texC = b;
    }
    const ts = userScale(ctx);
    const S = { paper: [0.9, 0.12], wood: [1.6, 0.1], leaf: [0.22, 0.22], stone: [0.3, 0.3], cloth: [0.35, 0.35], grass: [0.5, 0.12] }[kind] ?? [0.3, 0.3];
    ctx.save();
    ctx.clip(path);
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = a ?? ({ paper: 0.3, wood: 0.24, cloth: 0.16, leaf: 0.3, stone: 0.25, grass: 0.3 }[kind] ?? 0.25);
    const pat = ctx.createPattern(texC, "repeat");
    pat.setTransform(new DOMMatrix([S[0] / ts, 0, 0, S[1] / ts, box.x, box.y]));
    ctx.fillStyle = pat;
    ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    ctx.restore();
  }
  const P = (fn) => {
    const p = new Path2D();
    fn(p);
    return p;
  };
  const rrect = (x, y, w, h, r) => P((p) => p.roundRect(x, y, w, h, r));
  const ellipseP = (x, y, rx, ry) => P((p) => p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2));

  function contact(ctx, x, y, rx, ry, a = 0.38) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, hexA(T.plum, a));
    g.addColorStop(0.6, hexA(T.plum, a * 0.45));
    g.addColorStop(1, hexA(T.plum, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function glow(ctx, x, y, r, col = T.glow, a = 0.5, sy = 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(x, y);
    ctx.scale(1, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, hexA(col, a));
    g.addColorStop(0.45, hexA(col, a * 0.35));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  let noiseC = null;
  function grain(ctx, w, h, a = 0.07) {
    if (!noiseC) {
      noiseC = document.createElement("canvas");
      noiseC.width = noiseC.height = 256;
      const x = noiseC.getContext("2d");
      const d = x.createImageData(256, 256);
      reseed(99);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = 128 + (rnd() - 0.5) * 120;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
    }
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = a;
    const pat = ctx.createPattern(noiseC, "repeat");
    pat.setTransform(new DOMMatrix([0.34, 0, 0, 0.34, 0, 0]));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  function vignette(ctx, w, h, a = 0.45) {
    const g = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.28, w / 2, h * 0.5, h * 0.75);
    g.addColorStop(0, hexA(T.plum, 0));
    g.addColorStop(1, hexA(T.plum, a));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ---------------------------------------------------------------- sky & land
  function sky(ctx, w, h, horizon) {
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, T.skyTop);
    g.addColorStop(0.38, T.skyMid);
    g.addColorStop(0.72, T.skyMauve);
    g.addColorStop(0.9, T.skyRose);
    g.addColorStop(1, T.skyPeach);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon + 40);
    // the afterglow sits LEFT (the key light's source); the right horizon cools to mauve
    const cool = ctx.createLinearGradient(0, 0, w, 0);
    cool.addColorStop(0, hexA("#77598C", 0));
    cool.addColorStop(0.55, hexA("#77598C", 0.15));
    cool.addColorStop(1, hexA("#5A4A86", 0.6));
    ctx.fillStyle = cool;
    ctx.fillRect(0, horizon * 0.55, w, horizon * 0.45 + 40);
    const ag = ctx.createRadialGradient(-30, horizon, 10, -30, horizon, w * 0.95);
    ag.addColorStop(0, hexA("#FFC9A0", 0.6));
    ag.addColorStop(0.5, hexA("#FFC9A0", 0.18));
    ag.addColorStop(1, hexA("#FFC9A0", 0));
    ctx.fillStyle = ag;
    ctx.fillRect(0, 0, w, horizon + 40);
    reseed(11);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * horizon * 0.62, r = rnd() < 0.1 ? 1.4 : 0.5 + rnd() * 0.6;
      ctx.fillStyle = hexA(T.cream, 0.35 + rnd() * 0.55);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.3);
      ctx.fill();
    }
  }
  function sparkle(ctx, x, y, r, col = T.cream, a = 1) {
    const k = r * 0.26;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + k, y - k, x + r, y);
    ctx.quadraticCurveTo(x + k, y + k, x, y + r);
    ctx.quadraticCurveTo(x - k, y + k, x - r, y);
    ctx.quadraticCurveTo(x - k, y - k, x, y - r);
    ctx.fill();
    ctx.restore();
  }
  /** THE moon (puzzle screen, village, room window): a dusky disc with its lit side to the right. */
  function moon(ctx, x, y, r, phase = 0.42) {
    glow(ctx, x, y, r * 3.6, "#FFF3DE", 0.16);
    const disc = P((q) => q.arc(x, y, r, 0, 6.3));
    ctx.fillStyle = "#3B3668";
    ctx.fill(disc);
    ctx.save();
    ctx.clip(disc);
    // the lit part: the disc minus an offset dark disc
    const lit = P((q) => {
      q.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
      q.ellipse(x, y, r * Math.abs(1 - 2 * phase), r, 0, Math.PI / 2, -Math.PI / 2, phase < 0.5);
    });
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, "#FFF8E6");
    g.addColorStop(1, "#EAD8B8");
    ctx.fillStyle = g;
    ctx.fill(lit);
    texture(ctx, disc, { x: x - r, y: y - r, w: r * 2, h: r * 2 }, "stone", 0.25);
    ctx.restore();
    ctx.lineWidth = Math.max(0.5, r * 0.05);
    ctx.strokeStyle = hexA("#FFF3DE", 0.35);
    ctx.stroke(disc);
  }
  function cloud(ctx, x, y, s, a = 0.5) {
    ctx.save();
    ctx.globalAlpha = a;
    const p = P((q) => {
      q.moveTo(x - 60 * s, y);
      q.bezierCurveTo(x - 62 * s, y - 16 * s, x - 40 * s, y - 22 * s, x - 28 * s, y - 14 * s);
      q.bezierCurveTo(x - 22 * s, y - 34 * s, x + 10 * s, y - 36 * s, x + 16 * s, y - 18 * s);
      q.bezierCurveTo(x + 34 * s, y - 28 * s, x + 62 * s, y - 16 * s, x + 58 * s, y);
      q.closePath();
    });
    const g = ctx.createLinearGradient(0, y - 36 * s, 0, y);
    g.addColorStop(0, "#C3A7C8");
    g.addColorStop(1, "#7E6497");
    ctx.filter = `blur(${2.2 * s}px)`;
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.filter = "none";
    ctx.save();
    ctx.clip(p);
    const lip = ctx.createLinearGradient(x - 60 * s, 0, x + 60 * s, 0);
    lip.addColorStop(0, hexA("#FFD6C0", 0.45));
    lip.addColorStop(0.5, hexA("#FFD6C0", 0));
    ctx.fillStyle = lip;
    ctx.fillRect(x - 64 * s, y - 40 * s, 128 * s, 44 * s);
    ctx.restore();
    ctx.restore();
  }
  /** A rolling hill band (top edge from a few sines), shaded and rim-lit along its crest. */
  function hill(ctx, w, y, amp, phase, col, h, rimA = 0.3) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const x = (w * i) / 40;
      pts.push([x, y - amp * (0.6 * Math.sin((x / w) * Math.PI * 1.6 + phase) + 0.4 * Math.sin((x / w) * Math.PI * 3.7 + phase * 1.9))]);
    }
    const p = P((q) => {
      q.moveTo(0, pts[0][1]);
      for (const [x, yy] of pts) q.lineTo(x, yy);
      q.lineTo(w, y + h);
      q.lineTo(0, y + h);
      q.closePath();
    });
    const g = ctx.createLinearGradient(0, y - amp, 0, y + h);
    g.addColorStop(0, mix(col, T.key, 0.08));
    g.addColorStop(1, mix(col, T.plum, 0.4));
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.translate(0, 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexA(T.key, rimA);
    ctx.beginPath();
    pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
    ctx.stroke();
    ctx.restore();
    return pts;
  }

  // ---------------------------------------------------------------- nature props
  function tree(ctx, x, y, s, tint = 0) {
    contact(ctx, x, y + 2 * s, 30 * s, 7 * s);
    const trunk = P((q) => q.roundRect(x - 5 * s, y - 34 * s, 10 * s, 36 * s, 4 * s));
    solid(ctx, trunk, T.wood, { x: x - 5 * s, y: y - 34 * s, w: 10 * s, h: 36 * s }, { rim: 1 });
    const lobes = [[0, -70, 30], [-22, -56, 22], [22, -54, 23], [-8, -88, 20], [14, -84, 19]];
    const leaf = mix(T.leaf, T.lilac, tint);
    const can = P((q) => {
      for (const [dx, dy, r] of lobes) {
        q.moveTo(x + (dx + r) * s, y + dy * s);
        q.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
      }
    });
    ctx.save();
    ctx.translate(1.4 * s, 1.8 * s);
    ctx.fillStyle = hexA(T.plum, 0.5);
    ctx.fill(can);
    ctx.restore();
    solid(ctx, can, leaf, { x: x - 45 * s, y: y - 108 * s, w: 90 * s, h: 76 * s }, { rim: 0, lit: 0.34, shade: 0.4, line: false });
    ctx.save();
    ctx.clip(can);
    ctx.fillStyle = hexA(T.leafHi, 0.28);
    for (const [dx, dy, r] of [[-14, -86, 14], [-26, -62, 10], [2, -96, 9]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
  }
  function bush(ctx, x, y, s, col = T.leaf, flowers = null) {
    contact(ctx, x, y + 1, 22 * s, 5 * s, 0.3);
    const p = P((q) => {
      for (const [dx, dy, r] of [[-12, -10, 11], [0, -15, 13], [13, -10, 11], [-4, -6, 10], [7, -6, 10]]) {
        q.moveTo(x + (dx + r) * s, y + dy * s);
        q.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
      }
    });
    ctx.save();
    ctx.translate(1 * s, 1.4 * s);
    ctx.fillStyle = hexA(T.plum, 0.5);
    ctx.fill(p);
    ctx.restore();
    solid(ctx, p, col, { x: x - 24 * s, y: y - 28 * s, w: 48 * s, h: 28 * s }, { rim: 0, lit: 0.34, line: false });
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = hexA(T.leafHi, 0.3);
    for (const [dx, dy, r] of [[-12, -16, 6], [0, -22, 6]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
    if (flowers) {
      reseed(Math.round(x * 13 + y));
      for (let i = 0; i < 6; i++) flower(ctx, x + (rnd() - 0.5) * 34 * s, y - (8 + rnd() * 16) * s, 2.6 * s, flowers[i % flowers.length]);
    }
  }
  function flower(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.283 - 1.57;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.62, r * 0.48, a, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = "#FFE59A";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.38, 0, 6.3);
    ctx.fill();
  }
  function grassTufts(ctx, x0, x1, y, n, col = T.grassHi, s = 1) {
    reseed(Math.round(x0 * 3 + y));
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), h = (4 + rnd() * 6) * s;
      for (const lean of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x - 1.4 * s, y);
        ctx.quadraticCurveTo(x + lean * 0.5 * s, y - h * 0.6, x + lean * 2.4 * s, y - h * (lean > 0 ? 1 : 0.8));
        ctx.quadraticCurveTo(x + lean * 0.4 * s, y - h * 0.35, x + 1.4 * s, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  function fence(ctx, x0, x1, y, s = 1) {
    const n = Math.max(2, Math.round((x1 - x0) / (16 * s)));
    for (const ry of [-14, -7]) {
      const rail = P((q) => q.roundRect(x0, y + ry * s, x1 - x0, 3 * s, 1.5 * s));
      solid(ctx, rail, T.woodHi, { x: x0, y: y + ry * s, w: x1 - x0, h: 3 * s }, { rim: 0.6, ao: 0, lw: 0.6 });
    }
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      contact(ctx, x, y + 1, 5 * s, 1.6 * s, 0.3);
      const post = P((q) => {
        q.moveTo(x - 3 * s, y);
        q.lineTo(x - 3 * s, y - 18 * s);
        q.quadraticCurveTo(x, y - 22 * s, x + 3 * s, y - 18 * s);
        q.lineTo(x + 3 * s, y);
        q.closePath();
      });
      solid(ctx, post, T.wood, { x: x - 3 * s, y: y - 22 * s, w: 6 * s, h: 22 * s }, { rim: 0.8, lw: 0.6 });
    }
  }
  function lampPost(ctx, x, y, s = 1) {
    contact(ctx, x, y + 1, 10 * s, 3 * s);
    glow(ctx, x, y + 2, 46 * s, T.glow, 0.28, 0.32);
    const post = rrect(x - 2 * s, y - 58 * s, 4 * s, 58 * s, 2 * s);
    solid(ctx, post, T.woodLo, { x: x - 2 * s, y: y - 58 * s, w: 4 * s, h: 58 * s }, { rim: 0.8, lw: 0.5 });
    glow(ctx, x, y - 52 * s, 30 * s, T.glow, 0.55);
    miniLantern(ctx, x, y - 52 * s, 12 * s, true);
  }
  function miniLantern(ctx, cx, cy, h, lit) {
    const w = h * 0.78;
    ctx.lineWidth = Math.max(0.8, h * 0.07);
    ctx.strokeStyle = T.woodLo;
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.48, w * 0.24, Math.PI, 0);
    ctx.stroke();
    const body = rrect(cx - w * 0.42, cy - h * 0.4, w * 0.84, h * 0.8, w * 0.32);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
    g.addColorStop(0, lit ? "#FFF6DC" : "#CDBE9C");
    g.addColorStop(1, lit ? T.amber : "#9C8462");
    ctx.fillStyle = g;
    ctx.fill(body);
    ctx.fillStyle = T.wood;
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.5, cy - h * 0.48, w, h * 0.12, h * 0.05);
    ctx.roundRect(cx - w * 0.5, cy + h * 0.38, w, h * 0.12, h * 0.05);
    ctx.fill();
  }
  function stoneBlob(ctx, x, y, rx, ry, col = T.stone) {
    contact(ctx, x + 1, y + ry * 0.6, rx * 1.05, ry * 0.5, 0.35);
    const p = ellipseP(x, y, rx, ry);
    solid(ctx, p, col, { x: x - rx, y: y - ry, w: rx * 2, h: ry * 2 }, { rim: Math.min(1.6, ry * 0.4), lit: 0.35, lw: 0.6 });
  }
  function path(ctx, pts, width, s = 1) {
    // a soft dirt road (widens towards the viewer), a lighter centre, then flat stepping stones
    const road = (wk, col) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = col;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0, k0] = pts[i], [x1, y1, k1] = pts[i + 1];
        ctx.lineWidth = width * wk * (k0 + k1) / 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    };
    road(1.3, hexA("#211C42", 0.55));
    road(1.12, "#7A6688");
    road(0.72, hexA("#9C8296", 0.75));
    road(0.3, hexA("#B49AA2", 0.45));
    reseed(5);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, k0] = pts[i], [x1, y1, k1] = pts[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / (30 * ((k0 + k1) / 2))));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n, k = k0 + (k1 - k0) * t;
        const side = (i + j) % 2 ? 1 : -1;
        const cx = x0 + (x1 - x0) * t + side * width * 0.2 * k, cy = y0 + (y1 - y0) * t;
        stoneBlob(ctx, cx, cy, (9 + rnd() * 3) * k * s, (3.6 + rnd()) * k * s, mix(T.stoneHi, "#E8D6C8", 0.2 + rnd() * 0.3));
        if (rnd() < 0.5) stoneBlob(ctx, cx - side * width * 0.36 * k, cy + 6 * k, 5 * k * s, 2.2 * k * s, mix(T.stone, T.lilac, 0.3));
      }
    }
  }
  function pond(ctx, x, y, rx, ry) {
    const edge = ellipseP(x, y, rx + 6, ry + 4);
    ctx.fillStyle = mix(T.stoneLo, T.plum, 0.3);
    ctx.fill(edge);
    const p = ellipseP(x, y, rx, ry);
    const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    g.addColorStop(0, "#2C3570");
    g.addColorStop(1, T.water);
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    // sky reflection + moon streak
    const r = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    r.addColorStop(0, hexA("#D18E9D", 0.35));
    r.addColorStop(1, hexA("#D18E9D", 0));
    ctx.fillStyle = r;
    ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = hexA("#FFF3DE", 0.5 - i * 0.08);
      ctx.beginPath();
      ctx.ellipse(x + rx * 0.35, y - ry * 0.45 + i * ry * 0.22, rx * (0.12 - i * 0.015), ry * 0.04, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexA(T.plum, 0.35);
    ctx.translate(0, -3);
    ctx.stroke(p);
    ctx.restore();
    reseed(17);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283 + rnd() * 0.3;
      stoneBlob(ctx, x + Math.cos(a) * (rx + 5), y + Math.sin(a) * (ry + 3), 5 + rnd() * 3, 3 + rnd() * 1.6, mix(T.stone, T.lilac, rnd() * 0.4));
    }
    // lily pads + one flower
    for (const [dx, dy, rr] of [[-0.45, 0.1, 9], [-0.2, 0.42, 7], [0.3, 0.25, 8]]) {
      const lx = x + dx * rx, ly = y + dy * ry;
      const lp = P((q) => {
        q.moveTo(lx, ly);
        q.arc(lx, ly, rr, 0.3, 6.0);
        q.closePath();
      });
      ctx.save();
      ctx.scale(1, 1);
      solid(ctx, lp, "#5F9C7C", { x: lx - rr, y: ly - rr, w: rr * 2, h: rr * 2 }, { rim: 1, lw: 0.6 });
      ctx.restore();
    }
    flower(ctx, x - 0.45 * rx + 2, y + 0.1 * ry - 2, 3.4, T.pink);
  }
  function fireflies(ctx, pts) {
    for (const [x, y, r] of pts) {
      glow(ctx, x, y, r * 6, "#FFF2A8", 0.5);
      ctx.fillStyle = "#FFFBE0";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.3);
      ctx.fill();
    }
  }
  function mailbox(ctx, x, y, s = 1, flagUp = true, col = T.coral) {
    contact(ctx, x, y + 1, 9 * s, 2.5 * s);
    const post = rrect(x - 1.8 * s, y - 22 * s, 3.6 * s, 22 * s, 1.4 * s);
    solid(ctx, post, T.wood, { x: x - 2 * s, y: y - 22 * s, w: 4 * s, h: 22 * s }, { rim: 0.6, lw: 0.5 });
    const box = P((q) => {
      q.moveTo(x - 9 * s, y - 20 * s);
      q.lineTo(x - 9 * s, y - 30 * s);
      q.arc(x - 3 * s, y - 30 * s, 6 * s, Math.PI, 0);
      q.lineTo(x + 9 * s, y - 36 * s);
      q.arc(x + 3 * s, y - 30 * s, 6 * s, 0, 0);
      q.lineTo(x + 9 * s, y - 20 * s);
      q.closePath();
    });
    const body = rrect(x - 10 * s, y - 36 * s, 20 * s, 16 * s, [7 * s, 7 * s, 2 * s, 2 * s]);
    solid(ctx, body, col, { x: x - 10 * s, y: y - 36 * s, w: 20 * s, h: 16 * s }, { rim: 1.1 * s });
    void box;
    ctx.fillStyle = hexA(T.plum, 0.5);
    ctx.beginPath();
    ctx.roundRect(x - 7 * s, y - 27 * s, 6 * s, 2 * s, 1 * s);
    ctx.fill();
    if (flagUp) {
      ctx.fillStyle = T.amber;
      ctx.fillRect(x + 9 * s, y - 40 * s, 1.6 * s, 14 * s);
      ctx.beginPath();
      ctx.roundRect(x + 10.6 * s, y - 40 * s, 7 * s, 5 * s, 1.4 * s);
      ctx.fill();
    }
  }
  function pot(ctx, x, y, s = 1, plant = "leafy", col = "#C27A5A") {
    contact(ctx, x, y + 1, 9 * s, 2.4 * s);
    if (plant === "leafy") {
      const p = P((q) => {
        for (const [dx, dy, r] of [[0, -16, 7], [-6, -12, 5.5], [6, -12, 5.5], [0, -22, 5]]) {
          q.moveTo(x + (dx + r) * s, y + dy * s);
          q.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
        }
      });
      solid(ctx, p, T.leaf, { x: x - 12 * s, y: y - 28 * s, w: 24 * s, h: 20 * s }, { rim: 1 * s, lit: 0.35, lw: 0.6 });
    } else if (plant === "flowers") {
      ctx.strokeStyle = T.leaf;
      ctx.lineWidth = 1.2 * s;
      for (const dx of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * 0.5 * s, y - 9 * s);
        ctx.lineTo(x + dx * s, y - 19 * s);
        ctx.stroke();
      }
      for (const [dx, c] of [[-4, T.pink], [0, T.lemon], [4, T.lilac]]) flower(ctx, x + dx * s, y - 20 * s, 3.2 * s, c);
    } else if (plant === "cactus") {
      const p = rrect(x - 4 * s, y - 24 * s, 8 * s, 18 * s, 4 * s);
      solid(ctx, p, "#6FA287", { x: x - 4 * s, y: y - 24 * s, w: 8 * s, h: 18 * s }, { rim: 1, lw: 0.6 });
      flower(ctx, x, y - 24 * s, 2.4 * s, T.pink);
    }
    const body = P((q) => {
      q.moveTo(x - 8 * s, y - 10 * s);
      q.lineTo(x + 8 * s, y - 10 * s);
      q.lineTo(x + 6 * s, y);
      q.lineTo(x - 6 * s, y);
      q.closePath();
    });
    solid(ctx, body, col, { x: x - 8 * s, y: y - 10 * s, w: 16 * s, h: 10 * s }, { rim: 0.9 * s, lw: 0.6 });
    const lip = rrect(x - 9 * s, y - 12 * s, 18 * s, 3.4 * s, 1.6 * s);
    solid(ctx, lip, mix(col, "#FFFFFF", 0.12), { x: x - 9 * s, y: y - 12 * s, w: 18 * s, h: 3.4 * s }, { rim: 0.6, ao: 0, lw: 0.5 });
  }

  // ---------------------------------------------------------------- the lantern-house
  /**
   * A house that IS a paper lantern: a glowing paper barrel between two wooden posts, a chunky
   * wooden cap for a roof (the resident's colour), a carry-handle on top, a round wooden door.
   * (cx, gy) = bottom centre on the ground, s = scale (≈ 120 s wide).
   */
  function lanternHouse(ctx, cx, gy, s, th) {
    // v2: painterly materials (paper fibres, wood grain), the one outline rule, the handle joined to
    // the lid knob, roof scallops as value bands (no hairlines), an optional number plate (puzzle screen).
    ctx.save();
    ctx.translate(cx, gy);
    ctx.scale(s, s);
    glow(ctx, -6, 6, 96, T.glow, 0.36, 0.3);
    contact(ctx, 6, 2, 72, 13, 0.45);
    // ---- paper barrel, lit from inside
    const body = P((q) => {
      q.moveTo(-38, -14);
      q.bezierCurveTo(-66, -36, -66, -88, -40, -108);
      q.lineTo(40, -108);
      q.bezierCurveTo(66, -88, 66, -36, 38, -14);
      q.closePath();
    });
    const bb = { x: -62, y: -108, w: 124, h: 94 };
    const pg = ctx.createRadialGradient(-8, -64, 4, 0, -60, 70);
    pg.addColorStop(0, th.dim ? mix("#FFF8E8", th.paperLo, th.dim) : "#FFF8E8");
    pg.addColorStop(0.45, th.dim ? mix(th.paper, th.paperLo, th.dim * 0.8) : th.paper);
    pg.addColorStop(1, th.paperLo);
    ctx.fillStyle = pg;
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    const side = ctx.createLinearGradient(-62, 0, 62, 0);
    side.addColorStop(0, hexA(T.key, 0.22));
    side.addColorStop(0.28, hexA(T.key, 0));
    side.addColorStop(0.7, hexA(T.plum, 0));
    side.addColorStop(1, hexA(T.plum, 0.36));
    ctx.fillStyle = side;
    ctx.fillRect(-62, -110, 124, 100);
    // ribs: soft value bands, not hairlines
    for (const y of [-38, -62, -86]) {
      const rib = P((q) => {
        q.moveTo(-64, y - 1.4);
        q.quadraticCurveTo(0, y + 4.6, 64, y - 1.4);
        q.lineTo(64, y + 1.4);
        q.quadraticCurveTo(0, y + 7.4, -64, y + 1.4);
        q.closePath();
      });
      ctx.fillStyle = hexA(mix(th.paperLo, T.wood, 0.45), 0.4);
      ctx.fill(rib);
    }
    ctx.restore();
    texture(ctx, body, bb, "paper", 0.4);
    ctx.lineWidth = lineW(ctx, 94);
    ctx.strokeStyle = mix(th.paperLo, T.ink, 0.5);
    ctx.stroke(body);
    // bamboo staves following the barrel (solid shapes, same outline rule)
    for (const sx of [-1, 1]) {
      const st = P((q) => {
        q.moveTo(sx * 35.5, -14);
        q.bezierCurveTo(sx * 61.5, -36, sx * 61.5, -88, sx * 37.5, -108);
        q.lineTo(sx * 41.5, -108);
        q.bezierCurveTo(sx * 66.5, -88, sx * 66.5, -36, sx * 40.5, -14);
        q.closePath();
      });
      solid(ctx, st, T.wood, { x: sx < 0 ? -67 : 35, y: -108, w: 32, h: 94 }, { rim: 0.8, tex: "wood" });
    }
    // windows
    for (const [wi, wx] of (th.windows ?? [-24, 24]).entries()) {
      const dark = (th.darkWindows ?? []).includes(wi);
      if (!dark) glow(ctx, wx, -70, 30, "#FFD98A", 0.5);
      const w = P((q) => q.arc(wx, -70, 10.5, 0, 6.3));
      const wg = ctx.createRadialGradient(wx - 2, -73, 1, wx, -70, 11);
      wg.addColorStop(0, dark ? "#6A5C92" : "#FFF8DA");
      wg.addColorStop(1, dark ? "#463A72" : "#FFC864");
      ctx.fillStyle = wg;
      ctx.fill(w);
      ctx.save();
      ctx.clip(w);
      ctx.fillStyle = hexA(th.roof, 0.7);
      ctx.beginPath();
      ctx.moveTo(wx - 11, -81);
      ctx.quadraticCurveTo(wx - 4, -72, wx - 10, -59);
      ctx.lineTo(wx - 12, -59);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const frame = P((q) => {
        q.arc(wx, -70, 12.4, 0, 6.3);
        q.arc(wx, -70, 10.2, 0, 6.3, true);
      });
      solid(ctx, frame, T.woodHi, { x: wx - 12.4, y: -82.4, w: 24.8, h: 24.8 }, { rim: 0.5, ao: 0 });
      ctx.lineCap = "round";
      ctx.strokeStyle = T.ink;
      ctx.lineWidth = lineW(ctx, 50);
      ctx.beginPath();
      ctx.moveTo(wx - 10, -70);
      ctx.lineTo(wx + 10, -70);
      ctx.moveTo(wx, -80);
      ctx.lineTo(wx, -60);
      ctx.stroke();
      const fb = rrect(wx - 12, -57, 24, 5, 2);
      solid(ctx, fb, T.wood, { x: wx - 12, y: -57, w: 24, h: 5 }, { rim: 0.6, tex: "wood" });
      for (let i = 0; i < 4; i++) flower(ctx, wx - 8 + i * 5.3, -59, 2.3, [T.pink, T.lemon, "#FFF6E8", th.flower ?? T.lilac][i]);
    }
    // round door in a frame
    const door = P((q) => {
      q.moveTo(-15, -14);
      q.lineTo(-15, -33);
      q.arc(0, -33, 15, Math.PI, 0);
      q.lineTo(15, -14);
      q.closePath();
    });
    const frame = P((q) => {
      q.moveTo(-19, -12);
      q.lineTo(-19, -33);
      q.arc(0, -33, 19, Math.PI, 0);
      q.lineTo(19, -12);
      q.closePath();
    });
    solid(ctx, frame, T.woodHi, { x: -19, y: -52, w: 38, h: 40 }, { rim: 1, tex: "wood" });
    solid(ctx, door, th.door ?? T.wood, { x: -15, y: -48, w: 30, h: 34 }, { rim: 1.2, lit: 0.2, tex: "wood" });
    ctx.save();
    ctx.clip(door);
    ctx.fillStyle = hexA(T.plum, 0.22);
    for (const x of [-7.5, 0, 7.5]) ctx.fillRect(x - 0.5, -50, 1, 38);
    ctx.restore();
    ctx.fillStyle = T.amber;
    ctx.beginPath();
    ctx.arc(9, -27, 1.8, 0, 6.3);
    ctx.fill();
    if (th.plate != null) {
      // the level number, on a cream plate over the door (puzzle screen)
      const pl = rrect(-13, -58, 26, 15, 5);
      solid(ctx, pl, "#FFF3DE", { x: -13, y: -58, w: 26, h: 15 }, { rim: 0.8, ao: 0.1 });
      text(ctx, String(th.plate), 0, -46.2, 12.5, 600, T.ink, "center");
    }
    glow(ctx, 25, -44, 18, T.glow, 0.5);
    miniLantern(ctx, 25, -44, 9, true);
    const base = rrect(-46, -16, 92, 14, 6);
    solid(ctx, base, T.woodHi, { x: -46, y: -16, w: 92, h: 14 }, { rim: 1.2, tex: "wood" });
    stoneBlob(ctx, 0, -4, 16, 4, T.stoneHi);
    // ---- the carry handle, drawn first so the knob covers its ends (they meet the lid)
    const handle = P((q) => {
      q.arc(0, -150, 17, Math.PI * 1.02, Math.PI * 1.98);
      q.arc(0, -150, 12.5, Math.PI * 1.98, Math.PI * 1.02, true);
      q.closePath();
    });
    solid(ctx, handle, T.woodLo, { x: -17, y: -167, w: 34, h: 17 }, { rim: 0.9, lit: 0.35, tex: "wood" });
    // ---- the lid (resident colour)
    const cap = P((q) => {
      q.moveTo(-64, -104);
      q.quadraticCurveTo(-68, -114, -56, -118);
      q.lineTo(-22, -138);
      q.quadraticCurveTo(0, -150, 22, -138);
      q.lineTo(56, -118);
      q.quadraticCurveTo(68, -114, 64, -104);
      q.quadraticCurveTo(0, -96, -64, -104);
      q.closePath();
    });
    solid(ctx, cap, th.roof, { x: -68, y: -150, w: 136, h: 54 }, { rim: 2.2, lit: 0.36, shade: 0.42, tex: "wood" });
    // scallop rows as value bands (≥ 1 pt; no hairlines)
    ctx.save();
    ctx.clip(cap);
    for (const [y, n] of [[-114, 9], [-126, 7], [-138, 4]]) {
      for (let i = 0; i < n; i++) {
        const x = -((n - 1) * 13) / 2 + i * 13;
        const sc = P((q) => {
          q.moveTo(x - 6.5, y);
          q.arc(x, y, 6.5, Math.PI, 0, true);
          q.arc(x, y - 1.6, 6.5, 0, Math.PI, false);
          q.closePath();
        });
        ctx.fillStyle = hexA(mix(th.roof, T.plum, 0.55), 0.38);
        ctx.fill(sc);
      }
    }
    ctx.restore();
    const eave = P((q) => {
      q.moveTo(-64, -104);
      q.quadraticCurveTo(0, -96, 64, -104);
      q.quadraticCurveTo(66, -99, 60, -97);
      q.quadraticCurveTo(0, -89, -60, -97);
      q.quadraticCurveTo(-66, -99, -64, -104);
      q.closePath();
    });
    solid(ctx, eave, mix(th.roof, T.plum, 0.25), { x: -66, y: -104, w: 132, h: 15 }, { rim: 0.8 });
    const knob = rrect(-10, -153, 20, 10, 4.5);
    solid(ctx, knob, T.woodHi, { x: -10, y: -153, w: 20, h: 10 }, { rim: 1, tex: "wood" });
    ctx.restore();
  }

  // ---------------------------------------------------------------- UI kit (one grammar)
  function text(ctx, s, x, y, size, weight = 600, col = T.cream, align = "left", font = FONT) {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  }
  function textShadowed(ctx, s, x, y, size, weight, col, align) {
    ctx.save();
    ctx.shadowColor = hexA(T.plum, 0.7);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1.5;
    text(ctx, s, x, y, size, weight, col, align);
    ctx.restore();
  }
  /** HUD disc: glass, cream rim, icon, caption ALWAYS below. attention = amber ring + amber icon. */
  function disc(ctx, x, y, d, icon, caption, o = {}) {
    const r = d / 2;
    contact(ctx, x, y + r + 3, r * 0.9, 4, 0.35);
    ctx.save();
    ctx.shadowColor = hexA(T.plum, 0.5);
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = T.glass;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    ctx.restore();
    const hl = ctx.createLinearGradient(0, y - r, 0, y + r);
    hl.addColorStop(0, "rgba(255,243,222,0.16)");
    hl.addColorStop(0.5, "rgba(255,243,222,0.02)");
    hl.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    ctx.lineWidth = o.attn ? 2.4 : 1.5;
    ctx.strokeStyle = o.attn ? T.amber : T.glassLine;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.75, 0, 6.3);
    ctx.stroke();
    if (o.attn) glow(ctx, x, y, r * 1.6, T.amber, 0.18);
    icon(ctx, x, y, d * 0.46, o.attn ? T.amber : T.cream);
    if (o.badge) {
      // something new = a calm amber dot (no count, no red: r1/r2 design rule)
      glow(ctx, x + r * 0.7, y - r * 0.7, 10, T.amber, 0.45);
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.arc(x + r * 0.7, y - r * 0.7, 5.2, 0, 6.3);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = T.skyTop;
      ctx.stroke();
    }
    if (caption) {
      // captions keep to their own column: max width 82 pt, shrink to fit (DE / FR are longer)
      ctx.font = `600 13px ${FONT}`;
      const cw = ctx.measureText(caption).width;
      const k = Math.min(1, (o.capMax ?? 82) / cw);
      ctx.save();
      ctx.translate(x, y + r + 17);
      ctx.scale(k, k);
      textShadowed(ctx, caption, 0, 0, 13, 600, hexA(T.cream, 0.94), "center");
      ctx.restore();
    }
  }
  /** Primary pill: amber face, 4 pt lip, top gloss. Ghost pill: outline only. */
  function pill(ctx, x, y, w, h, label, o = {}) {
    const r = h / 2;
    if (!o.ghost) {
      contact(ctx, x + w / 2, y + h + 4, w * 0.48, 6, 0.4);
      ctx.fillStyle = o.lip ?? T.amberLip;
      ctx.beginPath();
      ctx.roundRect(x, y + 4, w, h, r);
      ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, mix(o.face ?? T.amber, "#FFFFFF", 0.18));
      g.addColorStop(1, o.face ?? T.amber);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.roundRect(x + r * 0.6, y + 4, w - r * 1.2, h * 0.28, h * 0.14);
      ctx.fill();
      text(ctx, label, x + w / 2 + (o.icon ? 12 : 0), y + h / 2 + 7, o.size ?? 20, 600, T.ink, "center");
      if (o.icon) o.icon(ctx, x + w / 2 - ctx.measureText(label).width / 2 - 8, y + h / 2, 20, T.ink);
    } else {
      ctx.fillStyle = "rgba(255,243,222,0.08)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,243,222,0.45)";
      ctx.stroke();
      text(ctx, label, x + w / 2, y + h / 2 + 6.5, o.size ?? 18, 600, T.cream, "center");
    }
  }
  /** Cream panel (sheets, letters, catalog): cream face, soft lip, dashed inner stitch optional. */
  function panel(ctx, x, y, w, h, r, o = {}) {
    ctx.save();
    ctx.shadowColor = hexA(T.plum, 0.55);
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = o.lip ?? "#E9D3B4";
    ctx.beginPath();
    ctx.roundRect(x, y + 5, w, h, r);
    ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.face ?? "#FFF7E8");
    g.addColorStop(1, o.face2 ?? "#FBEBD2");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    if (o.stitch) {
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#E3CBA8";
      ctx.beginPath();
      ctx.roundRect(x + 8, y + 8, w - 16, h - 16, r - 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  /** Speech bubble with a name tag in the speaker's colour. */
  function bubble(ctx, x, y, w, h, lines, name, col, tail) {
    ctx.save();
    ctx.shadowColor = hexA(T.plum, 0.45);
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#FFF8EC";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tail[0] - 9, y + h - 1);
    ctx.quadraticCurveTo(tail[0] - 2, y + h + 6, tail[0] + 2, tail[1]);
    ctx.quadraticCurveTo(tail[0] + 4, y + h + 4, tail[0] + 9, y + h - 1);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#EBD6B8";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.stroke();
    lines.forEach((l, i) => text(ctx, l, x + 16, y + 30 + i * 21, 15.5, 500, T.ink));
    if (name) {
      ctx.font = `600 13px ${FONT}`;
      const nw = ctx.measureText(name).width + 20;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(x + 12, y - 11, nw, 22, 11);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFF8EC";
      ctx.stroke();
      text(ctx, name, x + 12 + nw / 2, y + 4.5, 13, 600, T.ink, "center");
    }
  }

  // ---------------------------------------------------------------- icons (one line grammar: 2.4 pt round)
  const line = (ctx, col, w) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };
  const ICON = {
    gear(ctx, x, y, s, col) {
      // a cog: 7 flat-topped teeth on one closed outline + a hole (a sun has rays; this does not)
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      const n = 7, ro = s * 0.44, ri = s * 0.33;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * 6.283 - 1.5708, w = 6.283 / n;
        const pts = [[ri, a0], [ro, a0 + w * 0.14], [ro, a0 + w * 0.42], [ri, a0 + w * 0.56]];
        pts.forEach(([r, a], j) => (i === 0 && j === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)));
        ctx.arc(x, y, ri, a0 + w * 0.56, a0 + w);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.13, 0, 6.3);
      ctx.stroke();
    },
    jar(ctx, x, y, s, col, fill = 0.66) {
      line(ctx, col, s * 0.1);
      const body = P((q) => {
        q.moveTo(x - s * 0.24, y - s * 0.2);
        q.quadraticCurveTo(x - s * 0.36, y + s * 0.12, x - s * 0.26, y + s * 0.38);
        q.quadraticCurveTo(x, y + s * 0.46, x + s * 0.26, y + s * 0.38);
        q.quadraticCurveTo(x + s * 0.36, y + s * 0.12, x + s * 0.24, y - s * 0.2);
      });
      ctx.stroke(body);
      ctx.beginPath();
      ctx.roundRect(x - s * 0.3, y - s * 0.36, s * 0.6, s * 0.14, s * 0.06);
      ctx.stroke();
      // the drops inside: three small line circles + a level line (still a line icon)
      const ly = y + s * 0.4 - s * 0.5 * fill;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, ly);
      ctx.quadraticCurveTo(x, ly + s * 0.05, x + s * 0.3, ly);
      ctx.stroke();
      for (const [dx, dy] of [[-0.1, 0.16], [0.08, 0.24], [0.12, 0.08]]) {
        ctx.beginPath();
        ctx.arc(x + dx * s, ly + dy * s, s * 0.045, 0, 6.3);
        ctx.stroke();
      }
    },
    rules(ctx, x, y, s, col) {
      // an open little book
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.28);
      ctx.quadraticCurveTo(x - s * 0.22, y - s * 0.38, x - s * 0.46, y - s * 0.3);
      ctx.lineTo(x - s * 0.46, y + s * 0.3);
      ctx.quadraticCurveTo(x - s * 0.22, y + s * 0.22, x, y + s * 0.34);
      ctx.quadraticCurveTo(x + s * 0.22, y + s * 0.22, x + s * 0.46, y + s * 0.3);
      ctx.lineTo(x + s * 0.46, y - s * 0.3);
      ctx.quadraticCurveTo(x + s * 0.22, y - s * 0.38, x, y - s * 0.28);
      ctx.lineTo(x, y + s * 0.34);
      ctx.stroke();
    },
    village(ctx, x, y, s, col) {
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.36, y + s * 0.34);
      ctx.lineTo(x - s * 0.36, y - s * 0.02);
      ctx.quadraticCurveTo(x - s * 0.36, y - s * 0.3, x, y - s * 0.38);
      ctx.quadraticCurveTo(x + s * 0.36, y - s * 0.3, x + s * 0.36, y - s * 0.02);
      ctx.lineTo(x + s * 0.36, y + s * 0.34);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.12, y + s * 0.34);
      ctx.lineTo(x - s * 0.12, y + s * 0.12);
      ctx.arc(x, y + s * 0.12, s * 0.12, Math.PI, 0);
      ctx.lineTo(x + s * 0.12, y + s * 0.34);
      ctx.stroke();
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.12, s * 0.07, 0, 6.3);
      ctx.fill();
    },
    today(ctx, x, y, s, col, day = 17) {
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.roundRect(x - s * 0.4, y - s * 0.34, s * 0.8, s * 0.74, s * 0.14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.12);
      ctx.lineTo(x + s * 0.4, y - s * 0.12);
      ctx.moveTo(x - s * 0.2, y - s * 0.46);
      ctx.lineTo(x - s * 0.2, y - s * 0.28);
      ctx.moveTo(x + s * 0.2, y - s * 0.46);
      ctx.lineTo(x + s * 0.2, y - s * 0.28);
      ctx.stroke();
      text(ctx, String(day), x, y + s * 0.3, s * 0.42, 600, col, "center");
    },
    undo(ctx, x, y, s, col) {
      line(ctx, col, s * 0.11);
      ctx.beginPath();
      ctx.arc(x + s * 0.02, y + s * 0.04, s * 0.32, Math.PI * 1.05, Math.PI * 0.75, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.42, y - s * 0.26);
      ctx.lineTo(x - s * 0.3, y + s * 0.0);
      ctx.lineTo(x - s * 0.04, y - s * 0.12);
      ctx.stroke();
    },
    hint(ctx, x, y, s, col) {
      // a tiny lantern = "show me one" (the board's own object)
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.arc(x, y - s * 0.3, s * 0.12, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x - s * 0.26, y - s * 0.24, s * 0.52, s * 0.56, s * 0.16);
      ctx.stroke();
      ctx.fillStyle = hexA(col, 0.35);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.34, y - s * 0.24);
      ctx.lineTo(x + s * 0.34, y - s * 0.24);
      ctx.moveTo(x - s * 0.34, y + s * 0.32);
      ctx.lineTo(x + s * 0.34, y + s * 0.32);
      ctx.stroke();
      sparkle(ctx, x + s * 0.42, y - s * 0.4, s * 0.16, col);
    },
    magnifier(ctx, x, y, s, col) {
      line(ctx, col, s * 0.11);
      ctx.beginPath();
      ctx.arc(x - s * 0.08, y - s * 0.08, s * 0.26, 0, 6.3);
      ctx.stroke();
      ctx.fillStyle = hexA(col, 0.18);
      ctx.fill();
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.12, y + s * 0.12);
      ctx.lineTo(x + s * 0.36, y + s * 0.36);
      ctx.stroke();
      sparkle(ctx, x + s * 0.3, y - s * 0.34, s * 0.13, col);
    },
    letter(ctx, x, y, s, col) {
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.roundRect(x - s * 0.42, y - s * 0.28, s * 0.84, s * 0.56, s * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.38, y - s * 0.22);
      ctx.lineTo(x, y + s * 0.06);
      ctx.lineTo(x + s * 0.38, y - s * 0.22);
      ctx.stroke();
    },
    album(ctx, x, y, s, col) {
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.roundRect(x - s * 0.36, y - s * 0.4, s * 0.72, s * 0.8, s * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.4);
      ctx.lineTo(x - s * 0.2, y + s * 0.4);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + s * 0.08, y - s * 0.05, s * 0.1, 0, 6.3);
      ctx.fill();
    },
    back(ctx, x, y, s, col) {
      line(ctx, col, s * 0.11);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.1, y - s * 0.3);
      ctx.lineTo(x - s * 0.2, y);
      ctx.lineTo(x + s * 0.1, y + s * 0.3);
      ctx.stroke();
    },
    check(ctx, x, y, s, col) {
      line(ctx, col, s * 0.13);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y);
      ctx.lineTo(x - s * 0.08, y + s * 0.22);
      ctx.lineTo(x + s * 0.32, y - s * 0.24);
      ctx.stroke();
    },
    brush(ctx, x, y, s, col) {
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.34, y - s * 0.36);
      ctx.lineTo(x - s * 0.04, y + s * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.06, y + s * 0.02);
      ctx.quadraticCurveTo(x - s * 0.36, y + s * 0.02, x - s * 0.36, y + s * 0.36);
      ctx.quadraticCurveTo(x - s * 0.06, y + s * 0.36, x - s * 0.06, y + s * 0.02);
      ctx.stroke();
    },
    rotate(ctx, x, y, s, col) {
      line(ctx, col, s * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, -0.4, Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.34, y - s * 0.34);
      ctx.lineTo(x + s * 0.3, y - s * 0.08);
      ctx.lineTo(x + s * 0.06, y - s * 0.14);
      ctx.stroke();
    },
    close(ctx, x, y, s, col) {
      line(ctx, col, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.24, y - s * 0.24);
      ctx.lineTo(x + s * 0.24, y + s * 0.24);
      ctx.moveTo(x + s * 0.24, y - s * 0.24);
      ctx.lineTo(x - s * 0.24, y + s * 0.24);
      ctx.stroke();
    },
    camera(ctx, x, y, s, col) {
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.roundRect(x - s * 0.44, y - s * 0.24, s * 0.88, s * 0.6, s * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.16, y - s * 0.24);
      ctx.lineTo(x - s * 0.08, y - s * 0.38);
      ctx.lineTo(x + s * 0.08, y - s * 0.38);
      ctx.lineTo(x + s * 0.16, y - s * 0.24);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + s * 0.06, s * 0.16, 0, 6.3);
      ctx.stroke();
    },
    heart(ctx, x, y, s, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.34);
      ctx.bezierCurveTo(x - s * 0.5, y, x - s * 0.3, y - s * 0.36, x, y - s * 0.12);
      ctx.bezierCurveTo(x + s * 0.3, y - s * 0.36, x + s * 0.5, y, x, y + s * 0.34);
      ctx.fill();
    },
    lock(ctx, x, y, s, col) {
      line(ctx, col, s * 0.1);
      ctx.beginPath();
      ctx.arc(x, y - s * 0.08, s * 0.18, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.26, y - s * 0.08, s * 0.52, s * 0.4, s * 0.08);
      ctx.fill();
    },
  };

  window.Kit = { T, FONT, HAND, LETTER, hexA, mix, rnd, reseed, solid, texture, lineW, OUTLINE, outlinePt, userScale, P, rrect, ellipseP, contact, glow, grain, vignette, sky, sparkle, moon, cloud, hill, tree, bush, flower, grassTufts, fence, lampPost, miniLantern, stoneBlob, path, pond, fireflies, mailbox, pot, lanternHouse, text, textShadowed, disc, pill, panel, bubble, ICON };
})();
