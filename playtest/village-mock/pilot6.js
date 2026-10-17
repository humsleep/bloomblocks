// Pilot furniture — 6 items × 3 colourways at shipping quality (the Reality gate before the other 18).
// Same rules as every asset: one light (upper-left warm key, cool fill, plum shadows), the shared
// solid() recipe, a contact shadow + AO baked in, outlines one step darker than the fill (never black),
// 2.6 pt round strokes for drawn lines. draw(ctx, x, y, s, cw): (x, y) = bottom centre on the floor,
// s = pt per unit (a room slot is ≈ 40 units wide), cw = colourway token.
(function () {
  const K = window.Kit;
  const { T, solid, P, rrect, ellipseP, contact, glow, mix, hexA } = K;
  const B = (x, y, w, h) => ({ x, y, w, h });
  const CW = {
    cream: { base: "#F1DFC0", hi: "#FFF6E4", lo: "#C8A47E", deep: "#A07A58", accent: "#E3A86A" },
    sage: { base: "#A6CDB4", hi: "#DDF1E3", lo: "#6E9A82", deep: "#4F7A66", accent: "#E8C46A" },
    rose: { base: "#EDB0BC", hi: "#FCE0E5", lo: "#C27A8B", deep: "#9C5A6C", accent: "#FFD27A" },
  };
  const WOOD = { base: "#B07A55", hi: "#D9A57C", lo: "#7E5038", deep: "#5A3828" };
  const line = (c) => hexA(mix(c, T.plum, 0.55), 0.85);

  function grainLines(ctx, path, x0, y0, w, h, s, col, n = 5) {
    ctx.save();
    ctx.clip(path);
    ctx.strokeStyle = hexA(col, 0.28);
    ctx.lineWidth = 0.6 * s;
    for (let i = 0; i < n; i++) {
      const y = y0 + (h * (i + 0.5)) / n;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.bezierCurveTo(x0 + w * 0.3, y - 1.2 * s, x0 + w * 0.6, y + 1.4 * s, x0 + w, y - 0.4 * s);
      ctx.stroke();
    }
    ctx.restore();
  }
  function stitch(ctx, path, s, col) {
    ctx.save();
    ctx.setLineDash([1.6 * s, 1.4 * s]);
    ctx.lineWidth = 0.55 * s;
    ctx.strokeStyle = hexA(col, 0.75);
    ctx.stroke(path);
    ctx.restore();
  }
  function shine(ctx, x, y, w, s, a = 0.55) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 1.1 * s;
    ctx.strokeStyle = hexA("#FFFFFF", a);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y - w * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  const ITEMS = {
    // ★ 종이 등불 — the room's warm light (its pool is part of the asset)
    paperLantern: {
      name: "Paper lantern", ko: "종이 등불", cat: "Lights",
      draw(ctx, x, y, s, cw) {
        const c = CW[cw];
        glow(ctx, x, y - 2 * s, 34 * s, T.glow, 0.32, 0.3);
        contact(ctx, x + 1.5 * s, y, 12 * s, 2.6 * s, 0.45);
        glow(ctx, x, y - 22 * s, 30 * s, T.glow, 0.5);
        // three short legs
        for (const dx of [-7, 0, 7]) {
          const l = rrect(x + (dx - 1) * s, y - 7 * s, 2 * s, 7 * s, 1 * s);
          solid(ctx, l, WOOD.lo, B(x + (dx - 1) * s, y - 7 * s, 2 * s, 7 * s), { rim: 0.4, lw: 0.4, line: line(WOOD.lo) });
        }
        // paper
        const body = P((q) => {
          q.moveTo(x - 9 * s, y - 8 * s);
          q.bezierCurveTo(x - 14 * s, y - 16 * s, x - 14 * s, y - 30 * s, x - 9 * s, y - 37 * s);
          q.lineTo(x + 9 * s, y - 37 * s);
          q.bezierCurveTo(x + 14 * s, y - 30 * s, x + 14 * s, y - 16 * s, x + 9 * s, y - 8 * s);
          q.closePath();
        });
        const g = ctx.createRadialGradient(x - 1.5 * s, y - 24 * s, 0.5 * s, x, y - 22 * s, 15 * s);
        g.addColorStop(0, "#FFFBEA");
        g.addColorStop(0.45, mix(c.hi, "#FFE7B0", 0.5));
        g.addColorStop(1, mix(c.base, T.amber, 0.25));
        ctx.fillStyle = g;
        ctx.fill(body);
        ctx.save();
        ctx.clip(body);
        ctx.strokeStyle = hexA(c.deep, 0.32);
        ctx.lineWidth = 0.7 * s;
        for (const yy of [-13, -18.5, -24, -29.5, -34]) {
          ctx.beginPath();
          ctx.moveTo(x - 15 * s, y + yy * s);
          ctx.quadraticCurveTo(x, y + (yy + 1.6) * s, x + 15 * s, y + yy * s);
          ctx.stroke();
        }
        const side = ctx.createLinearGradient(x - 14 * s, 0, x + 14 * s, 0);
        side.addColorStop(0, hexA(T.key, 0.25));
        side.addColorStop(0.3, hexA(T.key, 0));
        side.addColorStop(0.7, hexA(T.plum, 0));
        side.addColorStop(1, hexA(T.plum, 0.22));
        ctx.fillStyle = side;
        ctx.fillRect(x - 15 * s, y - 38 * s, 30 * s, 31 * s);
        ctx.restore();
        ctx.lineWidth = 0.7 * s;
        ctx.strokeStyle = line(c.lo);
        ctx.stroke(body);
        // handle: a solid wooden band whose ends sit in the lid (same outline as the body)
        const handle = P((q) => {
          q.arc(x, y - 38.6 * s, 5.6 * s, Math.PI * 1.04, Math.PI * 1.96);
          q.arc(x, y - 38.6 * s, 4 * s, Math.PI * 1.96, Math.PI * 1.04, true);
          q.closePath();
        });
        solid(ctx, handle, WOOD.lo, B(x - 5.6 * s, y - 44.2 * s, 11.2 * s, 5.6 * s), { rim: 0.4, tex: "wood" });
        // caps
        for (const [cy, w] of [[-39, 22], [-10, 20]]) {
          const cap = rrect(x - (w / 2) * s, y + cy * s, w * s, 3.4 * s, 1.6 * s);
          solid(ctx, cap, WOOD.base, B(x - (w / 2) * s, y + cy * s, w * s, 3.4 * s), { rim: 0.6, lw: 0.5, line: line(WOOD.base) });
        }
        // tassel: a cord from the lid's right end + a shaded tassel
        ctx.strokeStyle = mix(c.accent, T.ink, 0.25);
        ctx.lineWidth = K.lineW(ctx, 20 * s);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + 10.4 * s, y - 37.2 * s);
        ctx.quadraticCurveTo(x + 13.4 * s, y - 33 * s, x + 12.6 * s, y - 28 * s);
        ctx.stroke();
        const knot = ellipseP(x + 12.6 * s, y - 27.6 * s, 1.3 * s, 1.3 * s);
        solid(ctx, knot, c.accent, B(x + 11.3 * s, y - 28.9 * s, 2.6 * s, 2.6 * s), { rim: 0.2, ao: 0 });
        const tas = P((q) => {
          q.moveTo(x + 11.4 * s, y - 26.6 * s);
          q.lineTo(x + 13.8 * s, y - 26.6 * s);
          q.quadraticCurveTo(x + 14.8 * s, y - 22.6 * s, x + 14.2 * s, y - 21.4 * s);
          q.lineTo(x + 11 * s, y - 21.4 * s);
          q.quadraticCurveTo(x + 10.4 * s, y - 22.6 * s, x + 11.4 * s, y - 26.6 * s);
          q.closePath();
        });
        solid(ctx, tas, c.accent, B(x + 10.4 * s, y - 26.6 * s, 4.4 * s, 5.2 * s), { rim: 0.4, lit: 0.35 });
      },
    },
    // ★ 둥근 의자
    // ★ 둥근 의자 (v2: one wooden frame — the round back sits ON two posts that run to the floor)
    roundChair: {
      name: "Round chair", ko: "둥근 의자", cat: "Seats",
      draw(ctx, x, y, s, cw) {
        const c = CW[cw];
        contact(ctx, x + 1.5 * s, y, 15 * s, 3 * s, 0.42);
        // back posts: floor → top of the back (one piece with the back frame)
        for (const px of [-13, 10]) {
          const post = rrect(x + px * s, y - 34 * s, 3 * s, 34 * s, 1.2 * s);
          solid(ctx, post, WOOD.lo, B(x + px * s, y - 34 * s, 3 * s, 34 * s), { rim: 0.4, tex: "wood" });
        }
        // the round back: a wooden tombstone frame across the posts, padded inside
        const frame = P((q) => {
          q.moveTo(x - 13 * s, y - 22 * s);
          q.lineTo(x - 13 * s, y - 36 * s);
          q.quadraticCurveTo(x - 13 * s, y - 49 * s, x, y - 49 * s);
          q.quadraticCurveTo(x + 13 * s, y - 49 * s, x + 13 * s, y - 36 * s);
          q.lineTo(x + 13 * s, y - 22 * s);
          q.closePath();
        });
        solid(ctx, frame, WOOD.base, B(x - 13 * s, y - 49 * s, 26 * s, 27 * s), { rim: 1, tex: "wood" });
        const pad = P((q) => {
          q.moveTo(x - 9.6 * s, y - 23 * s);
          q.lineTo(x - 9.6 * s, y - 36 * s);
          q.quadraticCurveTo(x - 9.6 * s, y - 45.6 * s, x, y - 45.6 * s);
          q.quadraticCurveTo(x + 9.6 * s, y - 45.6 * s, x + 9.6 * s, y - 36 * s);
          q.lineTo(x + 9.6 * s, y - 23 * s);
          q.closePath();
        });
        solid(ctx, pad, c.base, B(x - 9.6 * s, y - 45.6 * s, 19.2 * s, 22.6 * s), { rim: 1.1, lit: 0.34, tex: "cloth" });
        stitch(ctx, P((q) => {
          q.moveTo(x - 7.4 * s, y - 25 * s);
          q.lineTo(x - 7.4 * s, y - 36 * s);
          q.quadraticCurveTo(x - 7.4 * s, y - 43.4 * s, x, y - 43.4 * s);
          q.quadraticCurveTo(x + 7.4 * s, y - 43.4 * s, x + 7.4 * s, y - 36 * s);
          q.lineTo(x + 7.4 * s, y - 25 * s);
        }), s, c.hi);
        ctx.fillStyle = hexA(c.deep, 0.6);
        ctx.beginPath();
        ctx.arc(x, y - 35 * s, 1 * s, 0, 6.3);
        ctx.fill();
        // seat: a padded slab on a wooden rail (front + a sliver of top)
        const rail = rrect(x - 15 * s, y - 18 * s, 30 * s, 4.4 * s, 1.6 * s);
        solid(ctx, rail, WOOD.base, B(x - 15 * s, y - 18 * s, 30 * s, 4.4 * s), { rim: 0.6, tex: "wood" });
        const seat = rrect(x - 14 * s, y - 24.5 * s, 28 * s, 7.5 * s, 3.6 * s);
        solid(ctx, seat, mix(c.base, c.hi, 0.2), B(x - 14 * s, y - 24.5 * s, 28 * s, 7.5 * s), { rim: 1, lit: 0.32, tex: "cloth" });
        stitch(ctx, P((q) => q.roundRect(x - 11.6 * s, y - 22.6 * s, 23.2 * s, 3.6 * s, 1.8 * s)), s, c.hi);
        // front legs, slightly splayed
        for (const sx of [-1, 1]) {
          const lx = x + sx * 11.5 * s;
          const l = P((q) => {
            q.moveTo(lx - 1.4 * s, y - 14 * s);
            q.lineTo(lx + 1.4 * s, y - 14 * s);
            q.lineTo(lx + (1.4 + sx * 0.9) * s, y);
            q.lineTo(lx + (-1.4 + sx * 0.9) * s, y);
            q.closePath();
          });
          solid(ctx, l, WOOD.base, B(lx - 2.4 * s, y - 14 * s, 4.8 * s, 14 * s), { rim: 0.5, tex: "wood" });
        }
        shine(ctx, x - 9 * s, y - 42 * s, 4 * s, s, 0.4);
      },
    },
    // ★ 찻상 (v2: front projection like every other piece; painted top, no rings; cream = painted ivory)
    teaTable: {
      name: "Tea table", ko: "찻상", cat: "Tables",
      draw(ctx, x, y, s, cw) {
        const c = { cream: { base: "#F4EBDA", hi: "#FFFBF2", lo: "#CDB896" }, sage: { base: "#9CC8AE", hi: "#D6EEDD", lo: "#5F8F76" }, rose: { base: "#E9A9B6", hi: "#FBDCE2", lo: "#B9707F" } }[cw];
        contact(ctx, x + 2 * s, y, 23 * s, 3.4 * s, 0.45);
        // back legs (in shadow), then front legs
        for (const dx of [-12, 9.6]) {
          const l = rrect(x + dx * s, y - 11 * s, 2.4 * s, 9.5 * s, 1 * s);
          solid(ctx, l, mix(c.lo, T.plum, 0.25), B(x + dx * s, y - 11 * s, 2.4 * s, 9.5 * s), { rim: 0.2, lit: 0.1 });
        }
        for (const dx of [-19, 16.4]) {
          const l = rrect(x + dx * s, y - 11 * s, 2.8 * s, 11 * s, 1.1 * s);
          solid(ctx, l, mix(c.base, c.lo, 0.45), B(x + dx * s, y - 11 * s, 2.8 * s, 11 * s), { rim: 0.4, tex: "wood" });
        }
        // apron (front face) + top sliver
        const apron = rrect(x - 20 * s, y - 14.5 * s, 40 * s, 5 * s, 1.6 * s);
        solid(ctx, apron, mix(c.base, c.lo, 0.3), B(x - 20 * s, y - 14.5 * s, 40 * s, 5 * s), { rim: 0.5, tex: "wood" });
        const top = rrect(x - 22 * s, y - 18 * s, 44 * s, 4.4 * s, 2.2 * s);
        solid(ctx, top, c.base, B(x - 22 * s, y - 18 * s, 44 * s, 4.4 * s), { rim: 1, lit: 0.38, ao: 0.08, tex: "wood" });
        shine(ctx, x - 16 * s, y - 16.6 * s, 9 * s, s, 0.55);
        // a cup on its saucer, with its own contact shadow
        contact(ctx, x + 7 * s, y - 17.8 * s, 5 * s, 0.9 * s, 0.4);
        const sc = rrect(x + 2.6 * s, y - 19.2 * s, 8.8 * s, 1.6 * s, 0.8 * s);
        solid(ctx, sc, "#FFF6E8", B(x + 2.6 * s, y - 19.2 * s, 8.8 * s, 1.6 * s), { rim: 0.2, ao: 0 });
        const cup = P((q) => {
          q.moveTo(x + 4.2 * s, y - 23.6 * s);
          q.lineTo(x + 9.8 * s, y - 23.6 * s);
          q.quadraticCurveTo(x + 9.6 * s, y - 19.2 * s, x + 7 * s, y - 19.2 * s);
          q.quadraticCurveTo(x + 4.4 * s, y - 19.2 * s, x + 4.2 * s, y - 23.6 * s);
          q.closePath();
        });
        solid(ctx, cup, "#FFF6E8", B(x + 4.2 * s, y - 23.6 * s, 5.6 * s, 4.4 * s), { rim: 0.3, ao: 0.14 });
        ctx.fillStyle = "#C98A5A";
        ctx.beginPath();
        ctx.ellipse(x + 7 * s, y - 23.4 * s, 2.5 * s, 0.6 * s, 0, 0, 6.3);
        ctx.fill();
      },
    },
    // ★ 작은 침대 (v2: low head- and footboard joined to the frame; head ≤ 1.3 × mattress height; long)
    smallBed: {
      name: "Little bed", ko: "작은 침대", cat: "Beds",
      draw(ctx, x, y, s, cw) {
        const c = CW[cw];
        contact(ctx, x + 2 * s, y, 34 * s, 3.8 * s, 0.45);
        const L = -32, R = 32; // 64 units long (≥ 2 × the chair's 28)
        // legs
        for (const dx of [L + 2, R - 5]) {
          const l = rrect(x + dx * s, y - 5 * s, 3 * s, 5 * s, 1 * s);
          solid(ctx, l, WOOD.lo, B(x + dx * s, y - 5 * s, 3 * s, 5 * s), { rim: 0.3 });
        }
        // headboard (left): two soft bumps, top at 21 units (mattress top 16 → 1.3×), one piece with the rail
        const head = P((q) => {
          q.moveTo(x + L * s, y - 4 * s);
          q.lineTo(x + L * s, y - 17 * s);
          q.quadraticCurveTo(x + L * s, y - 21 * s, x + (L + 4) * s, y - 21 * s);
          q.quadraticCurveTo(x + (L + 7) * s, y - 23 * s, x + (L + 10) * s, y - 21 * s);
          q.quadraticCurveTo(x + (L + 13) * s, y - 21 * s, x + (L + 13) * s, y - 17 * s);
          q.lineTo(x + (L + 13) * s, y - 4 * s);
          q.closePath();
        });
        solid(ctx, head, WOOD.base, B(x + L * s, y - 23 * s, 13 * s, 19 * s), { rim: 1, tex: "wood" });
        const knob = ellipseP(x + (L + 7) * s, y - 21.6 * s, 1.4 * s, 1.4 * s);
        ctx.fillStyle = c.accent;
        ctx.fill(knob);
        // footboard (right), lower
        const foot = P((q) => {
          q.moveTo(x + (R - 8) * s, y - 4 * s);
          q.lineTo(x + (R - 8) * s, y - 14 * s);
          q.quadraticCurveTo(x + (R - 8) * s, y - 16.5 * s, x + (R - 4) * s, y - 16.5 * s);
          q.quadraticCurveTo(x + R * s, y - 16.5 * s, x + R * s, y - 14 * s);
          q.lineTo(x + R * s, y - 4 * s);
          q.closePath();
        });
        solid(ctx, foot, WOOD.base, B(x + (R - 8) * s, y - 16.5 * s, 8 * s, 12.5 * s), { rim: 0.8, tex: "wood" });
        // rail joining both
        const rail = rrect(x + (L + 1) * s, y - 10 * s, (R - L - 2) * s, 6 * s, 2 * s);
        solid(ctx, rail, WOOD.base, B(x + (L + 1) * s, y - 10 * s, (R - L - 2) * s, 6 * s), { rim: 0.6, tex: "wood" });
        // mattress
        const mat = rrect(x + (L + 11) * s, y - 16 * s, (R - L - 18) * s, 6.4 * s, 3 * s);
        solid(ctx, mat, "#FFF7EA", B(x + (L + 11) * s, y - 16 * s, (R - L - 18) * s, 6.4 * s), { rim: 0.8, tex: "cloth" });
        // pillow
        const pil = rrect(x + (L + 11.5) * s, y - 21 * s, 12 * s, 6.4 * s, 3.2 * s);
        solid(ctx, pil, "#FFFBF2", B(x + (L + 11.5) * s, y - 21 * s, 12 * s, 6.4 * s), { rim: 1, lit: 0.3, tex: "cloth" });
        // quilt with patchwork + scalloped hem
        const qx0 = L + 22, qx1 = R - 6;
        const quilt = P((q) => {
          q.moveTo(x + qx0 * s, y - 18 * s);
          q.quadraticCurveTo(x + ((qx0 + qx1) / 2) * s, y - 19.5 * s, x + qx1 * s, y - 17.5 * s);
          q.lineTo(x + (qx1 + 1) * s, y - 9 * s);
          const n = 7, step = (qx1 + 1 - qx0) / n;
          for (let i = 0; i < n; i++) q.quadraticCurveTo(x + (qx1 + 1 - step * (i + 0.5)) * s, y - 6.6 * s, x + (qx1 + 1 - step * (i + 1)) * s, y - 9 * s);
          q.closePath();
        });
        solid(ctx, quilt, c.base, B(x + qx0 * s, y - 19.5 * s, (qx1 - qx0 + 1) * s, 13 * s), { rim: 1, lit: 0.3, tex: "cloth" });
        ctx.save();
        ctx.clip(quilt);
        for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
          if ((i + j) % 2) continue;
          ctx.fillStyle = hexA(c.hi, 0.55);
          ctx.fillRect(x + (qx0 + i * 4) * s, y + (-20 + j * 4) * s, 4 * s, 4 * s);
        }
        ctx.restore();
        stitch(ctx, P((q) => {
          q.moveTo(x + (qx0 + 1) * s, y - 16.5 * s);
          q.quadraticCurveTo(x + ((qx0 + qx1) / 2) * s, y - 18 * s, x + (qx1 - 1) * s, y - 16 * s);
        }), s, "#FFFFFF");
        shine(ctx, x + (L + 2) * s, y - 18 * s, 3 * s, s, 0.45);
      },
    },
    smallPot: {
      name: "Little pot", ko: "작은 화분", cat: "Plants",
      draw(ctx, x, y, s, cw) {
        const c = CW[cw];
        contact(ctx, x + 1 * s, y, 9 * s, 2.2 * s, 0.42);
        // leaves (behind the rim), each with a vein
        const leaves = [[-6, -22, -0.9, 7], [6, -23, 0.8, 7.4], [0, -28, 0.05, 7.6], [-9, -16, -1.3, 5.6], [9, -16, 1.3, 5.6], [-2, -19, -0.35, 6]];
        for (const [dx, dy, a, l] of leaves) {
          ctx.save();
          ctx.translate(x + dx * 0.3 * s, y - 13 * s);
          ctx.rotate(a);
          const lf = P((q) => {
            q.moveTo(0, 0);
            q.bezierCurveTo(-l * 0.55 * s, -l * 0.4 * s, -l * 0.45 * s, -l * 1.1 * s, 0, -l * 1.45 * s);
            q.bezierCurveTo(l * 0.45 * s, -l * 1.1 * s, l * 0.55 * s, -l * 0.4 * s, 0, 0);
            q.closePath();
          });
          solid(ctx, lf, a < -0.5 ? "#5E9474" : a > 0.5 ? "#4F8466" : "#6BA683", B(-l * 0.55 * s, -l * 1.45 * s, l * 1.1 * s, l * 1.45 * s), { rim: 0.7, lit: 0.38, ao: 0, line: hexA("#2E5442", 0.7), lw: 0.5 });
          ctx.strokeStyle = hexA("#DFF5E6", 0.55);
          ctx.lineWidth = 0.45 * s;
          ctx.beginPath();
          ctx.moveTo(0, -0.5 * s);
          ctx.quadraticCurveTo(0.4 * s, -l * 0.7 * s, 0, -l * 1.3 * s);
          ctx.stroke();
          ctx.restore();
        }
        // glazed pot in the colourway
        const body = P((q) => {
          q.moveTo(x - 8 * s, y - 12 * s);
          q.lineTo(x + 8 * s, y - 12 * s);
          q.bezierCurveTo(x + 8.4 * s, y - 6 * s, x + 7 * s, y - 1 * s, x + 5.5 * s, y);
          q.lineTo(x - 5.5 * s, y);
          q.bezierCurveTo(x - 7 * s, y - 1 * s, x - 8.4 * s, y - 6 * s, x - 8 * s, y - 12 * s);
          q.closePath();
        });
        solid(ctx, body, c.base, B(x - 8.4 * s, y - 12 * s, 16.8 * s, 12 * s), { rim: 0.9, lit: 0.36, line: line(c.base), lw: 0.55 });
        ctx.save();
        ctx.clip(body);
        ctx.strokeStyle = hexA(c.hi, 0.7);
        ctx.lineWidth = 0.9 * s;
        ctx.beginPath();
        ctx.moveTo(x - 8 * s, y - 6 * s);
        for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(x + (-7 + i * 2) * s, y - (i % 2 ? 7.6 : 4.6) * s, x + (-6 + i * 2) * s, y - 6 * s);
        ctx.stroke();
        ctx.restore();
        const lip = rrect(x - 9.2 * s, y - 14 * s, 18.4 * s, 3.2 * s, 1.6 * s);
        solid(ctx, lip, mix(c.base, "#FFFFFF", 0.15), B(x - 9.2 * s, y - 14 * s, 18.4 * s, 3.2 * s), { rim: 0.5, ao: 0, line: line(c.base), lw: 0.5 });
        ctx.fillStyle = "#4A3A52";
        ctx.beginPath();
        ctx.ellipse(x, y - 13.4 * s, 7.6 * s, 0.9 * s, 0, 0, 6.3);
        ctx.fill();
        shine(ctx, x - 6 * s, y - 9.5 * s, 2.4 * s, s, 0.6);
      },
    },
    // ★ 책장
    bookshelf: {
      name: "Bookshelf", ko: "책장", cat: "Storage",
      draw(ctx, x, y, s, cw) {
        const c = CW[cw];
        contact(ctx, x + 2 * s, y, 17 * s, 3 * s, 0.45);
        const body = P((q) => {
          q.moveTo(x - 14 * s, y - 2 * s);
          q.lineTo(x - 14 * s, y - 40 * s);
          q.quadraticCurveTo(x - 14 * s, y - 50 * s, x, y - 51 * s);
          q.quadraticCurveTo(x + 14 * s, y - 50 * s, x + 14 * s, y - 40 * s);
          q.lineTo(x + 14 * s, y - 2 * s);
          q.closePath();
        });
        solid(ctx, body, c.base, B(x - 14 * s, y - 51 * s, 28 * s, 49 * s), { rim: 1.2, lit: 0.3, line: line(c.base), lw: 0.6 });
        // recess
        const inner = P((q) => {
          q.moveTo(x - 11 * s, y - 5 * s);
          q.lineTo(x - 11 * s, y - 39 * s);
          q.quadraticCurveTo(x - 11 * s, y - 47 * s, x, y - 48 * s);
          q.quadraticCurveTo(x + 11 * s, y - 47 * s, x + 11 * s, y - 39 * s);
          q.lineTo(x + 11 * s, y - 5 * s);
          q.closePath();
        });
        ctx.fillStyle = mix(c.lo, T.plum, 0.35);
        ctx.fill(inner);
        ctx.save();
        ctx.clip(inner);
        const ig = ctx.createLinearGradient(x - 11 * s, 0, x + 11 * s, 0);
        ig.addColorStop(0, hexA(T.plum, 0.35));
        ig.addColorStop(0.4, hexA(T.plum, 0));
        ctx.fillStyle = ig;
        ctx.fillRect(x - 11 * s, y - 48 * s, 22 * s, 44 * s);
        ctx.restore();
        const cols = [T.coral, T.lilac, T.lemon, T.mint, "#9DBDE6", T.pink, "#F2C6A8"];
        const shelves = [-37, -24, -11];
        shelves.forEach((sy, si) => {
          const sh = rrect(x - 11 * s, y + sy * s, 22 * s, 2 * s, 0.6 * s);
          solid(ctx, sh, c.base, B(x - 11 * s, y + sy * s, 22 * s, 2 * s), { rim: 0.4, lw: 0.4, ao: 0, line: line(c.base) });
          let bx = x - 10 * s;
          const n = si === 1 ? 4 : si === 0 ? 5 : 6;
          for (let i = 0; i < n; i++) {
            const bw = (2.4 + ((i * 7 + si) % 3) * 0.6) * s;
            // the top shelf sits under the arch: its books are shorter and none leans out
            const bh = (si === 0 ? 6.2 + ((i * 5) % 2) * 0.8 : 8 + ((i * 5 + si) % 3) * 1.4) * s;
            const lean = i === n - 1 && si === 2 ? 0.16 : 0;
            ctx.save();
            ctx.translate(bx + bw / 2, y + sy * s);
            ctx.rotate(lean);
            const bk = rrect(-bw / 2, -bh, bw, bh, 0.6 * s);
            const col = cols[(i * 3 + si * 2) % cols.length];
            solid(ctx, bk, col, B(-bw / 2, -bh, bw, bh), { rim: 0.35, lw: 0.35, ao: 0.1, line: line(col) });
            ctx.fillStyle = hexA("#FFFFFF", 0.45);
            ctx.fillRect(-bw / 2 + 0.4 * s, -bh * 0.7, bw - 0.8 * s, 0.6 * s);
            ctx.restore();
            bx += bw + 0.5 * s;
          }
          if (si === 1) {
            // a jar of fireflies + a tiny plant on the middle shelf
            glow(ctx, x + 6 * s, y + (sy - 4) * s, 7 * s, "#FFF2A8", 0.55);
            const jar = rrect(x + 3.6 * s, y + (sy - 7.4) * s, 5 * s, 7.4 * s, 1.6 * s);
            ctx.fillStyle = hexA("#DDF0FF", 0.45);
            ctx.fill(jar);
            ctx.strokeStyle = hexA("#FFFFFF", 0.7);
            ctx.lineWidth = 0.5 * s;
            ctx.stroke(jar);
            ctx.fillStyle = "#FFFBE0";
            for (const [dx, dy] of [[5, -3], [6.6, -5], [5.6, -6]]) {
              ctx.beginPath();
              ctx.arc(x + dx * s, y + (sy + dy) * s, 0.5 * s, 0, 6.3);
              ctx.fill();
            }
          }
        });
        // top ornament: a little lantern on the arch
        glow(ctx, x, y - 54 * s, 8 * s, T.glow, 0.45);
        K.miniLantern(ctx, x, y - 54.5 * s, 6 * s, true);
        // plinth
        const pl = rrect(x - 15 * s, y - 3 * s, 30 * s, 3 * s, 1.2 * s);
        solid(ctx, pl, mix(c.base, T.plum, 0.12), B(x - 15 * s, y - 3 * s, 30 * s, 3 * s), { rim: 0.4, lw: 0.4, line: line(c.base) });
        shine(ctx, x - 12.5 * s, y - 43 * s, 3 * s, s, 0.4);
      },
    },
  };

  window.Pilot = { ITEMS, CW, ORDER: ["paperLantern", "roundChair", "teaTable", "smallBed", "smallPot", "bookshelf"] };
})();
