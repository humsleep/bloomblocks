// Furniture & decor set (40 items) — front-facing 2.5D: every piece shows its front and a sliver of
// its top (eye level ≈ a seated resident), the same shading recipe and light model as the village.
// draw(ctx, x, y, s, col): (x, y) = bottom centre on the floor; s = pt per unit (unit ≈ 1/40 of a room).
(function () {
  const K = window.Kit;
  const { T, solid, rrect, ellipseP, P, contact, glow, mix, hexA, flower } = K;
  const box = (x, y, w, h) => ({ x, y, w, h });

  function legs(ctx, x, y, s, w, h, col) {
    for (const dx of [-w / 2 + 2, w / 2 - 4]) {
      const l = rrect(x + dx * s, y - h * s, 2.2 * s, h * s, 1 * s);
      solid(ctx, l, col, box(x + dx * s, y - h * s, 2.2 * s, h * s), { rim: 0.6, lw: 0.5 });
    }
  }
  function slab(ctx, x, y, w, h, top, col, r = 3) {
    // a box: front face w×h (pt, bottom at y) + top face of depth `top`
    const tp = P((q) => q.roundRect(x - w / 2 + top * 0.3, y - h - top, w - top * 0.6, top + r, r));
    solid(ctx, tp, mix(col, "#FFFFFF", 0.14), box(x - w / 2, y - h - top, w, top + r), { rim: 0.8, ao: 0, lw: 0.6 });
    const fr = rrect(x - w / 2, y - h, w, h, r);
    solid(ctx, fr, col, box(x - w / 2, y - h, w, h), { rim: 1 });
  }

  const ITEMS = [];
  const add = (id, name, cat, draw, col) => ITEMS.push({ id, name, cat, draw, col });

  // ---- furniture
  add("chair", "Cosy chair", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 12 * s, 2.6 * s);
    const back = rrect(x - 9 * s, y - 30 * s, 18 * s, 18 * s, 7 * s);
    solid(ctx, back, c, box(x - 9 * s, y - 30 * s, 18 * s, 18 * s), { rim: 1.2 });
    legs(ctx, x, y, s, 18, 8, T.woodLo);
    const seat = rrect(x - 11 * s, y - 15 * s, 22 * s, 7 * s, 3.5 * s);
    solid(ctx, seat, mix(c, "#FFFFFF", 0.1), box(x - 11 * s, y - 15 * s, 22 * s, 7 * s), { rim: 1 });
  }, "#E9A5B4");
  add("stool", "Toadstool stool", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 9 * s, 2.2 * s);
    const st = rrect(x - 4 * s, y - 9 * s, 8 * s, 9 * s, 3 * s);
    solid(ctx, st, "#F3E6D0", box(x - 4 * s, y - 9 * s, 8 * s, 9 * s), { rim: 0.8 });
    const cap = P((q) => q.ellipse(x, y - 11 * s, 10 * s, 5 * s, 0, 0, 6.3));
    solid(ctx, cap, c, box(x - 10 * s, y - 16 * s, 20 * s, 10 * s), { rim: 1.1 });
    ctx.fillStyle = "#FFF3DE";
    for (const [dx, dy, r] of [[-5, -13, 1.6], [2, -14, 1.2], [6, -11, 1.1]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
      ctx.fill();
    }
  }, "#E8706B");
  add("table", "Round tea table", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 16 * s, 3 * s);
    const ped = rrect(x - 2.5 * s, y - 14 * s, 5 * s, 14 * s, 2 * s);
    solid(ctx, ped, T.woodLo, box(x - 2.5 * s, y - 14 * s, 5 * s, 14 * s), { rim: 0.6 });
    const foot = ellipseP(x, y - 1 * s, 8 * s, 2 * s);
    solid(ctx, foot, T.wood, box(x - 8 * s, y - 3 * s, 16 * s, 4 * s), { rim: 0.6, lw: 0.5 });
    const top = ellipseP(x, y - 16 * s, 16 * s, 4.5 * s);
    solid(ctx, top, c, box(x - 16 * s, y - 21 * s, 32 * s, 9 * s), { rim: 1, ao: 0.1 });
    const edge = P((q) => {
      q.ellipse(x, y - 16 * s, 16 * s, 4.5 * s, 0, 0, Math.PI);
      q.ellipse(x, y - 14 * s, 16 * s, 4.5 * s, 0, Math.PI, 0, true);
    });
    solid(ctx, edge, mix(c, T.plum, 0.25), box(x - 16 * s, y - 16 * s, 32 * s, 7 * s), { rim: 0, lw: 0.5 });
  }, T.woodHi);
  add("bed", "Cloud bed", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 26 * s, 3.4 * s);
    const head = P((q) => {
      q.moveTo(x - 24 * s, y - 6 * s);
      q.lineTo(x - 24 * s, y - 26 * s);
      q.quadraticCurveTo(x - 24 * s, y - 36 * s, x - 14 * s, y - 36 * s);
      q.quadraticCurveTo(x - 8 * s, y - 42 * s, x - 2 * s, y - 36 * s);
      q.lineTo(x - 2 * s, y - 6 * s);
      q.closePath();
    });
    solid(ctx, head, T.woodHi, box(x - 24 * s, y - 42 * s, 22 * s, 36 * s), { rim: 1.2 });
    slab(ctx, x, y - 3 * s, 48 * s, 10 * s, 4 * s, T.wood);
    const quilt = P((q) => q.roundRect(x - 18 * s, y - 20 * s, 40 * s, 11 * s, 5 * s));
    solid(ctx, quilt, c, box(x - 18 * s, y - 20 * s, 40 * s, 11 * s), { rim: 1.2 });
    ctx.save();
    ctx.clip(quilt);
    ctx.strokeStyle = hexA("#FFFFFF", 0.35);
    ctx.setLineDash([2 * s, 2 * s]);
    ctx.lineWidth = 0.8 * s;
    for (const dx of [-6, 6, 18]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * s, y - 20 * s);
      ctx.lineTo(x + dx * s, y - 9 * s);
      ctx.stroke();
    }
    ctx.restore();
    const pil = rrect(x - 21 * s, y - 25 * s, 13 * s, 7 * s, 3.5 * s);
    solid(ctx, pil, "#FFF8EC", box(x - 21 * s, y - 25 * s, 13 * s, 7 * s), { rim: 1 });
  }, "#C9B6F0");
  add("sofa", "Mochi sofa", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 22 * s, 3 * s);
    const back = rrect(x - 19 * s, y - 24 * s, 38 * s, 16 * s, 8 * s);
    solid(ctx, back, mix(c, T.plum, 0.08), box(x - 19 * s, y - 24 * s, 38 * s, 16 * s), { rim: 1.2 });
    const seat = rrect(x - 20 * s, y - 12 * s, 40 * s, 10 * s, 5 * s);
    solid(ctx, seat, c, box(x - 20 * s, y - 12 * s, 40 * s, 10 * s), { rim: 1.2 });
    for (const dx of [-22, 14]) {
      const arm = rrect(x + dx * s, y - 17 * s, 8 * s, 15 * s, 4 * s);
      solid(ctx, arm, mix(c, "#FFFFFF", 0.08), box(x + dx * s, y - 17 * s, 8 * s, 15 * s), { rim: 1 });
    }
  }, "#A8DCC8");
  add("bookshelf", "Tall bookshelf", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 14 * s, 2.6 * s);
    slab(ctx, x, y, 24 * s, 42 * s, 3 * s, c);
    const cols = [T.coral, T.mint, T.lemon, T.lilac, T.pink, "#8FB3E8"];
    for (const [sy, n] of [[-30, 6], [-17, 5], [-4, 3]]) {
      const shelf = rrect(x - 10 * s, y + (sy - 1) * s, 20 * s, 2 * s, 0.6 * s);
      ctx.fillStyle = mix(c, T.plum, 0.35);
      ctx.fill(shelf);
      for (let i = 0; i < n; i++) {
        const bh = (7 + (i % 3)) * s;
        const bk = rrect(x - 9 * s + i * 3.2 * s, y + (sy - 1) * s - bh, 2.8 * s, bh, 0.6 * s);
        solid(ctx, bk, cols[(i + n) % cols.length], box(x - 9 * s + i * 3.2 * s, y + (sy - 1) * s - bh, 2.8 * s, bh), { rim: 0.4, lw: 0.3, ao: 0 });
      }
    }
    K.pot(ctx, x + 6 * s, y - 5 * s, 0.32 * s, "leafy", "#8FB3E8");
  }, T.woodHi);
  add("cabinet", "Round-top dresser", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 14 * s, 2.6 * s);
    const b = P((q) => {
      q.moveTo(x - 12 * s, y - 2 * s);
      q.lineTo(x - 12 * s, y - 20 * s);
      q.quadraticCurveTo(x - 12 * s, y - 26 * s, x, y - 27 * s);
      q.quadraticCurveTo(x + 12 * s, y - 26 * s, x + 12 * s, y - 20 * s);
      q.lineTo(x + 12 * s, y - 2 * s);
      q.closePath();
    });
    solid(ctx, b, c, box(x - 12 * s, y - 27 * s, 24 * s, 25 * s), { rim: 1.2 });
    for (const dy of [-18, -9]) {
      const d = rrect(x - 9 * s, y + dy * s, 18 * s, 7 * s, 2 * s);
      solid(ctx, d, mix(c, "#FFFFFF", 0.1), box(x - 9 * s, y + dy * s, 18 * s, 7 * s), { rim: 0.7, lw: 0.5 });
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.arc(x, y + (dy + 3.5) * s, 1 * s, 0, 6.3);
      ctx.fill();
    }
    legs(ctx, x, y, s, 22, 3, T.woodLo);
  }, "#F2C6A8");
  add("desk", "Writing desk", "Furniture", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 18 * s, 2.6 * s);
    legs(ctx, x, y, s, 30, 14, T.woodLo);
    slab(ctx, x, y - 14 * s, 32 * s, 4 * s, 3 * s, c);
    const dr = rrect(x + 2 * s, y - 14 * s, 12 * s, 6 * s, 1.5 * s);
    solid(ctx, dr, mix(c, T.plum, 0.1), box(x + 2 * s, y - 14 * s, 12 * s, 6 * s), { rim: 0.6, lw: 0.5 });
  }, T.woodHi);
  // ---- rugs
  add("rugRound", "Moon rug", "Rugs", (ctx, x, y, s, c) => {
    const r = ellipseP(x, y - 2 * s, 24 * s, 6 * s);
    solid(ctx, r, c, box(x - 24 * s, y - 8 * s, 48 * s, 12 * s), { rim: 0.8, ao: 0.08, lit: 0.18 });
    ctx.lineWidth = 1.2 * s;
    ctx.strokeStyle = hexA("#FFFFFF", 0.4);
    ctx.setLineDash([2.5 * s, 2 * s]);
    ctx.beginPath();
    ctx.ellipse(x, y - 2 * s, 19 * s, 4.4 * s, 0, 0, 6.3);
    ctx.stroke();
    ctx.setLineDash([]);
  }, "#8FA0D8");
  add("rugPetal", "Petal rug", "Rugs", (ctx, x, y, s, c) => {
    const r = P((q) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283;
        q.moveTo(x + Math.cos(a) * 16 * s + 10 * s, y - 2 * s + Math.sin(a) * 4 * s);
        q.ellipse(x + Math.cos(a) * 16 * s, y - 2 * s + Math.sin(a) * 4 * s, 10 * s, 3.6 * s, 0, 0, 6.3);
      }
      q.moveTo(x + 14 * s, y - 2 * s);
      q.ellipse(x, y - 2 * s, 14 * s, 4 * s, 0, 0, 6.3);
    });
    solid(ctx, r, c, box(x - 26 * s, y - 8 * s, 52 * s, 12 * s), { rim: 0.6, ao: 0.06, lit: 0.18, lw: 0.6 });
    ctx.fillStyle = hexA("#FFE59A", 0.8);
    ctx.beginPath();
    ctx.ellipse(x, y - 2 * s, 5 * s, 1.4 * s, 0, 0, 6.3);
    ctx.fill();
  }, "#F6B7C4");
  add("rugStripe", "Hearth rug", "Rugs", (ctx, x, y, s, c) => {
    const r = P((q) => q.roundRect(x - 22 * s, y - 7 * s, 44 * s, 8 * s, 4 * s));
    solid(ctx, r, c, box(x - 22 * s, y - 7 * s, 44 * s, 8 * s), { rim: 0.6, ao: 0.06, lit: 0.15 });
    ctx.save();
    ctx.clip(r);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = hexA(i % 2 ? T.cream : T.amber, 0.45);
      ctx.fillRect(x - 22 * s + i * 8 * s, y - 7 * s, 3 * s, 8 * s);
    }
    ctx.restore();
  }, "#B5705E");
  add("rugStar", "Star rug", "Rugs", (ctx, x, y, s, c) => {
    const r = P((q) => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.283 - 1.57, rr = i % 2 ? 9 : 22;
        const px = x + Math.cos(a) * rr * s, py = y - 3 * s + Math.sin(a) * rr * s * 0.28;
        i ? q.lineTo(px, py) : q.moveTo(px, py);
      }
      q.closePath();
    });
    solid(ctx, r, c, box(x - 22 * s, y - 10 * s, 44 * s, 14 * s), { rim: 0.6, ao: 0.05, lw: 0.6 });
  }, "#FFE59A");
  // ---- plants
  add("monstera", "Big leaf plant", "Plants", (ctx, x, y, s) => K.pot(ctx, x, y, 0.9 * s, "leafy", "#E9A5B4"));
  add("flowers", "Flower pot", "Plants", (ctx, x, y, s) => K.pot(ctx, x, y, 0.9 * s, "flowers", "#8FB3E8"));
  add("cactus", "Blooming cactus", "Plants", (ctx, x, y, s) => K.pot(ctx, x, y, 0.9 * s, "cactus", "#F2C6A8"));
  add("hanging", "Hanging ivy", "Plants", (ctx, x, y, s) => {
    ctx.strokeStyle = T.woodLo;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y - 14 * s);
    ctx.lineTo(x, y - 34 * s);
    ctx.lineTo(x + 6 * s, y - 14 * s);
    ctx.stroke();
    const b = P((q) => {
      q.moveTo(x - 8 * s, y - 14 * s);
      q.quadraticCurveTo(x, y - 4 * s, x + 8 * s, y - 14 * s);
      q.closePath();
    });
    solid(ctx, b, "#C27A5A", box(x - 8 * s, y - 14 * s, 16 * s, 10 * s), { rim: 0.8 });
    for (const [dx, dy] of [[-7, -12], [-9, -6], [-6, 0], [7, -11], [9, -4], [2, -16]]) {
      const l = ellipseP(x + dx * s, y + dy * s, 3 * s, 2 * s);
      solid(ctx, l, T.leaf, box(x + (dx - 3) * s, y + (dy - 2) * s, 6 * s, 4 * s), { rim: 0.5, lw: 0.3, ao: 0 });
    }
  });
  add("bonsai", "Little pine", "Plants", (ctx, x, y, s) => {
    contact(ctx, x, y, 8 * s, 2 * s);
    ctx.strokeStyle = T.wood;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * s);
    ctx.quadraticCurveTo(x - 4 * s, y - 12 * s, x + 2 * s, y - 18 * s);
    ctx.stroke();
    for (const [dx, dy, r] of [[2, -20, 6], [-5, -15, 4.5], [7, -14, 4]]) {
      const c = ellipseP(x + dx * s, y + dy * s, r * s, r * 0.7 * s);
      solid(ctx, c, "#5F9C7C", box(x + (dx - r) * s, y + (dy - r) * s, 2 * r * s, 1.4 * r * s), { rim: 0.7, lw: 0.4 });
    }
    slab(ctx, x, y, 16 * s, 5 * s, 2 * s, "#8FB3E8");
  });
  add("mushroom", "Glow mushrooms", "Plants", (ctx, x, y, s) => {
    for (const [dx, h, r, c] of [[-4, 8, 5, "#F6A7B8"], [4, 12, 6, "#FFE59A"]]) {
      glow(ctx, x + dx * s, y - h * s, 12 * s, c, 0.35);
      const st = rrect(x + (dx - 1.5) * s, y - h * s, 3 * s, h * s, 1.5 * s);
      solid(ctx, st, "#FFF3DE", box(x + (dx - 1.5) * s, y - h * s, 3 * s, h * s), { rim: 0.4, lw: 0.3 });
      const cap = P((q) => {
        q.moveTo(x + (dx - r) * s, y - h * s);
        q.quadraticCurveTo(x + dx * s, y - (h + r * 1.6) * s, x + (dx + r) * s, y - h * s);
        q.closePath();
      });
      solid(ctx, cap, c, box(x + (dx - r) * s, y - (h + r) * s, 2 * r * s, r * s), { rim: 0.8, lw: 0.5 });
    }
  });
  // ---- lights
  add("floorLamp", "Tulip floor lamp", "Lights", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 8 * s, 2 * s);
    glow(ctx, x, y - 40 * s, 30 * s, T.glow, 0.45);
    const pole = rrect(x - 1 * s, y - 38 * s, 2 * s, 38 * s, 1 * s);
    solid(ctx, pole, T.woodLo, box(x - 1 * s, y - 38 * s, 2 * s, 38 * s), { rim: 0.4, lw: 0.3 });
    const foot = ellipseP(x, y - 1 * s, 6 * s, 1.8 * s);
    solid(ctx, foot, T.wood, box(x - 6 * s, y - 3 * s, 12 * s, 4 * s), { rim: 0.5, lw: 0.4 });
    const shade = P((q) => {
      q.moveTo(x - 9 * s, y - 36 * s);
      q.quadraticCurveTo(x - 10 * s, y - 48 * s, x, y - 50 * s);
      q.quadraticCurveTo(x + 10 * s, y - 48 * s, x + 9 * s, y - 36 * s);
      q.quadraticCurveTo(x, y - 33 * s, x - 9 * s, y - 36 * s);
      q.closePath();
    });
    const g = ctx.createRadialGradient(x, y - 38 * s, 1, x, y - 42 * s, 12 * s);
    g.addColorStop(0, "#FFF6DC");
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.fill(shade);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = hexA(T.plum, 0.35);
    ctx.stroke(shade);
  }, "#FFC864");
  add("tableLamp", "Mochi lamp", "Lights", (ctx, x, y, s, c) => {
    glow(ctx, x, y - 10 * s, 20 * s, T.glow, 0.45);
    const b = P((q) => q.ellipse(x, y - 8 * s, 8 * s, 7 * s, 0, 0, 6.3));
    const g = ctx.createRadialGradient(x - 2 * s, y - 10 * s, 1, x, y - 8 * s, 9 * s);
    g.addColorStop(0, "#FFFBEF");
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.fill(b);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = hexA(T.plum, 0.3);
    ctx.stroke(b);
    ctx.fillStyle = "#3B2C45";
    for (const dx of [-2.6, 2.6]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y - 7 * s, 0.8 * s, 1 * s, 0, 0, 6.3);
      ctx.fill();
    }
  }, "#FFE6B8");
  add("stringLights", "String lights", "Lights", (ctx, x, y, s) => {
    ctx.strokeStyle = T.woodLo;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x - 30 * s, y - 20 * s);
    ctx.quadraticCurveTo(x, y - 8 * s, x + 30 * s, y - 20 * s);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7, bx = x - 30 * s + 60 * s * t, by = y - 20 * s + 24 * s * t * (1 - t) + 2 * s;
      const c = [T.amber, T.pink, T.mint, T.lemon, T.lilac][i % 5];
      glow(ctx, bx, by + 2 * s, 7 * s, c, 0.5);
      const b = rrect(bx - 1.8 * s, by, 3.6 * s, 4.2 * s, 1.6 * s);
      ctx.fillStyle = c;
      ctx.fill(b);
    }
  });
  add("paperLantern", "Paper lantern", "Lights", (ctx, x, y, s, c) => {
    glow(ctx, x, y - 10 * s, 22 * s, T.glow, 0.5);
    K.miniLantern(ctx, x, y - 10 * s, 18 * s, true);
    void c;
  });
  add("candles", "Candle trio", "Lights", (ctx, x, y, s) => {
    for (const [dx, h] of [[-5, 8], [0, 12], [5, 6]]) {
      glow(ctx, x + dx * s, y - (h + 3) * s, 8 * s, T.glow, 0.55);
      const cnd = rrect(x + (dx - 2) * s, y - h * s, 4 * s, h * s, 1.5 * s);
      solid(ctx, cnd, "#FFF3DE", box(x + (dx - 2) * s, y - h * s, 4 * s, h * s), { rim: 0.5, lw: 0.3 });
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y - (h + 2.2) * s, 1.1 * s, 2 * s, 0, 0, 6.3);
      ctx.fill();
    }
  });
  add("moonLamp", "Moon night-light", "Lights", (ctx, x, y, s) => {
    glow(ctx, x, y - 10 * s, 20 * s, "#FFF3DE", 0.4);
    K.moon(ctx, x, y - 10 * s, 8 * s);
    const st = rrect(x - 6 * s, y - 2 * s, 12 * s, 2.4 * s, 1.2 * s);
    solid(ctx, st, T.woodHi, box(x - 6 * s, y - 2 * s, 12 * s, 2.4 * s), { rim: 0.4, lw: 0.4 });
  });
  // ---- walls
  add("clock", "Cuckoo clock", "Walls", (ctx, x, y, s, c) => {
    const b = P((q) => {
      q.moveTo(x - 8 * s, y);
      q.lineTo(x - 8 * s, y - 12 * s);
      q.lineTo(x, y - 20 * s);
      q.lineTo(x + 8 * s, y - 12 * s);
      q.lineTo(x + 8 * s, y);
      q.closePath();
    });
    solid(ctx, b, c, box(x - 8 * s, y - 20 * s, 16 * s, 20 * s), { rim: 1 });
    const f = ellipseP(x, y - 8 * s, 5 * s, 5 * s);
    solid(ctx, f, "#FFF3DE", box(x - 5 * s, y - 13 * s, 10 * s, 10 * s), { rim: 0.5, lw: 0.4, ao: 0 });
    ctx.strokeStyle = T.ink;
    ctx.lineWidth = 0.8 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y - 8 * s);
    ctx.lineTo(x, y - 11.5 * s);
    ctx.moveTo(x, y - 8 * s);
    ctx.lineTo(x + 2.5 * s, y - 7 * s);
    ctx.stroke();
  }, T.woodHi);
  add("frame", "Wick portrait", "Walls", (ctx, x, y, s) => {
    const fr = rrect(x - 9 * s, y - 22 * s, 18 * s, 22 * s, 2 * s);
    solid(ctx, fr, T.woodHi, box(x - 9 * s, y - 22 * s, 18 * s, 22 * s), { rim: 0.8 });
    ctx.fillStyle = "#3A2F63";
    ctx.fillRect(x - 6.5 * s, y - 19.5 * s, 13 * s, 17 * s);
    window.Wick2.draw(ctx, { variant: "final", x: x - 7 * s, y: y - 18 * s, size: 14 * s, expr: "happy", glow: false, shadow: false });
  });
  add("shelfWall", "Wall shelf", "Walls", (ctx, x, y, s) => {
    const sh = rrect(x - 14 * s, y - 3 * s, 28 * s, 3 * s, 1 * s);
    solid(ctx, sh, T.woodHi, box(x - 14 * s, y - 3 * s, 28 * s, 3 * s), { rim: 0.5, lw: 0.4 });
    K.pot(ctx, x - 8 * s, y - 3 * s, 0.4 * s, "flowers", "#F2C6A8");
    const cup = rrect(x - 1 * s, y - 9 * s, 6 * s, 6 * s, 1.6 * s);
    solid(ctx, cup, "#A8DCC8", box(x - 1 * s, y - 9 * s, 6 * s, 6 * s), { rim: 0.5, lw: 0.4 });
    window.Wick2.draw(ctx, { variant: "final", pal: "pip", flame: "twin", x: x + 4 * s, y: y - 13.5 * s, size: 11 * s, expr: "idle", glow: false, shadow: false });
  });
  add("curtains", "Petal curtains", "Walls", (ctx, x, y, s, c) => {
    for (const sx of [-1, 1]) {
      const cu = P((q) => {
        q.moveTo(x + sx * 16 * s, y - 40 * s);
        q.lineTo(x + sx * 6 * s, y - 40 * s);
        q.quadraticCurveTo(x + sx * 14 * s, y - 20 * s, x + sx * 10 * s, y);
        q.lineTo(x + sx * 17 * s, y);
        q.closePath();
      });
      solid(ctx, cu, c, box(x - 17 * s, y - 40 * s, 34 * s, 40 * s), { rim: 0.8, lw: 0.5 });
    }
  }, "#F6B7C4");
  add("garland", "Star garland", "Walls", (ctx, x, y, s) => {
    ctx.strokeStyle = hexA(T.cream, 0.7);
    ctx.lineWidth = 0.6 * s;
    ctx.beginPath();
    ctx.moveTo(x - 24 * s, y - 12 * s);
    ctx.quadraticCurveTo(x, y + 2 * s, x + 24 * s, y - 12 * s);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      K.sparkle(ctx, x - 24 * s + 48 * s * t, y - 12 * s + 28 * s * t * (1 - t) + 3 * s, 3 * s, [T.lemon, T.pink, T.cream, T.mint, T.lemon][i]);
    }
  });
  // ---- small things
  add("teaset", "Teapot set", "Small", (ctx, x, y, s, c) => {
    const pot = P((q) => q.ellipse(x - 3 * s, y - 5 * s, 6 * s, 5 * s, 0, 0, 6.3));
    solid(ctx, pot, c, box(x - 9 * s, y - 10 * s, 12 * s, 10 * s), { rim: 0.8 });
    ctx.strokeStyle = mix(c, T.plum, 0.3);
    ctx.lineWidth = 1.4 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 6 * s);
    ctx.quadraticCurveTo(x + 6 * s, y - 7 * s, x + 6 * s, y - 10 * s);
    ctx.stroke();
    ctx.fillStyle = mix(c, "#FFFFFF", 0.2);
    ctx.beginPath();
    ctx.ellipse(x - 3 * s, y - 10.5 * s, 2 * s, 1 * s, 0, 0, 6.3);
    ctx.fill();
    const cup = rrect(x + 5 * s, y - 4 * s, 5 * s, 4 * s, 1.4 * s);
    solid(ctx, cup, "#FFF3DE", box(x + 5 * s, y - 4 * s, 5 * s, 4 * s), { rim: 0.4, lw: 0.4 });
  }, "#A8DCC8");
  add("cushion", "Floor cushion", "Small", (ctx, x, y, s, c) => {
    contact(ctx, x, y, 12 * s, 2 * s);
    const cu = rrect(x - 11 * s, y - 7 * s, 22 * s, 7 * s, 3.5 * s);
    solid(ctx, cu, c, box(x - 11 * s, y - 7 * s, 22 * s, 7 * s), { rim: 1 });
    ctx.fillStyle = mix(c, T.plum, 0.25);
    ctx.beginPath();
    ctx.arc(x, y - 3.5 * s, 1 * s, 0, 6.3);
    ctx.fill();
  }, "#FFE59A");
  add("radio", "Little radio", "Small", (ctx, x, y, s, c) => {
    slab(ctx, x, y, 14 * s, 9 * s, 2 * s, c);
    ctx.fillStyle = hexA(T.plum, 0.3);
    ctx.beginPath();
    ctx.arc(x - 3 * s, y - 4.5 * s, 2.6 * s, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = T.amber;
    ctx.beginPath();
    ctx.arc(x + 3.6 * s, y - 4.5 * s, 1.2 * s, 0, 6.3);
    ctx.fill();
  }, "#E8706B");
  add("books", "Book stack", "Small", (ctx, x, y, s) => {
    [["#8FB3E8", 12], ["#F6A7B8", 10], ["#A8DCC8", 11]].forEach(([c, w], i) => {
      const b = rrect(x - w / 2 * s + (i % 2) * s, y - (i + 1) * 3.2 * s, w * s, 3 * s, 0.8 * s);
      solid(ctx, b, c, box(x - w / 2 * s, y - (i + 1) * 3.2 * s, w * s, 3 * s), { rim: 0.4, lw: 0.4, ao: 0 });
    });
  });
  add("catBed", "Cat basket", "Small", (ctx, x, y, s) => {
    const b = P((q) => {
      q.moveTo(x - 12 * s, y - 6 * s);
      q.quadraticCurveTo(x, y + 2 * s, x + 12 * s, y - 6 * s);
      q.closePath();
    });
    solid(ctx, b, "#C9945C", box(x - 12 * s, y - 6 * s, 24 * s, 8 * s), { rim: 0.6 });
    const cat = P((q) => {
      q.moveTo(x - 8 * s, y - 5 * s);
      q.quadraticCurveTo(x - 7 * s, y - 13 * s, x, y - 13 * s);
      q.quadraticCurveTo(x + 7 * s, y - 13 * s, x + 8 * s, y - 5 * s);
      q.closePath();
      q.moveTo(x - 5 * s, y - 11 * s);
      q.lineTo(x - 6 * s, y - 16 * s);
      q.lineTo(x - 2 * s, y - 12.6 * s);
      q.moveTo(x + 5 * s, y - 11 * s);
      q.lineTo(x + 6 * s, y - 16 * s);
      q.lineTo(x + 2 * s, y - 12.6 * s);
    });
    solid(ctx, cat, "#F6E3C8", box(x - 8 * s, y - 16 * s, 16 * s, 11 * s), { rim: 0.8, lw: 0.5 });
    ctx.strokeStyle = T.ink;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, y - 9 * s);
    ctx.quadraticCurveTo(x - 2.8 * s, y - 8 * s, x - 1.6 * s, y - 9 * s);
    ctx.moveTo(x + 1.6 * s, y - 9 * s);
    ctx.quadraticCurveTo(x + 2.8 * s, y - 8 * s, x + 4 * s, y - 9 * s);
    ctx.stroke();
  });
  add("yarn", "Yarn basket", "Small", (ctx, x, y, s) => {
    for (const [dx, c] of [[-3, T.pink], [3, T.mint], [0, T.lemon]]) {
      const b = ellipseP(x + dx * s, y - 7 * s - (dx === 0 ? 3 : 0) * s, 4 * s, 4 * s);
      solid(ctx, b, c, box(x + (dx - 4) * s, y - 14 * s, 8 * s, 8 * s), { rim: 0.6, lw: 0.4 });
    }
    slab(ctx, x, y, 16 * s, 6 * s, 1.5 * s, "#C9945C");
  });
  // ---- seasonal
  add("pumpkin", "Pumpkin lantern", "Seasonal", (ctx, x, y, s) => {
    glow(ctx, x, y - 6 * s, 16 * s, T.amber, 0.45);
    const p = P((q) => {
      for (const dx of [-5, 0, 5]) {
        q.moveTo(x + (dx + 6) * s, y - 6 * s);
        q.ellipse(x + dx * s, y - 6 * s, 6 * s, 6 * s, 0, 0, 6.3);
      }
    });
    solid(ctx, p, "#F49A4C", box(x - 11 * s, y - 12 * s, 22 * s, 12 * s), { rim: 1 });
    ctx.fillStyle = "#FFE59A";
    for (const dx of [-3.4, 3.4]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * s, y - 9 * s);
      ctx.lineTo(x + (dx - 1.5) * s, y - 6.5 * s);
      ctx.lineTo(x + (dx + 1.5) * s, y - 6.5 * s);
      ctx.fill();
    }
    ctx.fillStyle = "#6FA287";
    ctx.fillRect(x - 0.8 * s, y - 15 * s, 1.6 * s, 4 * s);
  });
  add("snowGlobe", "Snow globe", "Seasonal", (ctx, x, y, s) => {
    const g = ellipseP(x, y - 10 * s, 8 * s, 8 * s);
    ctx.fillStyle = hexA("#CDE6FF", 0.5);
    ctx.fill(g);
    window.Wick2.draw(ctx, { variant: "final", pal: "yuki", flame: "spark", x: x - 6 * s, y: y - 18 * s, size: 12 * s, expr: "happy", glow: false, shadow: false });
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = hexA("#FFFFFF", 0.7);
    ctx.stroke(g);
    slab(ctx, x, y, 14 * s, 3 * s, 1.5 * s, T.woodHi);
  });
  add("mooncake", "Mooncake plate", "Seasonal", (ctx, x, y, s) => {
    const pl = ellipseP(x, y - 2 * s, 11 * s, 2.6 * s);
    solid(ctx, pl, "#FFF3DE", box(x - 11 * s, y - 5 * s, 22 * s, 6 * s), { rim: 0.4, lw: 0.4 });
    for (const dx of [-4, 4, 0]) {
      const c = rrect(x + (dx - 3.4) * s, y - (dx === 0 ? 9 : 6.5) * s, 6.8 * s, 4.4 * s, 2 * s);
      solid(ctx, c, "#E3A15A", box(x + (dx - 3.4) * s, y - 9 * s, 6.8 * s, 4.4 * s), { rim: 0.5, lw: 0.4 });
    }
  });
  add("blossom", "Blossom branch", "Seasonal", (ctx, x, y, s) => {
    ctx.strokeStyle = T.woodLo;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 10 * s);
    ctx.quadraticCurveTo(x - 6 * s, y - 22 * s, x - 3 * s, y - 30 * s);
    ctx.moveTo(x - 3 * s, y - 20 * s);
    ctx.quadraticCurveTo(x + 6 * s, y - 24 * s, x + 7 * s, y - 28 * s);
    ctx.stroke();
    for (const [dx, dy] of [[-3, -30], [7, -28], [-5, -22], [3, -23], [-1, -26]]) flower(ctx, x + dx * s, y + dy * s, 2.2 * s, "#FFD0DC");
    const v = rrect(x - 4 * s, y - 11 * s, 8 * s, 11 * s, 3 * s);
    solid(ctx, v, "#8FB3E8", box(x - 4 * s, y - 11 * s, 8 * s, 11 * s), { rim: 0.6, lw: 0.4 });
  });
  add("wreath", "Holly wreath", "Seasonal", (ctx, x, y, s) => {
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = "#4F7F68";
    ctx.beginPath();
    ctx.arc(x, y - 10 * s, 8 * s, 0, 6.3);
    ctx.stroke();
    ctx.lineWidth = 1.2 * s;
    ctx.strokeStyle = hexA(T.leafHi, 0.7);
    ctx.beginPath();
    ctx.arc(x - 0.6 * s, y - 10.6 * s, 8 * s, 3.4, 5.2);
    ctx.stroke();
    ctx.fillStyle = "#E8706B";
    for (const a of [0.4, 1.2, 2.6, 4.2]) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 8 * s, y - 10 * s + Math.sin(a) * 8 * s, 1.4 * s, 0, 6.3);
      ctx.fill();
    }
  });
  add("lanternRed", "Festival lantern", "Seasonal", (ctx, x, y, s) => {
    glow(ctx, x, y - 12 * s, 22 * s, "#FF8A6A", 0.4);
    const b = P((q) => q.ellipse(x, y - 12 * s, 9 * s, 8 * s, 0, 0, 6.3));
    const g = ctx.createRadialGradient(x - 2 * s, y - 14 * s, 1, x, y - 12 * s, 10 * s);
    g.addColorStop(0, "#FFD0B8");
    g.addColorStop(1, "#E8584B");
    ctx.fillStyle = g;
    ctx.fill(b);
    ctx.fillStyle = "#E3A15A";
    ctx.fillRect(x - 4 * s, y - 21 * s, 8 * s, 2 * s);
    ctx.fillRect(x - 4 * s, y - 5 * s, 8 * s, 2 * s);
    ctx.strokeStyle = "#E3A15A";
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 3 * s);
    ctx.lineTo(x, y + 2 * s);
    ctx.stroke();
  });

  window.Decor = { ITEMS, byId: Object.fromEntries(ITEMS.map((i) => [i.id, i])) };
})();
