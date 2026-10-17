// Wick v2 — Canvas2D reference renderer (production-portable: Path2D strings + ellipse/arc only, no bitmaps).
// Construction box 100×100, ground contact (50,92). Copy P.* strings verbatim into src/render/wick.ts.
// Spec: docs/team/r1-visual.md §5.
(function () {
  // ---------- palettes ----------
  const INK = "#3B2C45";
  const PAL = {
    // body gradient core→body→rim, outline, flame base→tip, flame core, blush
    wick: { core: "#FFF8E8", body: "#FFE6B8", rim: "#F4B96E", line: "#E9A85E", fA: "#FF9A3C", fB: "#FFDF7A", fC: "#FFF6D6", blush: "#F59A9A", glow: "#FFD98A" },
    v1: { core: "#FFFBEF", body: "#FFEFC9", rim: "#F2C27A", line: "#F2C27A", fA: "#FFB84D", fB: "#FFE7A0", fC: "#FFF6D6", blush: "#F7A3A0", glow: "#FFD98A" },
    momo: { core: "#FFF4F1", body: "#FFDCD6", rim: "#F0A0A6", line: "#E8949B", fA: "#FF8FA8", fB: "#FFD8E2", fC: "#FFF2F5", blush: "#F27D8E", glow: "#FFC2CF" },
    sage: { core: "#F5FCF6", body: "#D9F0DF", rim: "#93CDAE", line: "#7FBF9D", fA: "#6DBE8C", fB: "#D9F5C2", fC: "#F2FFE8", blush: "#F2A3A0", glow: "#BFF0C8" },
    luna: { core: "#FAF6FF", body: "#E6DCFA", rim: "#AF9BE6", line: "#9F8AD9", fA: "#FFD86B", fB: "#FFF4C4", fC: "#FFFBEA", blush: "#F2A0BE", glow: "#D9CCFF" },
    pip: { core: "#FFFDE6", body: "#FFF1A6", rim: "#EBC555", line: "#DDB444", fA: "#FF9F3A", fB: "#FFE36B", fC: "#FFF8D6", blush: "#F7989A", glow: "#FFEB8A" },
    kuri: { core: "#FCF1E6", body: "#EFD2B6", rim: "#C9946C", line: "#B9845D", fA: "#FF7E4F", fB: "#FFC27A", fC: "#FFEBD6", blush: "#EE8D86", glow: "#FFC79A" },
    yuki: { core: "#F7FBFF", body: "#DCEBFA", rim: "#9DBDE6", line: "#8AAEDB", fA: "#8FC4FF", fB: "#E8F6FF", fC: "#FFFFFF", blush: "#F2A6B6", glow: "#CDE6FF" },
  };

  // ---------- geometry (100×100 box) ----------
  const P = {
    // v1 (current, for comparison): squat drop with pointed tip at (50,27)
    v1Body: "M50 27 C57 35 82 45 82 66 C82 83 68 92 50 92 C32 92 18 83 18 66 C18 45 43 35 50 27 Z",
    v1Wisp: "M50 31 C42 25 43 13 55 6 C52 14 59 19 55 28 C53 30 51.5 31 50 31 Z",
    v1Sheen: "M29 62 C29 51 37 44 44 42.5 C38.5 48 35.5 54 35.5 62 Z",
    // v2 body: daifuku mochi — no tip, widest point low (y≈72), flat-ish seat. 69 wide × 54 tall.
    body: "M50 38 C69 38 83 51 84.5 68 C86 84 73 92 50 92 C27 92 14 84 15.5 68 C17 51 31 38 50 38 Z",
    // B+ (final): squatter mochi, 73 wide × 52 tall — wider than any onion/ghost silhouette
    bodyF: "M50 40 C70 40 84 52 85.5 69 C87 84 73 92 50 92 C27 92 13 84 14.5 69 C16 52 30 40 50 40 Z",
    sheenF: "M24.5 64 C25.5 55 32.5 48.5 41.5 46.5 C36 51.5 32.5 57 31.5 64 Z",
    sheen: "M25.5 63 C26.5 53.5 33.5 46.5 42 44.5 C36.5 49.5 33 55.5 32 63 Z",
    // floating flame: separate from body (gap 2.2) — kills the onion/dumpling tip read
    flame: "M52 12.5 C53.5 18 59.5 22 59.5 28 C59.5 32.8 55.3 35.8 50 35.8 C44.7 35.8 40.5 32.8 40.5 28 C40.5 22.5 47 20 52 12.5 Z",
    flameCore: "M50.8 22 C52 25 55 27 55 30 C55 32.5 52.8 33.8 50 33.8 C47.2 33.8 45 32.5 45 30 C45 27.5 48.5 26 50.8 22 Z",
    // friend flames (same base point 50,35.8)
    petal: "M50 35.8 C43 34.2 39.8 27 42.4 20 C43.8 16.4 47 14.8 48.6 16.6 L50 19.2 L51.4 16.6 C53 14.8 56.2 16.4 57.6 20 C60.2 27 57 34.2 50 35.8 Z",
    leaf: "M50 35.8 C41.5 31.5 40.5 21 51.5 12.5 C58.5 21 58.5 31.5 50 35.8 Z",
    leafVein: "M50 34 C50.5 27 51 21 51.3 16",
    moon: "M55 13 C45 14 39.5 21.5 40.5 28.5 C41.5 34 46 36.5 51 35.8 C55.5 35.2 58.5 32.5 59.5 29 C56 31 50.5 30.5 48 26.5 C45.5 22 48 16 55 13 Z",
    twinL: "M44.5 20 C45.5 24 49 26.5 49 30 C49 33 47 35 44.5 35 C42 35 40 33 40 30 C40 26.5 43 24.5 44.5 20 Z",
    twinR: "M56.5 14.5 C57.8 19.5 61.5 22.5 61.5 27.5 C61.5 31.8 59.2 34.6 56 34.6 C52.8 34.6 50.6 31.8 50.6 27.5 C50.6 22.5 55 19.5 56.5 14.5 Z",
    spark: "M50 12.5 Q51.8 22.4 60.5 25 Q51.8 27.6 50 36.5 Q48.2 27.6 39.5 25 Q48.2 22.4 50 12.5 Z",
    // variant C: flame tufts as ears (no central flame)
    earL: "M28 50 C22.5 43 21.5 34 25 27 C28 33 33.5 36.5 39 42 C35.5 44.5 31.5 47 28 50 Z",
    earR: "M72 50 C77.5 43 79 33.5 75.5 25.5 C72.5 32 66.5 36.5 61 42 C64.5 44.5 68.5 47 72 50 Z",
    // variant D: washi lantern cap (drawn rotated −9° about (50,41))
    cap: "M32.5 43 C32.5 33.5 40 28.5 50 28.5 C60 28.5 67.5 33.5 67.5 43 C60 45.5 40 45.5 32.5 43 Z",
    capRibs: "M41 30.5 C38.5 34 38 39 39 44.2 M50 28.5 L50 44.9 M59 30.5 C61.5 34 62 39 61 44.2",
    capBand: "M32.5 43 C40 45.5 60 45.5 67.5 43",
    capRing: "M45.5 29.5 L45.5 27 C45.5 25.6 46.6 24.8 48 24.8 L52 24.8 C53.4 24.8 54.5 25.6 54.5 27 L54.5 29.5 Z",
    // arm nubs (gesture only; drawn behind the body)
    armL: "M18.5 75 C10.5 71.5 8 63.5 12 61 C15.5 59.5 20 65 23.5 70 Z",
    armR: "M81.5 75 C89.5 71.5 92 63.5 88 61 C84.5 59.5 80 65 76.5 70 Z",
    // Kuri's knit scarf: band below the face + knotted tail on the right
    scarf: "M17.2 80 C30 86.5 70 86.5 82.8 80 C83.8 82.5 83.6 85 82.4 87 C70 92.5 30 92.5 17.6 87 C16.4 85 16.2 82.5 17.2 80 Z",
    scarfTail: "M70 86 C72 91 71 97 68.5 101 L76 101.5 C78.5 97 78.5 91 76.5 85.5 Z",
    // Yuki's ear-muff dots / Luna's nightcap are not used (keep friends 1 accessory max)
  };
  const cache = {};
  const p2 = (d) => cache[d] || (cache[d] = new Path2D(d));

  // ---------- face ----------
  // eye line, spacing and size per body. v2 sets eyes LOW (y71 of a 38..92 body = 61% down) and wide (gap 21).
  const FACE = {
    v1: { ey: 65, ex: [40, 60], erx: 3.4, ery: 4.6, by: 73, bx: [30.5, 69.5], my: 73.5 },
    v2: { ey: 71, ex: [39.5, 60.5], erx: 3.0, ery: 3.8, by: 78.3, bx: [32.5, 67.5], my: 77.2 },
  };
  function stroke(ctx, w, col = INK) {
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  function face(ctx, F, pal, expr, o) {
    const [lx, ly] = o.look || [0, 0];
    const blink = o.blink || 0;
    const blush = (a, s = 1) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = pal.blush;
      for (const x of F.bx) {
        ctx.beginPath();
        ctx.ellipse(x, F.by, 5.4 * s, 3.0 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const ovals = (rx, ry, sparkle) => {
      for (const x of F.ex) {
        const cx = x + lx,
          cy = F.ey + ly;
        const k = 1 - blink;
        if (k < 0.18) {
          ctx.beginPath();
          ctx.moveTo(cx - rx - 0.6, cy + 0.6);
          ctx.quadraticCurveTo(cx, cy + 2.2, cx + rx + 0.6, cy + 0.6);
          stroke(ctx, 2.2);
          continue;
        }
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(cx, cy + (1 - k) * ry * 0.5, rx, ry * k, 0, 0, Math.PI * 2);
        ctx.fill();
        if (k > 0.6) {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(cx + rx * 0.33, cy - ry * 0.36, rx * 0.36, 0, Math.PI * 2);
          ctx.fill();
          if (sparkle) {
            ctx.beginPath();
            ctx.arc(cx - rx * 0.35, cy + ry * 0.42, rx * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };
    const arcs = (w = 4.2, h = 5.0, sw = 2.5, dy = 0) => {
      for (const x of F.ex) {
        ctx.beginPath();
        ctx.moveTo(x - w, F.ey + 1 + dy);
        ctx.quadraticCurveTo(x, F.ey + 1 - h + dy, x + w, F.ey + 1 + dy);
        stroke(ctx, sw);
      }
    };
    const mouth = (d, w = 1.9) => {
      ctx.beginPath();
      ctx.save();
      ctx.translate(50, F.my);
      const path = p2(d);
      ctx.lineWidth = w;
      ctx.strokeStyle = INK;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(path);
      ctx.restore();
    };
    switch (expr) {
      case "happy":
        blush(0.85);
        arcs();
        mouth("M-2.6 0 Q0 3.2 2.6 0", 2.1);
        break;
      case "cheer":
        blush(0.95, 1.08);
        arcs(4.5, 5.6, 2.7);
        ctx.save();
        ctx.translate(50, F.my - 0.6);
        ctx.fillStyle = INK;
        ctx.fill(p2("M-3.6 0 L3.6 0 Q3.6 5.6 0 5.6 Q-3.6 5.6 -3.6 0 Z"));
        ctx.fillStyle = "#F0868F";
        ctx.beginPath();
        ctx.ellipse(0, 3.9, 2.1, 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      case "curious":
        blush(0.6);
        for (const [i, x] of F.ex.entries()) {
          const s = i ? 1.16 : 0.94;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(x + lx, F.ey + ly - (i ? 0.4 : 0), F.erx * s, F.ery * s, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x + lx + F.erx * 0.35 * s, F.ey + ly - F.ery * 0.38 * s, F.erx * 0.36 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(51, F.my + 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "sleepy":
        blush(0.55);
        for (const x of F.ex) {
          ctx.beginPath();
          ctx.moveTo(x - 3.6, F.ey + 0.5);
          ctx.quadraticCurveTo(x, F.ey + 3.6, x + 3.6, F.ey + 0.5);
          stroke(ctx, 2.2);
        }
        break;
      case "worried":
        blush(0.45);
        for (const x of F.ex) {
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(x + lx, F.ey + 0.8 + ly, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x + lx + 0.8, F.ey - 0.2 + ly, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        // soft brows: inner ends up
        ctx.beginPath();
        ctx.moveTo(F.ex[0] - 4.2, F.ey - 4.4);
        ctx.lineTo(F.ex[0] + 3.4, F.ey - 6.4);
        ctx.moveTo(F.ex[1] - 3.4, F.ey - 6.4);
        ctx.lineTo(F.ex[1] + 4.2, F.ey - 4.4);
        stroke(ctx, 1.8);
        mouth("M-3.6 1 q1.8 -1.6 3.6 0 q1.8 1.6 3.6 0", 1.8);
        break;
      case "shy":
        blush(1, 1.22);
        arcs(3.6, 3.2, 2.3, 0.6);
        mouth("M-1.6 0.4 Q0 1.6 1.6 0.4", 1.7);
        break;
      case "surprised":
        blush(0.6);
        ovals(F.erx * 1.12, F.ery * 1.12);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(50, F.my + 1.4, 1.7, 2.1, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "none":
        break;
      default: // idle
        blush(0.75);
        ovals(F.erx, F.ery, o.sparkleEyes);
        if (F === FACE.v2) mouth("M-1.8 0 Q0 1.6 1.8 0", 1.8);
    }
  }

  // ---------- main draw ----------
  /**
   * o: {x,y,size, variant:'v1'|'mochi'|'ears'|'cap', pal:'wick'|..., flame:'drop'|'petal'|'leaf'|'moon'|'twin'|'spark'|'none',
   *     acc:'scarf'|null, expr, look, blink(0..1), sx, sy, dy, rot(deg), flameS, flameRot(deg), arms:null|'up'|'wave',
   *     glow, shadow, mono(color → silhouette), bodyScale}
   */
  function draw(ctx, o = {}) {
    const variant = o.variant || "mochi";
    const pal = typeof o.pal === "object" ? o.pal : PAL[o.pal || (variant === "v1" ? "v1" : "wick")];
    const mono = o.mono;
    const F = variant === "v1" ? FACE.v1 : FACE.v2;
    const size = o.size || 100;
    const sx = o.sx ?? 1,
      sy = o.sy ?? 1,
      dy = o.dy || 0,
      rot = ((o.rot || 0) * Math.PI) / 180;
    const flameKind = o.flame || (variant === "ears" ? "none" : "drop");
    ctx.save();
    ctx.translate(o.x || 0, o.y || 0);
    ctx.scale(size / 100, size / 100);
    // glow
    if (!mono && o.glow !== false) {
      const g = ctx.createRadialGradient(50, 64, 0, 50, 64, 48);
      g.addColorStop(0, hexA(pal.glow, 0.55));
      g.addColorStop(1, hexA(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(50, 64, 48, 0, Math.PI * 2);
      ctx.fill();
    }
    // ground shadow (does not follow hop)
    if (!mono && o.shadow !== false) {
      const k = Math.max(0.55, 1 + dy / 40);
      ctx.fillStyle = "rgba(10,8,30,.33)";
      ctx.beginPath();
      ctx.ellipse(50, 93.2, 26 * sx * k, 3.6 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(0, dy);
    ctx.translate(50, 92);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    const bs = o.bodyScale || 1;
    ctx.scale(bs, bs);
    ctx.translate(-50, -92);

    const bodyFill = () => {
      if (mono) return mono;
      const g = ctx.createRadialGradient(45, 63, 2, 50, 68, variant === "v1" ? 44 : 40);
      g.addColorStop(0, pal.core);
      g.addColorStop(0.55, pal.body);
      g.addColorStop(1, pal.rim);
      return g;
    };
    const flameFill = (y0 = 36, y1 = 12) => {
      if (mono) return mono;
      const g = ctx.createLinearGradient(0, y0, 6, y1);
      g.addColorStop(0, pal.fA);
      g.addColorStop(1, pal.fB);
      return g;
    };
    // arms (behind)
    if (o.arms) {
      ctx.fillStyle = bodyFill();
      for (const a of o.arms === "wave" ? ["armR"] : ["armL", "armR"]) {
        const path = p2(variant === "v1" ? P[a] : P[a]);
        ctx.fill(path);
        if (!mono) {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = pal.line;
          ctx.stroke(path);
        }
      }
    }
    // ears (variant C) — behind body
    if (variant === "ears") {
      ctx.fillStyle = flameFill(50, 24);
      ctx.fill(p2(P.earL));
      ctx.fill(p2(P.earR));
      if (!mono) {
        ctx.fillStyle = hexA(pal.fC, 0.8);
        ctx.save();
        ctx.translate(28.5, 41);
        ctx.scale(0.45, 0.45);
        ctx.translate(-28.5, -41);
        ctx.fill(p2(P.earL));
        ctx.restore();
        ctx.save();
        ctx.translate(71.5, 40);
        ctx.scale(0.45, 0.45);
        ctx.translate(-71.5, -40);
        ctx.fill(p2(P.earR));
        ctx.restore();
      }
    }
    // flame / wisp
    const drawFlame = () => {
      const fs = o.flameS ?? 1;
      const fr = ((o.flameRot || 0) * Math.PI) / 180;
      ctx.save();
      const base = variant === "cap" ? [50, 25.2] : [50, 35.8];
      if (variant === "cap") {
        ctx.translate(50, 41);
        ctx.rotate((-9 * Math.PI) / 180);
        ctx.translate(-50, -41);
      }
      const FX = Object.assign({ dx: 5, lift: 3, tilt: 10, s: 0.85 }, o.fx || {});
      if (variant === "final") ctx.translate(FX.dx, -FX.lift);
      ctx.translate(base[0], base[1]);
      ctx.rotate(fr + (variant === "final" ? (FX.tilt * Math.PI) / 180 : 0));
      if (variant === "final") ctx.scale(FX.s, FX.s);
      ctx.scale(fs * (variant === "cap" ? 0.72 : 1), fs * (variant === "cap" ? 0.72 : 1));
      ctx.translate(-50, -35.8);
      if (variant === "v1") {
        ctx.translate(0, -4.8);
        ctx.fillStyle = flameFill(31, 6);
        ctx.fill(p2(P.v1Wisp));
      } else if (flameKind === "twin") {
        ctx.fillStyle = flameFill();
        ctx.fill(p2(P.twinL));
        ctx.fill(p2(P.twinR));
      } else if (flameKind !== "none") {
        const d = { drop: P.flame, petal: P.petal, leaf: P.leaf, moon: P.moon, spark: P.spark }[flameKind];
        ctx.fillStyle = flameFill();
        ctx.fill(p2(d));
        if (!mono) {
          if (flameKind === "drop") {
            ctx.fillStyle = pal.fC;
            ctx.globalAlpha = 0.9;
            ctx.fill(p2(P.flameCore));
            ctx.globalAlpha = 1;
          } else if (flameKind === "leaf") {
            ctx.strokeStyle = hexA(pal.fC, 0.9);
            ctx.lineWidth = 1.3;
            ctx.lineCap = "round";
            ctx.stroke(p2(P.leafVein));
          }
        }
      }
      ctx.restore();
    };
    if (variant !== "cap") drawFlame();
    // body
    const bodyPath = p2(variant === "v1" ? P.v1Body : variant === "final" ? P.bodyF : P.body);
    ctx.fillStyle = bodyFill();
    ctx.fill(bodyPath);
    if (!mono) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = pal.line;
      ctx.stroke(bodyPath);
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fill(p2(variant === "v1" ? P.v1Sheen : variant === "final" ? P.sheenF : P.sheen));
    }
    // accessory
    if (o.acc === "scarf") {
      ctx.fillStyle = mono || "#D9707E";
      ctx.fill(p2(P.scarfTail));
      ctx.fill(p2(P.scarf));
      if (!mono) {
        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.lineWidth = 1.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
          const x = 24 + i * 6.5;
          ctx.moveTo(x, 84.5 + Math.abs(x - 50) * -0.02);
          ctx.lineTo(x + 1.6, 88.2 + Math.abs(x - 50) * -0.02);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(69.5, 99.5);
        ctx.lineTo(76.5, 100);
        ctx.strokeStyle = "rgba(255,255,255,.45)";
        ctx.stroke();
      }
    }
    if (variant === "cap") {
      ctx.save();
      ctx.translate(50, 41);
      ctx.rotate((-9 * Math.PI) / 180);
      ctx.translate(-50, -41);
      ctx.fillStyle = mono || "#7A5640";
      ctx.fill(p2(P.capRing));
      ctx.fillStyle = mono || "#FFF1D9";
      ctx.fill(p2(P.cap));
      if (!mono) {
        ctx.strokeStyle = "#E3B07A";
        ctx.lineWidth = 1.3;
        ctx.stroke(p2(P.capRibs));
        ctx.strokeStyle = "#C9725A";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.stroke(p2(P.capBand));
      }
      ctx.restore();
      drawFlame();
    }
    if (!mono) face(ctx, F, pal, o.expr || "idle", o);
    ctx.restore();
  }

  // ---------- board-lantern face (pt space; glass width w) ----------
  // Low-set eyes (+0.08w below glass centre), gap 0.36w. Ink on the warm glass.
  function lanternFace(ctx, cx, cy, w, expr = "idle", o = {}) {
    const u = w / 26;
    const ex = 4.6 * u,
      ey = cy + 2.0 * u;
    const [lx, ly] = (o.look || [0, 0]).map((v) => v * u);
    ctx.save();
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    const bl = (a) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = "#F28C8C";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * 7.6 * u, ey + 3.9 * u, 2.4 * u, 1.35 * u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
    };
    if (expr === "happy" || expr === "cheer") {
      bl(0.9);
      ctx.lineWidth = 1.5 * u;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * ex - 2 * u, ey + 0.7 * u);
        ctx.quadraticCurveTo(cx + s * ex, ey - 2.2 * u, cx + s * ex + 2 * u, ey + 0.7 * u);
        ctx.stroke();
      }
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 1.4 * u, ey + 3.2 * u);
      ctx.quadraticCurveTo(cx, ey + 5 * u, cx + 1.4 * u, ey + 3.2 * u);
      ctx.stroke();
    } else if (expr === "worried") {
      bl(0.5);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * ex + lx, ey + 0.4 * u + ly, 1.45 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 1.1 * u;
      ctx.beginPath();
      ctx.moveTo(cx - ex - 2.2 * u, ey - 2.6 * u);
      ctx.lineTo(cx - ex + 1.8 * u, ey - 3.8 * u);
      ctx.moveTo(cx + ex - 1.8 * u, ey - 3.8 * u);
      ctx.lineTo(cx + ex + 2.2 * u, ey - 2.6 * u);
      ctx.moveTo(cx - 2 * u, ey + 4 * u);
      ctx.quadraticCurveTo(cx - 1 * u, ey + 3 * u, cx, ey + 4 * u);
      ctx.quadraticCurveTo(cx + 1 * u, ey + 5 * u, cx + 2 * u, ey + 4 * u);
      ctx.stroke();
    } else if (expr === "sleepy") {
      bl(0.5);
      ctx.lineWidth = 1.3 * u;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * ex - 1.9 * u, ey);
        ctx.quadraticCurveTo(cx + s * ex, ey + 1.8 * u, cx + s * ex + 1.9 * u, ey);
        ctx.stroke();
      }
    } else {
      bl(0.75);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * ex + lx, ey + ly, 1.55 * u, 1.95 * u, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(cx + s * ex + lx + 0.55 * u, ey + ly - 0.75 * u, 0.55 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = INK;
      }
      ctx.lineWidth = 1.05 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 1 * u, ey + 3.3 * u);
      ctx.quadraticCurveTo(cx, ey + 4.2 * u, cx + 1 * u, ey + 3.3 * u);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- motion (spec §5.4) ----------
  const ease = {
    out: (t) => 1 - (1 - t) * (1 - t),
    in: (t) => t * t,
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  };
  // idle breathe: period 3200ms; flame flicker 900ms + 370ms; sway 2100ms
  function breathe(ms) {
    const s = Math.sin((2 * Math.PI * ms) / 3200);
    return {
      sy: 1 + 0.022 * s,
      sx: 1 - 0.014 * s,
      flameS: 1 + 0.05 * Math.sin((2 * Math.PI * ms) / 900) + 0.03 * Math.sin((2 * Math.PI * ms) / 370),
      flameRot: 4 * Math.sin((2 * Math.PI * ms) / 2100),
    };
  }
  // blink: 140ms total (close 50, hold 30, open 60)
  function blinkAt(ms) {
    if (ms < 0 || ms > 140) return 0;
    if (ms < 50) return ease.in(ms / 50);
    if (ms < 80) return 1;
    return 1 - ease.out((ms - 80) / 60);
  }
  // happy hop: 620ms
  function hop(ms) {
    const r = { sx: 1, sy: 1, dy: 0, flameS: 1, expr: "happy" };
    if (ms < 90) {
      const t = ease.out(ms / 90);
      r.sx = 1 + 0.12 * t;
      r.sy = 1 - 0.12 * t;
    } else if (ms < 300) {
      const t = (ms - 90) / 210;
      r.dy = -14 * ease.out(t);
      r.sx = 0.93 + 0.07 * t;
      r.sy = 1.09 - 0.09 * t;
      r.flameS = 1 + 0.2 * t;
    } else if (ms < 480) {
      const t = (ms - 300) / 180;
      r.dy = -14 * (1 - ease.in(t));
      r.sx = 1 - 0.04 * t;
      r.sy = 1 + 0.05 * t;
      r.flameS = 1.2 - 0.15 * t;
    } else if (ms < 560) {
      const t = (ms - 480) / 80;
      r.sx = 1.1 - 0.1 * Math.abs(1 - 2 * t) + 0.0;
      r.sx = 1 + 0.1 * Math.sin(Math.PI * t);
      r.sy = 1 - 0.1 * Math.sin(Math.PI * t);
      r.flameS = 1.05;
    } else {
      const t = Math.min(1, (ms - 560) / 60);
      r.sx = 1 - 0.02 * Math.sin(Math.PI * t);
      r.sy = 1 + 0.02 * Math.sin(Math.PI * t);
      r.flameS = 1.05 - 0.05 * t;
    }
    return r;
  }
  // worried: 0–120 react, 120–480 shiver (14 Hz, ±0.8 units, decaying), then hold lean −3°
  function worry(ms) {
    const r = { expr: "worried", flameS: 1, flameRot: 0, rot: 0, dx: 0 };
    const t = Math.min(1, ms / 120);
    r.flameS = 1 - 0.2 * ease.out(t);
    r.flameRot = -8 * ease.out(t);
    r.rot = -3 * ease.out(t);
    if (ms > 120 && ms < 480) r.dx = 0.8 * Math.sin(((ms - 120) / 1000) * 14 * 2 * Math.PI) * (1 - (ms - 120) / 360);
    r.sy = 1 - 0.03 * ease.out(t);
    r.sx = 1 + 0.02 * ease.out(t);
    return r;
  }

  function sparkle(ctx, x, y, r, col = "#FFF3DE", a = 1) {
    const k = r * 0.28;
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
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  window.Wick2 = { INK, PAL, P, FACE, draw, lanternFace, breathe, blinkAt, hop, worry, ease, sparkle, hexA };
})();
