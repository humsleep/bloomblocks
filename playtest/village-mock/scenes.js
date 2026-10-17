// The four village mockups + the pilot furniture sheet (r2-village-art.md).
(function () {
  const K = window.Kit;
  const { T } = K;
  const W2 = window.Wick2;
  const wick = (ctx, gx, gy, size, o = {}) => W2.draw(ctx, { variant: "final", ...o, x: gx - size / 2, y: gy - size * 0.92, size });
  const FR = {
    wick: { pal: "wick", flame: "drop" },
    momo: { pal: "momo", flame: "petal" },
    sage: { pal: "sage", flame: "leaf", sx: 1.04, sy: 0.97 },
    luna: { pal: "luna", flame: "moon", sx: 0.95, sy: 1.06 },
    pip: { pal: "pip", flame: "twin", bodyScale: 0.84 },
    kuri: { pal: "kuri", flame: "drop", acc: "scarf", sx: 1.06, sy: 0.96 },
  };
  const img = (src) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

  // ================================================================ (e) pilot furniture
  const pilot = {
    w: 1600,
    h: 1250,
    crops: [["row-cream", 48, 170, 1504, 236], ["room-strip", 48, 920, 860, 250]],
    async draw(ctx, w, h) {
      // a room wall + floor behind the sheet: the items are judged in their real light
      const wall = ctx.createLinearGradient(0, 0, 0, h);
      wall.addColorStop(0, "#5A4670");
      wall.addColorStop(1, "#3A2F55");
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, w, h);
      K.text(ctx, "Pilot furniture — 6 items × 3 colourways (cream · sage · rose)", 48, 62, 32, 600, T.cream);
      K.text(ctx, "one light (upper-left warm key, cool fill, plum shadow) · shared solid() recipe · baked contact shadow + AO · outlines one step darker, never black", 48, 94, 16, 500, "#CBBFE0");
      const P = window.Pilot;
      const cws = ["cream", "sage", "rose"];
      const colW = (w - 96) / 6;
      P.ORDER.forEach((id, i) => {
        const it = P.ITEMS[id];
        const cx = 48 + colW * (i + 0.5);
        K.text(ctx, it.name, cx, 140, 20, 600, T.cream, "center");
        K.text(ctx, it.ko, cx, 162, 15, 500, "#CBBFE0", "center");
        cws.forEach((cw, j) => {
          const y0 = 180 + j * 230;
          // cell: a slice of room (wallpaper, wainscot, floor) lit by a warm pool
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cx - colW / 2 + 8, y0, colW - 16, 216, 18);
          ctx.clip();
          roomSlice(ctx, cx - colW / 2 + 8, y0, colW - 16, 216, cw);
          const s = id === "smallBed" ? 3.1 : id === "bookshelf" ? 3.2 : id === "smallPot" ? 5.2 : 3.6;
          it.draw(ctx, cx, y0 + 196, s, cw);
          ctx.restore();
          K.text(ctx, cw, cx - colW / 2 + 22, y0 + 26, 13, 600, K.hexA(T.cream, 0.8));
        });
      });
      // room scale: a 430 pt-wide slice of the real room, shown 2× (1 unit = 1.25 pt on the phone)
      const ys = 1150, sx0 = 48, sw = 860, k = 2;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(sx0, ys - 230, sw, 250, 18);
      ctx.clip();
      roomSlice(ctx, sx0, ys - 230, sw, 250, "cream");
      const sc = 1.25 * k;
      [["bookshelf", "sage", 110], ["paperLantern", "cream", 230], ["roundChair", "rose", 330], ["teaTable", "cream", 440], ["smallBed", "rose", 680], ["smallPot", "sage", 810]].forEach(([id, cw, x]) => P.ITEMS[id].draw(ctx, sx0 + x, ys + 6, sc, cw));
      wick(ctx, sx0 + 545, ys + 8, 34 * k, { expr: "happy" });
      wick(ctx, sx0 + 330, ys + 6 - 18.6 * sc, 22 * k, { ...FR.momo, expr: "shy", shadow: false });
      ctx.restore();
      K.text(ctx, "Room scale, shown 2×", 940, ys - 190, 22, 600, T.cream);
      ["On the phone a slot is ≈ 50 pt wide (1 unit = 1.25 pt).", "Same light, same AO and outline weight as the residents:", "whatever the player places, the room still reads as one painting.", "Colourway = 3 tokens (base · hi · lo) → 6 items × 3 = 18 collectibles."].forEach((l, i) => K.text(ctx, l, 940, ys - 150 + i * 28, 17, 500, "#CBBFE0"));
      K.grain(ctx, w, h, 0.05);
    },
  };
  function roomSlice(ctx, x, y, w, h, cw) {
    const wp = { cream: "#F4E2C6", sage: "#DCEBDF", rose: "#F6DCE0" }[cw];
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, K.mix(wp, "#4A3B6A", 0.32));
    g.addColorStop(0.62, K.mix(wp, "#4A3B6A", 0.12));
    g.addColorStop(0.62, "#8A6046");
    g.addColorStop(1, "#5E3F30");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // wallpaper dots
    ctx.fillStyle = K.hexA("#FFFFFF", 0.12);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) {
      ctx.beginPath();
      ctx.arc(x + 12 + i * 22 + (j % 2) * 11, y + 14 + j * 22, 2, 0, 6.3);
      ctx.fill();
    }
    // wainscot rail
    ctx.fillStyle = "#B88A66";
    ctx.fillRect(x, y + h * 0.6, w, 5);
    ctx.fillStyle = K.hexA(T.plum, 0.25);
    ctx.fillRect(x, y + h * 0.6 + 5, w, 4);
    // floor boards
    ctx.strokeStyle = K.hexA(T.plum, 0.22);
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      const yy = y + h * 0.62 + (h * 0.38 * k) / 4;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    }
    // the room's warm pool (resident lantern, upper left) + vignette
    K.glow(ctx, x + w * 0.3, y + h * 0.45, w * 0.8, "#FFD9A0", 0.22);
    const v = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w);
    v.addColorStop(0, K.hexA(T.plum, 0));
    v.addColorStop(1, K.hexA(T.plum, 0.45));
    ctx.fillStyle = v;
    ctx.fillRect(x, y, w, h);
  }


  // ================================================================ (a) village overview
  const HOUSE = {
    wick: { paper: "#FFE9C2", paperLo: "#F0C489", roof: "#E7A75A", door: "#8A5A3E", flower: T.lilac },
    momo: { paper: "#FFE6E4", paperLo: "#F2B7BE", roof: "#E58C9E", door: "#9A5B5E", flower: T.pink },
    sage: { paper: "#ECF6E8", paperLo: "#BCDDC6", roof: "#6FAE8C", door: "#6E5A44", flower: T.lemon },
    luna: { paper: "#F1EBFF", paperLo: "#CBBDF0", roof: "#8E7BCF", door: "#5E4E80", flower: T.lilac },
  };
  const flagOf = (fr) => (ctx, x, y, sz) => wick(ctx, x, y + sz * 0.42, sz, { ...FR[fr], expr: "happy", glow: false, shadow: false });
  function stall(ctx, x, y, s) {
    K.contact(ctx, x, y + 1, 46 * s, 8 * s, 0.4);
    // posts
    for (const dx of [-34, 30]) {
      const p = K.rrect(x + dx * s, y - 58 * s, 4 * s, 58 * s, 2 * s);
      K.solid(ctx, p, T.wood, { x: x + dx * s, y: y - 58 * s, w: 4 * s, h: 58 * s }, { rim: 0.6, lw: 0.5 });
    }
    // counter
    const c = K.rrect(x - 40 * s, y - 24 * s, 80 * s, 24 * s, 4 * s);
    K.solid(ctx, c, T.woodHi, { x: x - 40 * s, y: y - 24 * s, w: 80 * s, h: 24 * s }, { rim: 1.2 });
    ctx.save();
    ctx.clip(c);
    ctx.strokeStyle = K.hexA(T.plum, 0.25);
    ctx.lineWidth = 1;
    for (const dx of [-20, 0, 20]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * s, y - 24 * s);
      ctx.lineTo(x + dx * s, y);
      ctx.stroke();
    }
    ctx.restore();
    // three things to pick (one per day)
    const P = window.Pilot.ITEMS;
    P.smallPot.draw(ctx, x - 24 * s, y - 24 * s, 0.75 * s, "rose");
    P.paperLantern.draw(ctx, x, y - 24 * s, 0.62 * s, "sage");
    window.Decor.byId.teaset.draw(ctx, x + 24 * s, y - 24 * s, 0.9 * s, "#A8DCC8");
    // striped awning with a scalloped edge
    const aw = K.P((q) => {
      q.moveTo(x - 46 * s, y - 56 * s);
      q.lineTo(x - 38 * s, y - 72 * s);
      q.lineTo(x + 38 * s, y - 72 * s);
      q.lineTo(x + 46 * s, y - 56 * s);
      for (let i = 0; i < 8; i++) q.quadraticCurveTo(x + (40.25 - i * 11.5) * s, y - 48 * s, x + (34.5 - i * 11.5) * s, y - 56 * s);
      q.closePath();
    });
    K.solid(ctx, aw, "#FFF1D6", { x: x - 46 * s, y: y - 72 * s, w: 92 * s, h: 24 * s }, { rim: 1.2 });
    ctx.save();
    ctx.clip(aw);
    ctx.fillStyle = K.hexA(T.coral, 0.85);
    for (let i = 0; i < 8; i += 2) {
      ctx.beginPath();
      ctx.moveTo(x + (-46 + i * 11.5) * s, y - 48 * s);
      ctx.lineTo(x + (-38 + i * 9.5) * s, y - 72 * s);
      ctx.lineTo(x + (-38 + (i + 1) * 9.5) * s, y - 72 * s);
      ctx.lineTo(x + (-46 + (i + 1) * 11.5) * s, y - 48 * s);
      ctx.fill();
    }
    ctx.restore();
    // hanging sign: the market bell
    K.glow(ctx, x, y - 79 * s, 14 * s, T.glow, 0.4);
    const bell = K.P((q) => {
      q.moveTo(x - 5 * s, y - 74 * s);
      q.quadraticCurveTo(x - 5 * s, y - 84 * s, x, y - 84 * s);
      q.quadraticCurveTo(x + 5 * s, y - 84 * s, x + 5 * s, y - 74 * s);
      q.closePath();
    });
    K.solid(ctx, bell, T.amber, { x: x - 5 * s, y: y - 84 * s, w: 10 * s, h: 10 * s }, { rim: 0.8, lw: 0.5 });
  }
  function bench(ctx, x, y, s) {
    K.contact(ctx, x, y + 1, 20 * s, 3 * s);
    for (const dx of [-15, 12]) {
      const l = K.rrect(x + dx * s, y - 8 * s, 3 * s, 8 * s, 1 * s);
      K.solid(ctx, l, T.woodLo, { x: x + dx * s, y: y - 8 * s, w: 3 * s, h: 8 * s }, { rim: 0.4, lw: 0.4 });
    }
    const seat = K.rrect(x - 18 * s, y - 11 * s, 36 * s, 4 * s, 2 * s);
    K.solid(ctx, seat, T.woodHi, { x: x - 18 * s, y: y - 11 * s, w: 36 * s, h: 4 * s }, { rim: 0.8, lw: 0.5 });
    const back = K.rrect(x - 18 * s, y - 20 * s, 36 * s, 4 * s, 2 * s);
    K.solid(ctx, back, T.woodHi, { x: x - 18 * s, y: y - 20 * s, w: 36 * s, h: 4 * s }, { rim: 0.8, lw: 0.5 });
  }
  function signPlaque(ctx, cx, cy, w, h, label) {
    // hanging wooden sign (the screen's title): two ropes, chunky lip, carved letters
    ctx.strokeStyle = K.hexA(T.cream, 0.5);
    ctx.lineWidth = 1.4;
    for (const dx of [-w * 0.32, w * 0.32]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy - h / 2 - 18);
      ctx.lineTo(cx + dx, cy - h / 2 + 2);
      ctx.stroke();
    }
    K.contact(ctx, cx, cy + h / 2 + 8, w * 0.45, 5, 0.35);
    ctx.fillStyle = T.woodLo;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2 + 4, w, h, 12);
    ctx.fill();
    const face = K.rrect(cx - w / 2, cy - h / 2, w, h, 12);
    K.solid(ctx, face, T.woodHi, { x: cx - w / 2, y: cy - h / 2, w, h }, { rim: 1.6, lit: 0.3 });
    ctx.save();
    ctx.clip(face);
    ctx.strokeStyle = K.hexA(T.plum, 0.12);
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, cy - h / 2 + 8 + i * 9);
      ctx.bezierCurveTo(cx - w * 0.2, cy - h / 2 + 5 + i * 9, cx + w * 0.2, cy - h / 2 + 11 + i * 9, cx + w / 2, cy - h / 2 + 7 + i * 9);
      ctx.stroke();
    }
    ctx.restore();
    K.text(ctx, label, cx, cy + 7.5 + 1.2, 21, 600, K.hexA(T.plum, 0.45), "center");
    K.text(ctx, label, cx, cy + 7.5, 21, 600, T.cream, "center");
    for (const dx of [-w / 2 + 12, w / 2 - 12]) {
      ctx.fillStyle = T.woodLo;
      ctx.beginPath();
      ctx.arc(cx + dx, cy - h / 2 + 9, 2.2, 0, 6.3);
      ctx.fill();
    }
  }
  function dialogueCard(ctx, x, y, w, h, name, col, lines, face) {
    K.panel(ctx, x, y, w, h, 20, { stitch: true });
    // speaker portrait in a round frame (left), name tag on the frame
    const px = x + 46, py = y + h / 2;
    ctx.fillStyle = "#3A2F63";
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, 6.3);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, 6.3);
    ctx.clip();
    K.glow(ctx, px, py + 6, 40, T.glow, 0.45);
    face(ctx, px, py + 26, 58);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, 6.3);
    ctx.stroke();
    ctx.font = `600 13px ${K.FONT}`;
    const nw = ctx.measureText(name).width + 18;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(px - nw / 2, py + 22, nw, 20, 10);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#FFF7E8";
    ctx.stroke();
    K.text(ctx, name, px, py + 36, 13, 600, T.ink, "center");
    lines.forEach((l, i) => K.text(ctx, l, x + 92, y + 34 + i * 23, 16.5, 500, T.ink));
    // "more" nub
    ctx.fillStyle = T.amberLip;
    ctx.beginPath();
    ctx.moveTo(x + w - 26, y + h - 22);
    ctx.lineTo(x + w - 16, y + h - 22);
    ctx.lineTo(x + w - 21, y + h - 15);
    ctx.closePath();
    ctx.fill();
  }

  function meadow(ctx, w, y0, h) {
    // a dusk-green lawn: value patches, mowed stripes of light, clumps of flowers ("lived in")
    const base = ctx.createLinearGradient(0, y0, 0, y0 + h);
    base.addColorStop(0, "rgba(63,75,120,0)");
    base.addColorStop(0.07, "#3F4B78");
    base.addColorStop(1, "#2C3260");
    ctx.fillStyle = base;
    ctx.fillRect(0, y0 - 6, w, h + 220);
    K.reseed(21);
    for (let i = 0; i < 30; i++) {
      const x = K.rnd() * w, y = y0 + 20 + K.rnd() * h, r = 24 + K.rnd() * 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, K.hexA(K.rnd() < 0.55 ? "#56659A" : "#2B305C", 0.5));
      g.addColorStop(1, K.hexA("#2B305C", 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.34, 0, 0, 6.3);
      ctx.fill();
    }
    for (let i = 0; i < 190; i++) {
      const y = y0 + 16 + K.rnd() * h, k = 0.55 + ((y - y0) / h) * 0.6, x = K.rnd() * w;
      K.grassTufts(ctx, x - 5, x + 5, y, 2, K.hexA(K.rnd() < 0.5 ? "#6F80B4" : "#5E8F86", 0.75), k);
    }
    for (let i = 0; i < 46; i++) {
      const y = y0 + 20 + K.rnd() * h, k = 0.6 + ((y - y0) / h) * 0.7, x = K.rnd() * w;
      const col = [T.pink, T.lemon, "#FFFFFF", T.lilac][i % 4];
      for (let j = 0; j < 4; j++) K.flower(ctx, x + (K.rnd() - 0.5) * 12 * k, y + (K.rnd() - 0.5) * 4 * k, 1.9 * k, col);
    }
  }
  function flowerBed(ctx, x0, x1, y, k) {
    K.reseed(Math.round(x0 * 7 + y));
    for (let x = x0; x < x1; x += 7 * k) {
      K.grassTufts(ctx, x - 3, x + 3, y + K.rnd() * 3, 1, "#5E8F6E", k);
      K.flower(ctx, x + K.rnd() * 3, y - 4 * k - K.rnd() * 4 * k, 2.1 * k, [T.pink, T.lemon, "#FFFFFF", T.lilac, T.coral][Math.floor(K.rnd() * 5)]);
    }
  }
  function picnic(ctx, x, y, s) {
    const bl = K.P((q) => {
      q.moveTo(x - 34 * s, y);
      q.lineTo(x - 22 * s, y - 14 * s);
      q.lineTo(x + 30 * s, y - 14 * s);
      q.lineTo(x + 38 * s, y);
      q.closePath();
    });
    K.solid(ctx, bl, "#F2C6A8", { x: x - 34 * s, y: y - 14 * s, w: 72 * s, h: 14 * s }, { rim: 0.8, lit: 0.25, lw: 0.6 });
    ctx.save();
    ctx.clip(bl);
    ctx.fillStyle = K.hexA(T.coral, 0.55);
    for (let i = -4; i < 5; i += 2) {
      ctx.beginPath();
      ctx.moveTo(x + i * 8 * s, y);
      ctx.lineTo(x + (i * 8 + 3) * s, y - 14 * s);
      ctx.lineTo(x + (i * 8 + 8) * s, y - 14 * s);
      ctx.lineTo(x + (i * 8 + 5) * s, y);
      ctx.fill();
    }
    ctx.restore();
    window.Decor.byId.teaset.draw(ctx, x - 6 * s, y - 5 * s, 0.75 * s, "#A8DCC8");
    window.Decor.byId.mooncake.draw(ctx, x + 16 * s, y - 4 * s, 0.7 * s);
  }
  function stringLights(ctx, x0, y0, x1, y1, sag, n) {
    ctx.strokeStyle = K.hexA("#1A1636", 0.85);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
    ctx.stroke();
    const cols = [T.amber, T.pink, T.mint, T.lemon, T.lilac];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (Math.max(y0, y1) + sag) + t * t * y1;
      const c = cols[i % cols.length];
      K.glow(ctx, x, y + 5, 14, c, 0.55);
      ctx.fillStyle = "#1A1636";
      ctx.fillRect(x - 1, y - 1, 2, 3);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(x - 3.4, y + 1.5, 6.8, 8, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(x - 1.2, y + 4, 1.2, 0, 6.3);
      ctx.fill();
    }
  }
  function pool(ctx, x, y, r, a = 0.3) {
    K.glow(ctx, x, y, r * 1.35, "#FFC98A", a * 1.25, 0.34);
  }

  const village = {
    w: 430,
    h: 932,
    crops: [["houses", 20, 330, 390, 330], ["card", 0, 760, 430, 172]],
    async draw(ctx, w, h) {
      const horizon = 282;
      K.sky(ctx, w, h, horizon);
      K.moon(ctx, 96, 176, 19);
      K.cloud(ctx, 300, 206, 0.8, 0.5);
      K.cloud(ctx, 168, 236, 0.55, 0.35);
      K.sparkle(ctx, 236, 150, 4.5, T.cream, 0.9);
      K.sparkle(ctx, 352, 132, 3.5, T.lemon, 0.8);
      // far hills + the rest of the town's lights
      K.hill(ctx, w, 262, 9, 0.8, T.hillFar, 140, 0.35);
      K.reseed(3);
      for (let i = 0; i < 9; i++) {
        const x = 18 + i * 49 + K.rnd() * 14, y = 262 + K.rnd() * 12;
        ctx.fillStyle = K.hexA(T.hillMid, 0.95);
        ctx.beginPath();
        ctx.roundRect(x - 5, y - 9, 10, 10, 3);
        ctx.fill();
        K.glow(ctx, x, y - 4, 7, T.glow, 0.5);
        ctx.fillStyle = "#FFE3A0";
        ctx.fillRect(x - 1.4, y - 6, 2.8, 2.8);
      }
      K.hill(ctx, w, 300, 10, 2.1, T.hillMid, 120, 0.3);
      K.tree(ctx, 22, 340, 0.7, 0.2);
      K.tree(ctx, 410, 332, 0.78, 0.15);
      K.tree(ctx, 372, 344, 0.5, 0.3);
      K.tree(ctx, 60, 350, 0.5, 0.3);
      // the near meadow (the village sits on it)
      K.hill(ctx, w, 346, 7, 4.4, T.hillNear, 600, 0.34);
      const mg = ctx.createRadialGradient(215, 560, 20, 215, 560, 360);
      mg.addColorStop(0, K.hexA("#7C6AA8", 0.4));
      mg.addColorStop(1, K.hexA("#7C6AA8", 0));
      ctx.fillStyle = mg;
      ctx.fillRect(0, 340, w, 600);
      meadow(ctx, w, 350, 440);
      // string lights across the lane (they carry the warm palette across the screen)
      stringLights(ctx, -6, 318, 436, 310, 26, 13);
      // path (perspective scale k)
      K.path(ctx, [[214, 950, 1.2], [204, 860, 1.08], [196, 760, 0.94], [208, 660, 0.8], [226, 560, 0.66], [220, 460, 0.52], [212, 360, 0.4]], 40, 1);
      flowerBed(ctx, 150, 186, 690, 1);
      flowerBed(ctx, 236, 262, 676, 0.95);
      flowerBed(ctx, 176, 196, 520, 0.7);
      flowerBed(ctx, 248, 268, 512, 0.7);
      // warm light falling from the string lights
      for (let i = 0; i < 6; i++) K.glow(ctx, 30 + i * 74, 372, 60, "#FFC98A", 0.12, 0.3);
      // back row: Sage (left), Luna (right)
      pool(ctx, 112, 432, 70);
      pool(ctx, 322, 424, 66);
      K.lanternHouse(ctx, 108, 432, 0.64, HOUSE.sage);
      K.lanternHouse(ctx, 322, 424, 0.6, HOUSE.luna);
      K.pot(ctx, 150, 434, 0.6, "flowers", "#8FB3E8");
      K.bush(ctx, 52, 438, 0.6, T.leaf, [T.lemon, "#FFFFFF"]);
      bench(ctx, 384, 444, 0.62);
      wick(ctx, 383, 437, 30, { ...FR.luna, expr: "curious", look: [1, -1.2] });
      wick(ctx, 168, 446, 30, { ...FR.sage, expr: "sleepy" });
      K.fence(ctx, 250, 290, 444, 0.62);
      K.tree(ctx, 196, 392, 0.42, 0.1);
      K.bush(ctx, 286, 452, 0.5, K.mix(T.leaf, T.lilac, 0.2), [T.lilac, "#FFFFFF"]);
      // a picnic blanket between the rows (two cups: someone was just here)
      // (picnic drawn in the front row)
      K.tree(ctx, 20, 540, 0.6, 0.05);
      // middle row: the lantern-keeper's house (Wick) left, Momo right
      pool(ctx, 96, 610, 110, 0.36);
      pool(ctx, 330, 598, 104, 0.36);
      K.lampPost(ctx, 170, 584, 0.86);
      K.lanternHouse(ctx, 92, 612, 0.98, HOUSE.wick);
      K.lanternHouse(ctx, 330, 600, 0.94, { ...HOUSE.momo, windows: [-24] });
      K.mailbox(ctx, 176, 624, 1.05, true, T.coral);
      K.glow(ctx, 186, 584, 22, T.amber, 0.4);
      K.sparkle(ctx, 196, 574, 4.4, T.lemon);
      K.sparkle(ctx, 166, 586, 2.8, T.cream);
      K.pot(ctx, 270, 606, 0.85, "leafy", "#E9A5B4");
      K.bush(ctx, 404, 612, 0.82, K.mix(T.leaf, T.pink, 0.15), [T.pink, "#FFFFFF", T.lemon]);
      K.bush(ctx, 18, 618, 0.85, T.leaf, [T.lilac, T.lemon]);
      wick(ctx, 280, 628, 44, { ...FR.momo, expr: "shy" });
      // front row: market stall (left), pond (right)
      picnic(ctx, 352, 682, 0.95);
      K.pond(ctx, 342, 740, 66, 22);
      wick(ctx, 292, 750, 32, { ...FR.pip, expr: "cheer", arms: "up", sparkleEyes: true });
      K.sparkle(ctx, 276, 706, 4, T.lemon);
      pool(ctx, 84, 760, 80, 0.3);
      stall(ctx, 84, 764, 0.95);
      K.bush(ctx, 160, 772, 0.72, T.leaf, [T.coral, T.lemon]);
      K.fence(ctx, 0, 34, 776, 0.9);
      // the speaker: Wick on the path, waving
      wick(ctx, 206, 712, 70, { expr: "happy", arms: "wave" });
      K.fireflies(ctx, [[40, 500, 1.4], [150, 480, 1.2], [262, 470, 1.3], [400, 500, 1.4], [380, 676, 1.2], [140, 676, 1.1], [246, 780, 1.3], [24, 720, 1.2], [300, 384, 1.1]]);
      K.vignette(ctx, w, h, 0.36);
      K.grain(ctx, w, h, 0.06);
      // HUD: one grammar (disc + caption below), a hanging title sign
      K.disc(ctx, 40, 96, 48, K.ICON.back, "Puzzle");
      signPlaque(ctx, 215, 98, 176, 46, "Lantern Lane");
      K.disc(ctx, 390, 96, 48, K.ICON.letter, "Letters", { badge: 1 });
      jarChip(ctx, 215, 150);
      dialogueCard(ctx, 16, 806, 398, 92, "Wick", "#FFE6B8", ["Momo moved in next door!", "She left petal cookies by your mailbox."], (c, x, y, sz) => wick(c, x, y, sz, { expr: "happy", shadow: false, glow: false }));
    },
  };
  function jarChip(ctx, x, y) {
    // the lantern-drop jar under the title: a meter (4 of 6 drops → next gift), never money
    ctx.fillStyle = T.glass;
    ctx.beginPath();
    ctx.roundRect(x - 54, y - 14, 108, 28, 14);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = T.glassLine;
    ctx.stroke();
    jar(ctx, x - 36, y - 1, 0.66, 0.42);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i < 4 ? T.amber : K.hexA(T.cream, 0.25);
      ctx.beginPath();
      ctx.arc(x - 14 + i * 11, y, 3.6, 0, 6.3);
      ctx.fill();
      if (i < 4) K.glow(ctx, x - 14 + i * 11, y, 7, T.glow, 0.35);
    }
  }
  function jar(ctx, x, y, fill, k = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.translate(-x, -y);
    K.contact(ctx, x, y + 22, 16, 4, 0.35);
    const body = K.P((q) => {
      q.moveTo(x - 12, y - 10);
      q.quadraticCurveTo(x - 17, y + 6, x - 13, y + 18);
      q.quadraticCurveTo(x, y + 24, x + 13, y + 18);
      q.quadraticCurveTo(x + 17, y + 6, x + 12, y - 10);
      q.closePath();
    });
    ctx.fillStyle = K.hexA("#DDEBFF", 0.18);
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    const top = y + 21 - 32 * fill;
    K.glow(ctx, x, y + 10, 26, T.glow, 0.5);
    for (let i = 0; i < 9; i++) {
      const dx = ((i * 37) % 22) - 11, dy = top + 4 + ((i * 53) % 24);
      ctx.fillStyle = i % 3 ? "#FFE3A0" : "#FFF6D6";
      ctx.beginPath();
      ctx.ellipse(x + dx, dy, 3.4, 4, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = K.hexA("#FFFFFF", 0.65);
    ctx.stroke(body);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 2);
    ctx.quadraticCurveTo(x - 11, y + 6, x - 9, y + 13);
    ctx.stroke();
    const lid = K.rrect(x - 13, y - 16, 26, 7, 3);
    K.solid(ctx, lid, T.woodHi, { x: x - 13, y: y - 16, w: 26, h: 7 }, { rim: 0.8, lw: 0.5 });
    ctx.restore();
  }


  // ================================================================ (b) the cottage room, decorating
  function wallpaper(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#E9D3C9");
    g.addColorStop(1, "#F6E6D4");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // petal motif
    for (let j = 0; j < 9; j++) for (let i = 0; i < 10; i++) {
      const px = x + 14 + i * 34 + (j % 2) * 17, py = y + 16 + j * 28;
      ctx.save();
      ctx.globalAlpha = 0.22;
      K.flower(ctx, px, py, 3.2, j % 2 ? "#E8A0AE" : "#C9B6F0");
      ctx.restore();
    }
    // wainscot
    const wy = y + h - 64;
    const wg = ctx.createLinearGradient(0, wy, 0, y + h);
    wg.addColorStop(0, "#C99A72");
    wg.addColorStop(1, "#A97852");
    ctx.fillStyle = wg;
    ctx.fillRect(x, wy, w, 64);
    ctx.strokeStyle = K.hexA(T.plum, 0.2);
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * i) / 8, wy + 6);
      ctx.lineTo(x + (w * i) / 8, y + h);
      ctx.stroke();
    }
    ctx.fillStyle = "#E3B98E";
    ctx.fillRect(x, wy - 4, w, 5);
    ctx.fillStyle = K.hexA(T.plum, 0.18);
    ctx.fillRect(x, wy + 1, w, 3);
  }
  function roomWindow(ctx, cx, cy, r) {
    const glass = K.P((q) => q.arc(cx, cy, r, 0, 6.3));
    ctx.save();
    ctx.clip(glass);
    const sk = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    sk.addColorStop(0, T.skyMid);
    sk.addColorStop(0.7, T.skyMauve);
    sk.addColorStop(1, T.skyRose);
    ctx.fillStyle = sk;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    K.moon(ctx, cx + r * 0.36, cy - r * 0.36, r * 0.16);
    K.reseed(4);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = K.hexA(T.cream, 0.4 + K.rnd() * 0.5);
      ctx.beginPath();
      ctx.arc(cx - r + K.rnd() * r * 2, cy - r + K.rnd() * r, 0.8, 0, 6.3);
      ctx.fill();
    }
    K.hill(ctx, cx * 2, cy + r * 0.45, 4, 1, T.hillMid, r);
    K.lanternHouse(ctx, cx - r * 0.35, cy + r * 0.62, 0.16, HOUSE.momo);
    K.lanternHouse(ctx, cx + r * 0.4, cy + r * 0.66, 0.13, HOUSE.sage);
    ctx.restore();
    ctx.lineWidth = 7;
    ctx.strokeStyle = T.woodHi;
    ctx.stroke(glass);
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = K.hexA(T.key, 0.6);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2.2, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    const sill = K.rrect(cx - r - 8, cy + r - 2, (r + 8) * 2, 7, 3);
    K.solid(ctx, sill, T.woodHi, { x: cx - r - 8, y: cy + r - 2, w: (r + 8) * 2, h: 7 }, { rim: 0.8, lw: 0.5 });
  }
  function slotMark(ctx, x, y, w, sel) {
    ctx.save();
    ctx.setLineDash(sel ? [] : [4, 4]);
    ctx.lineWidth = sel ? 2.6 : 1.5;
    ctx.strokeStyle = sel ? T.amber : K.hexA(T.cream, 0.55);
    ctx.fillStyle = sel ? K.hexA(T.amber, 0.18) : K.hexA(T.cream, 0.08);
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, w * 0.17, 0, 0, 6.3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (sel) {
      K.glow(ctx, x, y, w * 0.6, T.amber, 0.25, 0.4);
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.arc(x, y - w * 0.36, 11, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = T.ink;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 5, y - w * 0.36);
      ctx.lineTo(x + 5, y - w * 0.36);
      ctx.moveTo(x, y - w * 0.36 - 5);
      ctx.lineTo(x, y - w * 0.36 + 5);
      ctx.stroke();
    }
  }
  function emote(ctx, x, y, icon, col) {
    ctx.save();
    ctx.shadowColor = K.hexA(T.plum, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#FFF8EC";
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 9, y + 13, 3, 0, 6.3);
    ctx.fill();
    ctx.restore();
    K.ICON[icon](ctx, x, y + 1, 20, col);
  }
  function card(ctx, x, y, w, h, o) {
    ctx.save();
    ctx.shadowColor = K.hexA(T.plum, 0.25);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = o.sel ? "#FFF1D2" : "#FFFAF1";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = o.sel ? 3 : 1.4;
    ctx.strokeStyle = o.sel ? T.amber : "#EBD9BE";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.stroke();
    // fixed strip on top: colour dots (left) · count / new (right) — never over the picture
    if (o.dots) o.dots.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + 14 + i * 12, y + 14, 4.4, 0, 6.3);
      ctx.fill();
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.strokeStyle = i === 0 ? T.ink : "rgba(0,0,0,0.15)";
      ctx.stroke();
    });
    if (o.locked) K.ICON.lock(ctx, x + 16, y + 15, 16, K.hexA(T.inkSoft, 0.9));
    if (o.count) K.text(ctx, "×" + o.count, x + w - 12, y + 19, 11.5, 600, T.inkSoft, "right");
    if (o.isNew) {
      K.glow(ctx, x + w - (o.count ? 32 : 14), y + 14, 9, T.amber, 0.4);
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.arc(x + w - (o.count ? 32 : 14), y + 14, 4.6, 0, 6.3);
      ctx.fill();
    }
    // picture area: a floor disc, the item standing on it
    ctx.fillStyle = K.hexA("#E9D2B4", 0.6);
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - 36, w * 0.34, 5, 0, 0, 6.3);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, y + 26, w - 8, h - 50);
    ctx.clip();
    if (o.locked) {
      ctx.globalAlpha = 0.3;
      ctx.filter = "grayscale(1) brightness(0.55)";
    }
    o.draw(ctx, x + w / 2, y + h - 35);
    ctx.restore();
    K.text(ctx, o.name, x + w / 2, y + h - 15, 12, 600, o.locked ? T.inkSoft : T.ink, "center");
    if (o.locked) K.text(ctx, o.from, x + w / 2, y + h - 2, 10, 500, T.inkSoft, "center");
  }
  function chip(ctx, x, y, label, on, icon) {
    ctx.font = `600 13.5px ${K.FONT}`;
    const w = ctx.measureText(label).width + (icon ? 40 : 26);
    ctx.fillStyle = on ? T.amber : "#F3E4CC";
    ctx.beginPath();
    ctx.roundRect(x, y, w, 32, 16);
    ctx.fill();
    if (on) {
      ctx.fillStyle = K.hexA("#FFFFFF", 0.35);
      ctx.beginPath();
      ctx.roundRect(x + 8, y + 3, w - 16, 8, 4);
      ctx.fill();
    }
    if (icon) icon(ctx, x + 18, y + 16, 16, on ? T.ink : T.inkSoft);
    K.text(ctx, label, x + (icon ? 30 : 13), y + 21, 13.5, 600, on ? T.ink : T.inkSoft);
    return w;
  }

  const room = {
    w: 430,
    h: 932,
    crops: [["room", 20, 150, 390, 410], ["catalog", 0, 572, 430, 330]],
    async draw(ctx, w, h) {
      // outside the cottage: the dusk (blurred, quiet)
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, T.skyTop);
      bg.addColorStop(0.5, "#3A2F63");
      bg.addColorStop(1, "#241F48");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      K.reseed(8);
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = K.hexA(T.cream, 0.2 + K.rnd() * 0.4);
        ctx.beginPath();
        ctx.arc(K.rnd() * w, K.rnd() * 220, 0.7, 0, 6.3);
        ctx.fill();
      }
      // the dollhouse: lantern-cap roof over a cut-away room
      const fx = 18, fy = 196, fw = 394, fh = 372;
      K.contact(ctx, 215, fy + fh + 6, 210, 14, 0.5);
      const frame = K.rrect(fx, fy, fw, fh, 30);
      K.solid(ctx, frame, T.wood, { x: fx, y: fy, w: fw, h: fh }, { rim: 2.4, lit: 0.3 });
      // inside
      const ix = 34, iy = 208, iw = 362, ih = 348;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(ix, iy, iw, ih, 22);
      ctx.clip();
      // back wall + side walls + floor (one-point perspective, shallow)
      const bx0 = 64, bx1 = 366, by1 = 452;
      wallpaper(ctx, bx0, iy, bx1 - bx0, by1 - iy);
      for (const side of [-1, 1]) {
        const sw = K.P((q) => {
          const xo = side < 0 ? ix : ix + iw, xi = side < 0 ? bx0 : bx1;
          q.moveTo(xo, iy);
          q.lineTo(xi, iy + 10);
          q.lineTo(xi, by1);
          q.lineTo(xo, iy + ih);
          q.closePath();
        });
        ctx.fillStyle = side < 0 ? "#E2CCC2" : "#D2BBB6";
        ctx.fill(sw);
        // the wallpaper and the wainscot continue onto the side walls (same heights, in perspective)
        const xo = side < 0 ? ix : ix + iw, xi = side < 0 ? bx0 : bx1;
        const f = (388 - (iy + 10)) / (by1 - iy - 10);
        const yo = iy + f * ih;
        ctx.save();
        ctx.clip(sw);
        for (let j = 0; j < 8; j++) for (let i2 = 0; i2 < 2; i2++) {
          const t = (i2 + 0.5) / 2, yy = (iy + 10 + j * 26) * (1 - t) + (iy + j * 38) * t;
          ctx.save();
          ctx.globalAlpha = 0.18;
          K.flower(ctx, xi * (1 - t) + xo * t, yy + 14, 2.8, j % 2 ? "#E8A0AE" : "#C9B6F0");
          ctx.restore();
        }
        const wq = K.P((q) => {
          q.moveTo(xi, 388);
          q.lineTo(xi, by1);
          q.lineTo(xo, iy + ih);
          q.lineTo(xo, yo);
          q.closePath();
        });
        const wg = ctx.createLinearGradient(0, 388, 0, iy + ih);
        wg.addColorStop(0, "#C99A72");
        wg.addColorStop(1, "#A97852");
        ctx.fillStyle = wg;
        ctx.fill(wq);
        ctx.strokeStyle = "#E3B98E";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(xi, 386);
        ctx.lineTo(xo, yo - 2);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = K.hexA(T.plum, side < 0 ? 0.1 : 0.24);
        ctx.fill(sw);
      }
      const floor = K.P((q) => {
        q.moveTo(bx0, by1);
        q.lineTo(bx1, by1);
        q.lineTo(ix + iw, iy + ih);
        q.lineTo(ix, iy + ih);
        q.closePath();
      });
      const fg = ctx.createLinearGradient(0, by1, 0, iy + ih);
      fg.addColorStop(0, "#9A6C4C");
      fg.addColorStop(1, "#C08A60");
      ctx.fillStyle = fg;
      ctx.fill(floor);
      ctx.save();
      ctx.clip(floor);
      ctx.strokeStyle = K.hexA(T.plum, 0.18);
      ctx.lineWidth = 1;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(215 + i * 26, by1);
        ctx.lineTo(215 + i * 36, iy + ih);
        ctx.stroke();
      }
      for (const t of [0.3, 0.62]) {
        const y = by1 + (iy + ih - by1) * t;
        ctx.beginPath();
        ctx.moveTo(ix, y);
        ctx.lineTo(ix + iw, y);
        ctx.stroke();
      }
      ctx.restore();
      // ceiling beam + string lights
      const beam = K.rrect(ix, iy, iw, 16, 4);
      K.solid(ctx, beam, T.woodHi, { x: ix, y: iy, w: iw, h: 16 }, { rim: 0.8, lw: 0.5 });
      window.Decor.byId.stringLights.draw(ctx, 215, iy + 50, 1.45);
      for (const nx of [171.5, 258.5]) {
        const nail = K.ellipseP(nx, iy + 21, 2.6, 2.6);
        K.solid(ctx, nail, T.woodLo, { x: nx - 2.6, y: iy + 18.4, w: 5.2, h: 5.2 }, { rim: 0.3 });
      }
      // window on the back wall + wall slots
      roomWindow(ctx, 215, 300, 46);
      window.Decor.byId.frame.draw(ctx, 112, 330, 1.45);
      window.Decor.byId.clock.draw(ctx, 318, 312, 1.5, T.woodHi);
      window.Decor.byId.garland.draw(ctx, 215, 252, 1.1);
      // the room's light: the paper lantern's warm pool (upper left), cool window light
      K.glow(ctx, 130, 420, 210, "#FFD9A0", 0.22, 0.75);
      K.glow(ctx, 215, 330, 90, "#C9D2FF", 0.08);
      const P = window.Pilot.ITEMS;
      // back row (y 452 + 10): bookshelf · lantern · [window] · bed
      P.bookshelf.draw(ctx, 92, 470, 1.55, "sage");
      P.paperLantern.draw(ctx, 152, 466, 1.5, "cream");
      P.smallBed.draw(ctx, 322, 474, 1.32, "rose");
      K.glow(ctx, 146, 430, 84, "#FFD9A0", 0.2);
      // mid row: rug under the tea table; chair; Momo on a cushion (visiting)
      window.Decor.byId.rugRound.draw(ctx, 214, 514, 2.1, "#8FA0D8");
      P.roundChair.draw(ctx, 118, 508, 1.6, "rose");
      P.teaTable.draw(ctx, 214, 512, 1.65, "cream");
      window.Decor.byId.cushion.draw(ctx, 284, 512, 1.5, "#FFE59A");
      wick(ctx, 284, 505, 46, { ...FR.momo, expr: "happy", shadow: false });
      emote(ctx, 292, 440, "heart", "#E58C9E");
      P.smallPot.draw(ctx, 352, 506, 1.8, "sage");
      // front row: Wick by the lantern, an empty slot being filled (selected), another empty slot
      wick(ctx, 150, 540, 58, { expr: "curious", look: [1.2, 0.6] });
      slotMark(ctx, 262, 532, 70, true);
      slotMark(ctx, 348, 532, 62, false);
      P.smallPot.draw(ctx, 68, 538, 1.8, "rose");
      ctx.restore();
      // roof cap (the cottage is a lantern too)
      const cap = K.P((q) => {
        q.moveTo(4, 206);
        q.quadraticCurveTo(0, 190, 26, 182);
        q.lineTo(170, 150);
        q.quadraticCurveTo(215, 140, 260, 150);
        q.lineTo(404, 182);
        q.quadraticCurveTo(430, 190, 426, 206);
        q.quadraticCurveTo(215, 196, 4, 206);
        q.closePath();
      });
      K.solid(ctx, cap, "#E7A75A", { x: 0, y: 140, w: 430, h: 66 }, { rim: 2.4, lit: 0.34, shade: 0.4 });
      ctx.save();
      ctx.clip(cap);
      ctx.strokeStyle = K.hexA(K.mix("#E7A75A", T.plum, 0.5), 0.45);
      ctx.lineWidth = 1.4;
      for (const [y, n, x0] of [[196, 15, 20], [180, 12, 52], [164, 8, 110]]) for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x0 + i * 26, y, 13, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
      ctx.restore();
      K.vignette(ctx, w, h, 0.3);
      K.grain(ctx, w, h, 0.05);
      // HUD
      K.disc(ctx, 40, 96, 48, K.ICON.back, "Village");
      signPlaque(ctx, 215, 98, 176, 46, "My cottage");
      K.disc(ctx, 390, 96, 48, K.ICON.camera, "Photo");
      // catalog drawer (slides up from the bottom when a slot is tapped)
      const dy = 584;
      K.panel(ctx, 0, dy, w, h - dy + 30, 28, {});
      ctx.fillStyle = "#E3CBA8";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 22, dy + 9, 44, 5, 2.5);
      ctx.fill();
      K.text(ctx, "Front row, middle", 20, dy + 40, 16, 600, T.ink);
      // close: a quiet cream button (no drop shadow over the chips)
      ctx.fillStyle = "#F3E4CC";
      ctx.beginPath();
      ctx.arc(396, dy + 33, 17, 0, 6.3);
      ctx.fill();
      K.ICON.close(ctx, 396, dy + 33, 26, T.inkSoft);
      let cx = 16;
      for (const [label, on] of [["All", false], ["Seats", true], ["Tables", false], ["Lights", false], ["Plants", false]]) cx += chip(ctx, cx, dy + 56, label, on) + 8;
      const cw = (w - 32 - 30) / 4, chh = 112;
      const DOT = { cream: "#F1DFC0", sage: "#A6CDB4", rose: "#EDB0BC" };
      const cards = [
        { name: "Round chair", draw: (c, x, y) => P.roundChair.draw(c, x, y, 1.2, "sage"), dots: [DOT.sage, DOT.cream, DOT.rose], count: 1, sel: true },
        { name: "Cushion", draw: (c, x, y) => window.Decor.byId.cushion.draw(c, x, y, 3.2, "#F6B7C4"), dots: [DOT.rose, DOT.sage], count: 2, isNew: true },
        { name: "Stool", draw: (c, x, y) => window.Decor.byId.stool.draw(c, x, y, 2.4, T.coral), dots: [DOT.rose] },
        { name: "Rocking chair", draw: (c, x, y) => P.roundChair.draw(c, x, y, 1.2, "cream"), locked: true, from: "from Sage" },
        { name: "Bench", draw: (c, x, y) => window.Decor.byId.sofa.draw(c, x, y, 1.0, "#F2C6A8"), locked: true, from: "from Kuri" },
        { name: "Little sofa", draw: (c, x, y) => window.Decor.byId.sofa.draw(c, x, y, 1.0, "#A8DCC8"), locked: true, from: "at the market" },
      ];
      cards.forEach((o, i) => card(ctx, 16 + (i % 4) * (cw + 10), dy + 100 + Math.floor(i / 4) * (chh + 10), cw, chh, o));
    },
  };


  // ================================================================ (c) after a puzzle: the jar is full → a letter + a gift
  function rays(ctx, x, y, r, n, col, a) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283, a1 = a0 + 6.283 / n / 2.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, K.hexA(col, a));
      g.addColorStop(1, K.hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function giftBox(ctx, x, y, s, col, ribbon) {
    K.contact(ctx, x, y + 2, 46 * s, 8 * s, 0.45);
    const body = K.rrect(x - 36 * s, y - 50 * s, 72 * s, 50 * s, 8 * s);
    K.solid(ctx, body, col, { x: x - 36 * s, y: y - 50 * s, w: 72 * s, h: 50 * s }, { rim: 1.6, lit: 0.3 });
    ctx.fillStyle = ribbon;
    ctx.fillRect(x - 6 * s, y - 50 * s, 12 * s, 50 * s);
    ctx.fillStyle = K.hexA("#FFFFFF", 0.25);
    ctx.fillRect(x - 6 * s, y - 50 * s, 3 * s, 50 * s);
    // inside glow (the box is open)
    const rim = K.P((q) => q.ellipse(x, y - 50 * s, 36 * s, 8 * s, 0, 0, 6.3));
    ctx.fillStyle = K.mix(col, T.plum, 0.45);
    ctx.fill(rim);
    K.glow(ctx, x, y - 52 * s, 50 * s, T.glow, 0.6, 0.5);
  }
  function lid(ctx, x, y, s, col, ribbon, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const l = K.rrect(-40 * s, -10 * s, 80 * s, 14 * s, 6 * s);
    K.solid(ctx, l, K.mix(col, "#FFFFFF", 0.08), { x: -40 * s, y: -10 * s, w: 80 * s, h: 14 * s }, { rim: 1.2 });
    ctx.fillStyle = ribbon;
    ctx.fillRect(-6 * s, -10 * s, 12 * s, 14 * s);
    // bow
    for (const sx of [-1, 1]) {
      const b = K.P((q) => {
        q.moveTo(0, -10 * s);
        q.bezierCurveTo(sx * 20 * s, -30 * s, sx * 26 * s, -8 * s, 0, -10 * s);
        q.closePath();
      });
      K.solid(ctx, b, ribbon, { x: Math.min(0, sx * 26 * s), y: -30 * s, w: 26 * s, h: 22 * s }, { rim: 1, lw: 0.6 });
    }
    ctx.restore();
  }
  function petalCushion(ctx, x, y, s) {
    // a square floor cushion seen from the front-top: puffy sides, corner tufts, a button, petals
    K.contact(ctx, x, y + 3, 26 * s, 4 * s, 0.35);
    const cy = y - 16 * s;
    const c = K.P((q) => {
      q.moveTo(x - 22 * s, cy - 14 * s);
      q.quadraticCurveTo(x, cy - 10 * s, x + 22 * s, cy - 14 * s);
      q.quadraticCurveTo(x + 18 * s, cy, x + 22 * s, cy + 14 * s);
      q.quadraticCurveTo(x, cy + 10 * s, x - 22 * s, cy + 14 * s);
      q.quadraticCurveTo(x - 18 * s, cy, x - 22 * s, cy - 14 * s);
      q.closePath();
    });
    K.solid(ctx, c, "#F4AFC0", { x: x - 22 * s, y: cy - 14 * s, w: 44 * s, h: 28 * s }, { rim: 1.8, lit: 0.36 });
    ctx.save();
    ctx.clip(c);
    for (const [dx, dy] of [[-12, -6], [10, -8], [-6, 7], [13, 6], [0, -1]]) {
      ctx.globalAlpha = 0.7;
      K.flower(ctx, x + dx * s, cy + dy * s, 3 * s, "#FFE3EA");
    }
    ctx.restore();
    ctx.setLineDash([2 * s, 1.6 * s]);
    ctx.lineWidth = 0.8 * s;
    ctx.strokeStyle = K.hexA("#FFFFFF", 0.75);
    ctx.beginPath();
    ctx.moveTo(x - 18 * s, cy - 10 * s);
    ctx.quadraticCurveTo(x, cy - 7 * s, x + 18 * s, cy - 10 * s);
    ctx.quadraticCurveTo(x + 15 * s, cy, x + 18 * s, cy + 10 * s);
    ctx.quadraticCurveTo(x, cy + 7 * s, x - 18 * s, cy + 10 * s);
    ctx.quadraticCurveTo(x - 15 * s, cy, x - 18 * s, cy - 10 * s);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.fillStyle = "#E58C9E";
      ctx.beginPath();
      ctx.ellipse(x + sx * 23 * s, cy + sy * 14.5 * s, 2.6 * s, 2.2 * s, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = "#D9707E";
    ctx.beginPath();
    ctx.arc(x, cy, 1.8 * s, 0, 6.3);
    ctx.fill();
  }
  const gift = {
    w: 430,
    h: 932,
    crops: [["letter", 30, 178, 370, 300], ["gift", 60, 470, 310, 260]],
    async draw(ctx, w, h) {
      // the solved board, softly out of focus behind the moment
      // v2: behind the moment is the v2 puzzle screen (same world), well out of focus
      const bgImg = await img("base/board.png");
      const off = document.createElement("canvas");
      off.width = w * 2;
      off.height = h * 2;
      const oc = off.getContext("2d");
      oc.scale(2, 2);
      const sd = window.Kit.DPR;
      window.Kit.DPR = 2;
      drawPuzzle(oc, bgImg, { solved: true });
      window.Kit.DPR = sd;
      ctx.save();
      ctx.filter = "blur(12px) saturate(0.85)";
      ctx.drawImage(off, -14, -14, w + 28, h + 28);
      ctx.restore();
      ctx.fillStyle = K.hexA("#120E2A", 0.74);
      ctx.fillRect(0, 0, w, h);
      K.glow(ctx, 215, 560, 260, "#FFD9A0", 0.22);
      signPlaque(ctx, 215, 98, 214, 46, "Your jar is full!");
      jarChipFull(ctx, 215, 150);
      // envelope + letter (tilted, hand-written)
      ctx.save();
      ctx.translate(215, 330);
      ctx.rotate(-0.045);
      // envelope behind
      const env = K.rrect(-150, -92, 300, 196, 14);
      K.solid(ctx, env, "#F2B9C4", { x: -150, y: -92, w: 300, h: 196 }, { rim: 1.4, lit: 0.25 });
      const flap = K.P((q) => {
        q.moveTo(-150, -86);
        q.lineTo(0, -168);
        q.lineTo(150, -86);
        q.closePath();
      });
      K.solid(ctx, flap, "#F6C7D0", { x: -150, y: -168, w: 300, h: 82 }, { rim: 1.2 });
      // letter paper
      ctx.save();
      ctx.shadowColor = K.hexA(T.plum, 0.4);
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = "#FFF9EE";
      ctx.beginPath();
      ctx.roundRect(-132, -140, 264, 232, 10);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = K.hexA("#E3CBA8", 0.6);
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-112, -78 + i * 28);
        ctx.lineTo(112, -78 + i * 28);
        ctx.stroke();
      }
      // v2: paper, ruled lines and words share ONE transform; every baseline sits 5 pt above its line.
      // Font: the bundled UI face here; production = an OFL hand face per script (r2-village-art §v2.6)
      const LINE0 = -78, GAP = 28;
      ["Dear lantern-keeper,", "thank you for lighting my house!", "I sewed you something soft", "for your cottage. Come visit?"].forEach((l, i) =>
        K.text(ctx, l, -110, LINE0 + i * GAP - 5, 16, 500, "#4A3A5C", "left", K.LETTER));
      K.text(ctx, "— Momo", 110, LINE0 + 4 * GAP - 5, 16.5, 600, "#B05A6E", "right", K.LETTER);
      // signature face (in the margin, below the last line) + a round wax seal with a petal stamp
      wick(ctx, -92, 86, 34, { ...FR.momo, expr: "shy", glow: false, shadow: false });
      const seal = K.P((q) => {
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * 6.283, r = 17 + Math.sin(i * 2.7) * 1.3 + (i % 6 === 0 ? 2.2 : 0);
          i ? q.lineTo(98 + Math.cos(a) * r, 74 + Math.sin(a) * r) : q.moveTo(98 + Math.cos(a) * r, 74 + Math.sin(a) * r);
        }
        q.closePath();
      });
      K.solid(ctx, seal, "#D9707E", { x: 79, y: 55, w: 38, h: 38 }, { rim: 1.8, lit: 0.4 });
      const inner = K.ellipseP(98, 74, 11, 11);
      ctx.fillStyle = K.hexA(K.T.plum, 0.18);
      ctx.fill(inner);
      K.flower(ctx, 98, 74, 6, "#F3B5C0");
      ctx.restore();
      // the gift: an open box, the cushion floating out of it
      rays(ctx, 215, 588, 190, 14, "#FFE3A8", 0.16);
      // the residents stand on a soft paper stage (no one floats)
      for (const [x, y] of [[112, 712], [324, 716]]) {
        K.contact(ctx, x, y + 4, 44, 9, 0.35);
        const st = K.ellipseP(x, y, 40, 9);
        K.solid(ctx, st, "#FBEBD2", { x: x - 40, y: y - 9, w: 80, h: 18 }, { rim: 0.8, lit: 0.3 });
      }
      giftBox(ctx, 215, 690, 1.25, "#F2B9C4", "#FFF1D6");
      lid(ctx, 302, 604, 1.0, "#F2B9C4", "#FFF1D6", 0.2);
      K.glow(ctx, 215, 586, 70, T.glow, 0.45);
      petalCushion(ctx, 215, 612, 1.7);
      // the light from the box rims what it touches (cushion top, box lip)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = K.hexA("#FFE8B0", 0.55);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(180, 572);
      ctx.quadraticCurveTo(215, 578, 250, 572);
      ctx.moveTo(176, 628);
      ctx.quadraticCurveTo(215, 640, 254, 628);
      ctx.stroke();
      ctx.restore();
      for (const [x, y, r, c] of [[150, 560, 8, T.cream], [290, 530, 6, T.lemon], [270, 640, 5, T.cream], [140, 630, 4, T.pink], [320, 590, 4, T.cream]]) K.sparkle(ctx, x, y, r, c);
      // name chip
      ctx.save();
      ctx.shadowColor = K.hexA(T.plum, 0.4);
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#FFF7E8";
      ctx.beginPath();
      ctx.roundRect(140, 492, 150, 30, 15);
      ctx.fill();
      ctx.restore();
      K.text(ctx, "Petal cushion", 205, 512, 15, 600, T.ink, "center");
      // "new" = the calm amber dot (no red)
      K.glow(ctx, 274, 507, 10, T.amber, 0.45);
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.arc(274, 507, 5, 0, 6.3);
      ctx.fill();
      // Momo peeks from behind the box, Wick cheers
      wick(ctx, 112, 708, 62, { ...FR.momo, expr: "shy" });
      wick(ctx, 324, 712, 58, { expr: "cheer", arms: "up" });
      K.grain(ctx, w, h, 0.05);
      K.pill(ctx, 65, 762, 300, 60, "Put it in my cottage", { size: 19 });
      K.pill(ctx, 140, 838, 150, 46, "Later", { ghost: true, size: 17 });
    },
  };
  function jarChipFull(ctx, x, y) {
    ctx.fillStyle = T.glass;
    ctx.beginPath();
    ctx.roundRect(x - 54, y - 14, 108, 28, 14);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = K.hexA(T.amber, 0.7);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = T.amber;
      ctx.beginPath();
      ctx.arc(x - 14 + i * 11, y, 3.6, 0, 6.3);
      ctx.fill();
      K.glow(ctx, x - 14 + i * 11, y, 7, T.glow, 0.4);
    }
    jar(ctx, x - 36, y - 1, 1, 0.42);
  }


  // ================================================================ (d) the board screen, same studio
  function coverWithStrip(ctx, im, k, srcX, x, y, w, h) {
    // paint over an old HUD element with a 1-pt column of the same picture stretched sideways,
    // feathered at both ends so the hill / sky continue under it
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * 3);
    c.height = Math.ceil(h * 3);
    const x2 = c.getContext("2d");
    x2.drawImage(im, srcX * k, y * k, 1 * k, h * k, 0, 0, c.width, c.height);
    x2.globalCompositeOperation = "destination-in";
    const g = x2.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.08, "rgba(0,0,0,1)");
    g.addColorStop(0.92, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x2.fillStyle = g;
    x2.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(c, x, y, w, h);
  }
  function jarIcon(ctx, x, y, s, fill) {
    const body = K.P((q) => {
      q.moveTo(x - s * 0.26, y - s * 0.22);
      q.quadraticCurveTo(x - s * 0.38, y + s * 0.12, x - s * 0.28, y + s * 0.38);
      q.quadraticCurveTo(x, y + s * 0.5, x + s * 0.28, y + s * 0.38);
      q.quadraticCurveTo(x + s * 0.38, y + s * 0.12, x + s * 0.26, y - s * 0.22);
      q.closePath();
    });
    ctx.save();
    ctx.clip(body);
    const top = y + s * 0.44 - s * 0.7 * fill;
    const g = ctx.createLinearGradient(0, top, 0, y + s * 0.5);
    g.addColorStop(0, "#FFF2B8");
    g.addColorStop(1, T.amber);
    ctx.fillStyle = g;
    ctx.fillRect(x - s, top, s * 2, s);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(x - s * 0.16 + (i % 3) * s * 0.16, top + s * 0.1 + Math.floor(i / 3) * s * 0.14, s * 0.035, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
    K.glow(ctx, x, y + s * 0.2, s * 0.7, T.glow, 0.35);
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = T.cream;
    ctx.stroke(body);
    ctx.fillStyle = T.cream;
    ctx.beginPath();
    ctx.roundRect(x - s * 0.3, y - s * 0.36, s * 0.6, s * 0.14, s * 0.05);
    ctx.fill();
  }
  const board = {
    w: 430,
    h: 932,
    crops: [["hud", 0, 360, 430, 140], ["top", 0, 40, 430, 120]],
    async draw(ctx, w, h) {
      const im = await img("base/board.png");
      const k = im.width / w;
      ctx.drawImage(im, 0, 0, w, h);
      // remove the old five HUD grammars (gear, "?" + How to, Town, Today tile, Undo, Hint)
      coverWithStrip(ctx, im, k, 152, 0, 48, 156, 58);
      coverWithStrip(ctx, im, k, 150, -6, 396, 150, 79);
      coverWithStrip(ctx, im, k, 282, 288, 396, 150, 79);
      // ONE grammar: glass disc + cream line icon + caption below; attention = amber ring
      K.disc(ctx, 34, 78, 40, K.ICON.gear, "Settings");
      K.disc(ctx, 92, 78, 40, K.ICON.rules, "Rules");
      K.disc(ctx, 42, 424, 50, (c, x, y, s) => jarIcon(c, x, y + 1, s * 1.15, 0.66), "Village", { badge: 1 });
      K.disc(ctx, 104, 424, 50, (c, x, y, s, col) => K.ICON.today(c, x, y + 1, s, col, 17), "Today");
      K.disc(ctx, 326, 424, 50, K.ICON.undo, "Undo");
      K.disc(ctx, 388, 424, 50, K.ICON.magnifier, "Hint", { attn: true });
      // reward landing (Royal Match grammar, calm): a lantern drop flies from the last lantern to the jar
      const path = [[214, 520], [120, 330], [46, 392]];
      const at = (t) => [(1 - t) * (1 - t) * path[0][0] + 2 * (1 - t) * t * path[1][0] + t * t * path[2][0], (1 - t) * (1 - t) * path[0][1] + 2 * (1 - t) * t * path[1][1] + t * t * path[2][1]];
      for (let i = 0; i < 16; i++) {
        const t = 0.35 + (i / 16) * 0.5;
        const [x, y] = at(t);
        K.glow(ctx, x, y, 3 + (t - 0.35) * 12, T.glow, 0.08 + (t - 0.35) * 0.5);
      }
      const [dx, dy] = at(0.88);
      K.glow(ctx, dx, dy, 22, T.glow, 0.7);
      const drop = K.P((q) => {
        q.moveTo(dx, dy - 12);
        q.quadraticCurveTo(dx + 7, dy - 2, dx + 7, dy + 3);
        q.arc(dx, dy + 3, 7, 0, Math.PI);
        q.quadraticCurveTo(dx - 7, dy - 2, dx, dy - 12);
        q.closePath();
      });
      const dg = ctx.createRadialGradient(dx - 2, dy + 1, 1, dx, dy + 2, 9);
      dg.addColorStop(0, "#FFFBEA");
      dg.addColorStop(1, T.amber);
      ctx.fillStyle = dg;
      ctx.fill(drop);
      K.sparkle(ctx, dx + 13, dy - 10, 4, T.cream);
    },
  };


  // ================================================================ v2: the puzzle screen in the ONE world
  function lighthouse(ctx, x, gy, s) {
    K.contact(ctx, x, gy + 1, 16 * s, 3 * s, 0.4);
    const body = K.P((q) => {
      q.moveTo(x - 10 * s, gy);
      q.lineTo(x - 6 * s, gy - 70 * s);
      q.lineTo(x + 6 * s, gy - 70 * s);
      q.lineTo(x + 10 * s, gy);
      q.closePath();
    });
    K.solid(ctx, body, "#5E5288", { x: x - 10 * s, y: gy - 70 * s, w: 20 * s, h: 70 * s }, { rim: 1, tex: "stone" });
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = K.hexA("#E3D9F2", 0.35);
    for (const y of [-18, -40]) ctx.fillRect(x - 12 * s, gy + y * s, 24 * s, 6 * s);
    ctx.restore();
    K.glow(ctx, x, gy - 78 * s, 26 * s, T.glow, 0.6);
    const lamp = K.rrect(x - 5 * s, gy - 82 * s, 10 * s, 10 * s, 2 * s);
    ctx.fillStyle = "#FFF0C0";
    ctx.fill(lamp);
    const roof = K.P((q) => {
      q.moveTo(x - 8 * s, gy - 82 * s);
      q.quadraticCurveTo(x, gy - 94 * s, x + 8 * s, gy - 82 * s);
      q.closePath();
    });
    K.solid(ctx, roof, "#3E3466", { x: x - 8 * s, y: gy - 94 * s, w: 16 * s, h: 12 * s }, { rim: 0.6 });
  }
  function bough(ctx, x, y) {
    // a dark branch from the right edge with a hanging lantern (the app's bough, painted)
    ctx.save();
    ctx.fillStyle = "#1C1836";
    ctx.beginPath();
    ctx.moveTo(440, y - 30);
    ctx.quadraticCurveTo(400, y - 26, x - 20, y);
    ctx.quadraticCurveTo(400, y - 18, 440, y - 14);
    ctx.fill();
    K.reseed(77);
    for (let i = 0; i < 14; i++) {
      const t = i / 14, bx = 440 - (440 - (x - 20)) * t, by = y - 26 + 26 * t * t;
      ctx.beginPath();
      ctx.ellipse(bx + (K.rnd() - 0.5) * 8, by - 6 - K.rnd() * 6, 7, 3.2, -0.6 + K.rnd(), 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#1C1836";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 26);
    ctx.stroke();
    K.glow(ctx, x, y + 34, 34, T.glow, 0.5);
    K.miniLantern(ctx, x, y + 34, 15, true);
  }
  let groundCol = null;
  function sampleGround(im) {
    if (groundCol) return groundCol;
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const x = c.getContext("2d");
    x.drawImage(im, 645 - 2, 1404, 4, 4, 0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    groundCol = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
    return groundCol;
  }
  /** The puzzle screen (430×932): painted scene + the real v12 board below y 470 + the one HUD. */
  function drawPuzzle(ctx, im, o = {}) {
    const w = 430, h = 932;
    ctx.drawImage(im, 0, 0, w, h);
    const gc = sampleGround(im);
    // clear the old HUD captions under the feather (the board's wall starts at y ≈ 477)
    ctx.fillStyle = gc;
    ctx.fillRect(0, 430, w, 45);
    // the painted scene above the board, feathered into the real ground at its bottom edge
    const lay = document.createElement("canvas");
    const D = window.Kit.DPR * (o.scale ?? 1);
    lay.width = Math.round(w * D);
    lay.height = Math.round(476 * D);
    const c = lay.getContext("2d");
    c.scale(D, D);
    const saveDPR = window.Kit.DPR;
    window.Kit.DPR = D;
    K.sky(c, w, 476, 330);
    K.moon(c, 346, 104, 18);
    K.cloud(c, 120, 236, 0.6, 0.35);
    K.hill(c, w, 318, 8, 0.8, T.hillFar, 200, 0.35);
    K.reseed(3);
    // the rest of the village on the far hill: tiny lantern-houses (same architecture, hazed)
    for (const [x, y, sc, roof] of [[84, 326, 0.11, "#E58C9E"], [118, 330, 0.09, "#6FAE8C"], [330, 326, 0.1, "#8E7BCF"], [372, 330, 0.12, "#E7A75A"], [408, 324, 0.09, "#6FAE8C"]]) {
      c.save();
      c.globalAlpha = 0.75;
      K.lanternHouse(c, x, y, sc, { paper: "#FFE9C2", paperLo: "#E2B98A", roof, door: T.wood, windows: [0] });
      c.restore();
    }
    K.hill(c, w, 352, 9, 2.1, T.hillMid, 200, 0.3);
    lighthouse(c, 36, 352, 0.95);
    // the house of this level: a lantern-house (same architecture as the village), its number plate
    K.lanternHouse(c, 215, 398, 1.42, { paper: "#FFEBD0", paperLo: "#E9BE8C", roof: "#B97A62", door: "#7A5240", flower: T.pink, plate: 9, darkWindows: o.solved ? [] : [1], dim: o.solved ? 0 : 0.35 });
    K.bush(c, 112, 400, 0.7, T.leaf, [T.pink, T.lemon]);
    K.pot(c, 300, 398, 0.7, "flowers", "#C27A5A");
    // near ground: the crest the HUD sits on, then the real board's ground colour
    const crest = K.hill(c, w, 404, 5, 4.4, T.hillNear, 120, 0.3);
    void crest;
    const g = c.createLinearGradient(0, 404, 0, 476);
    g.addColorStop(0, K.hexA(gc, 0.2));
    g.addColorStop(0.5, gc);
    g.addColorStop(1, gc);
    c.fillStyle = g;
    c.fillRect(0, 404, w, 72);
    K.grassTufts(c, 0, w, 405, 50, K.mix(T.hillNear, T.grassHi, 0.4), 0.8);
    // stepping stones (as in the app) and Wick on the last one
    for (const [x, y, rx] of [[208, 409, 15], [210, 421, 19], [200, 434, 23]]) K.stoneBlob(c, x, y, rx, rx * 0.3, K.mix(T.stone, T.lilac, 0.2));
    window.Kit.DPR = saveDPR;
    void c;
    // string lights + the bough (in front of the sky, behind nothing)
    // feather the layer's bottom so the painted ground melts into the real ground
    const f = document.createElement("canvas");
    f.width = lay.width;
    f.height = lay.height;
    const fx = f.getContext("2d");
    fx.drawImage(lay, 0, 0);
    fx.globalCompositeOperation = "destination-in";
    const fg = fx.createLinearGradient(0, 0, 0, lay.height);
    fg.addColorStop(0, "rgba(0,0,0,1)");
    fg.addColorStop(456 / 476, "rgba(0,0,0,1)");
    fg.addColorStop(1, "rgba(0,0,0,0)");
    fx.fillStyle = fg;
    fx.fillRect(0, 0, f.width, f.height);
    ctx.drawImage(f, 0, 0, w, 476);
    stringLights(ctx, 64, 150, 306, 146, 18, 10);
    bough(ctx, 362, 196);
    wick(ctx, 200, 436, 70, { expr: o.solved ? "happy" : "idle" });
    // the ONE HUD grammar
    K.disc(ctx, 38, 78, 42, K.ICON.gear, "Settings");
    K.disc(ctx, 122, 78, 42, K.ICON.rules, "Rules");
    K.disc(ctx, 42, 420, 50, (cc, x, y, sz, col) => K.ICON.jar(cc, x, y, sz, col, 0.66), "Village", { badge: true });
    K.disc(ctx, 120, 420, 50, (cc, x, y, sz, col) => K.ICON.today(cc, x, y + 1, sz, col, 17), "Today");
    K.disc(ctx, 310, 420, 50, K.ICON.undo, "Undo");
    K.disc(ctx, 388, 420, 50, K.ICON.magnifier, "Hint", { attn: true });
    K.grain(ctx, w, 470, 0.04);
  }
  const boardV2 = {
    w: 430,
    h: 932,
    crops: [["hud", 0, 360, 430, 140], ["top", 0, 40, 430, 140], ["house", 90, 160, 250, 260]],
    async draw(ctx) {
      drawPuzzle(ctx, await img("base/board.png"));
    },
  };
  const puzzle = {
    w: 920,
    h: 1060,
    async draw(ctx, w, h) {
      ctx.fillStyle = "#1E1B3B";
      ctx.fillRect(0, 0, w, h);
      K.text(ctx, "Puzzle screen — before / after: one world (the house is a lantern-house)", 30, 46, 22, 600, T.cream);
      const im = await img("base/board.png");
      const k = 0.98;
      for (const [i, label] of [[0, "Before — v12 build (brick house, five HUD grammars)"], [1, "After — lantern-house, one light, one HUD grammar"]]) {
        const x0 = 30 + i * 450, y0 = 80;
        K.text(ctx, label, x0, y0 - 8, 14, 500, "#CBBFE0");
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x0, y0, 430 * k, 932 * k, 30);
        ctx.clip();
        ctx.translate(x0, y0);
        ctx.scale(k, k);
        if (i === 0) ctx.drawImage(im, 0, 0, 430, 932);
        else drawPuzzle(ctx, im, { scale: k });
        ctx.restore();
        ctx.lineWidth = 2;
        ctx.strokeStyle = K.hexA(T.cream, 0.35);
        ctx.beginPath();
        ctx.roundRect(x0, y0, 430 * k, 932 * k, 30);
        ctx.stroke();
      }
    },
  };


  // ================================================================ v2 shared: dialogue card (1–3 lines, wraps)
  function wrapLines(ctx, text, maxW, size, font = K.FONT) {
    ctx.font = `500 ${size}px ${font}`;
    // CJK has no spaces: break between characters (keep closing punctuation with its character)
    const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text) && !/\s/.test(text.trim());
    const words = cjk ? Array.from(text).reduce((a, ch) => ("、。，！？）」".includes(ch) && a.length ? (a[a.length - 1] += ch, a) : (a.push(ch), a)), []) : text.split(/(\s+)/).filter((x) => x.length);
    const out = [];
    let cur = "";
    for (const wd of words) {
      const t = cur + wd;
      if (ctx.measureText(t.trim()).width > maxW && cur.trim()) {
        out.push(cur.trim());
        cur = wd.trimStart();
      } else cur = t;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  /** Dialogue card v2: portrait left (never covered), name tab ABOVE the card, 1–3 lines; height follows the text. */
  function dialogueCardV2(ctx, x, bottom, w, name, col, text, face, o = {}) {
    const size = o.size ?? 16;
    const textX = x + 88, maxW = w - 88 - 18;
    let lines = wrapLines(ctx, text, maxW, size);
    let fs = size;
    if (lines.length > 3) {
      fs = size * 0.9;
      lines = wrapLines(ctx, text, maxW, fs);
    }
    const lh = fs * 1.36;
    const h = Math.max(84, 26 + lines.length * lh + 14);
    const y = bottom - h;
    K.panel(ctx, x, y, w, h, 20, { stitch: true });
    // name tab: sits on the card's top edge, left, in the speaker's colour
    ctx.font = `600 13.5px ${K.FONT}`;
    const nw = ctx.measureText(name).width + 22;
    ctx.save();
    ctx.shadowColor = K.hexA(T.plum, 0.35);
    ctx.shadowBlur = 6;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x + 16, y - 13, nw, 24, 12);
    ctx.fill();
    ctx.restore();
    K.text(ctx, name, x + 16 + nw / 2, y + 4, 13.5, 600, T.ink, "center");
    // portrait
    const px = x + 46, py = y + h / 2 + 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, 6.3);
    ctx.fillStyle = "#3A2F63";
    ctx.fill();
    ctx.clip();
    K.glow(ctx, px, py + 6, 40, T.glow, 0.45);
    face(ctx, px, py + 26, 58);
    ctx.restore();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, 6.3);
    ctx.stroke();
    const ty = y + h / 2 - ((lines.length - 1) * lh) / 2 + fs * 0.36;
    lines.forEach((l, i) => K.text(ctx, l, textX, ty + i * lh, fs, 500, T.ink));
    ctx.fillStyle = T.amberLip;
    ctx.beginPath();
    ctx.moveTo(x + w - 26, y + h - 20);
    ctx.lineTo(x + w - 16, y + h - 20);
    ctx.lineTo(x + w - 21, y + h - 13);
    ctx.closePath();
    ctx.fill();
    return { y, h, lines: lines.length };
  }
  // smooth curve through points (Catmull-Rom) → dense samples [x, y, k]
  function spline(pts, n = 12) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function softPath(ctx, pts, width) {
    // a dirt path along a smooth curve; stepping stones vary ±30 % in size and spacing
    const road = (wk, col) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = col;
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.lineWidth = width * wk * pts[i][2];
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
      ctx.restore();
    };
    road(1.3, K.hexA("#1E1A40", 0.5));
    road(1.12, "#7B6A8E");
    road(0.7, K.hexA("#9E8A9E", 0.7));
    road(0.28, K.hexA("#BBA4A8", 0.4));
    K.reseed(Math.round(pts[0][0] * 3 + pts[0][1]));
    let acc = 0, next = 14;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1, k] = pts[i];
      acc += Math.hypot(x1 - x0, y1 - y0);
      if (acc < next * k) continue;
      acc = 0;
      next = 22 + K.rnd() * 14;
      const side = K.rnd() < 0.5 ? -1 : 1;
      const r = (8 + K.rnd() * 5) * k;
      K.stoneBlob(ctx, x1 + side * width * 0.16 * k * K.rnd(), y1, r, r * 0.4, K.mix(T.stoneHi, "#E8D6C8", 0.2 + K.rnd() * 0.3));
    }
  }
  function hedge(ctx, x0, x1, y, s) {
    for (let x = x0; x < x1; x += 13 * s) K.bush(ctx, x, y + (Math.sin(x) * 2), 0.55 * s, K.mix(T.leaf, T.lilac, 0.12), null);
  }
  function mushrooms(ctx, x, y, s) {
    window.Decor.byId.mushroom.draw(ctx, x, y, s);
  }
  function rock(ctx, x, y, s) {
    K.stoneBlob(ctx, x, y, 9 * s, 6 * s, K.mix(T.stone, T.lilac, 0.25));
    ctx.fillStyle = K.hexA(T.moss, 0.7);
    ctx.beginPath();
    ctx.ellipse(x - 2 * s, y - 4 * s, 5 * s, 2 * s, -0.2, 0, 6.3);
    ctx.fill();
  }
  function signpost(ctx, x, y, s) {
    K.contact(ctx, x, y + 1, 8 * s, 2 * s);
    const post = K.rrect(x - 1.6 * s, y - 30 * s, 3.2 * s, 30 * s, 1.4 * s);
    K.solid(ctx, post, T.woodLo, { x: x - 1.6 * s, y: y - 30 * s, w: 3.2 * s, h: 30 * s }, { rim: 0.4, tex: "wood" });
    const board = K.P((q) => {
      q.moveTo(x - 2 * s, y - 30 * s);
      q.lineTo(x + 18 * s, y - 30 * s);
      q.lineTo(x + 23 * s, y - 25 * s);
      q.lineTo(x + 18 * s, y - 20 * s);
      q.lineTo(x - 2 * s, y - 20 * s);
      q.closePath();
    });
    K.solid(ctx, board, T.woodHi, { x: x - 2 * s, y: y - 30 * s, w: 25 * s, h: 10 * s }, { rim: 0.6, tex: "wood" });
    K.miniLantern(ctx, x + 8 * s, y - 25 * s, 6 * s, true);
  }
  function picnicV2(ctx, x, y, s) {
    // front projection like every other object: a soft blanket slab with a sliver of top
    const top = K.rrect(x - 30 * s, y - 9 * s, 60 * s, 6 * s, 3 * s);
    K.solid(ctx, top, "#F2C6A8", { x: x - 30 * s, y: y - 9 * s, w: 60 * s, h: 6 * s }, { rim: 0.6, lit: 0.3, tex: "cloth" });
    ctx.save();
    ctx.clip(top);
    ctx.fillStyle = K.hexA(T.coral, 0.45);
    for (let i = -30; i < 30; i += 10) ctx.fillRect(x + i * s, y - 9 * s, 5 * s, 6 * s);
    ctx.restore();
    const hem = K.rrect(x - 31 * s, y - 4 * s, 62 * s, 4 * s, 2 * s);
    K.solid(ctx, hem, K.mix("#F2C6A8", T.coral, 0.35), { x: x - 31 * s, y: y - 4 * s, w: 62 * s, h: 4 * s }, { rim: 0.3, tex: "cloth" });
    window.Decor.byId.teaset.draw(ctx, x - 8 * s, y - 8 * s, 0.75 * s, "#A8DCC8");
    window.Decor.byId.mooncake.draw(ctx, x + 15 * s, y - 7 * s, 0.7 * s);
  }

  // ================================================================ (a) v2 village
  const villageV2 = {
    w: 430,
    h: 932,
    crops: [["houses", 20, 330, 390, 330], ["card", 0, 760, 430, 172], ["ground", 0, 560, 430, 220]],
    async draw(ctx, w, h) {
      const horizon = 282;
      K.sky(ctx, w, h, horizon);
      K.moon(ctx, 346, 196, 17);
      K.cloud(ctx, 160, 226, 0.75, 0.45);
      K.hill(ctx, w, 262, 9, 0.8, T.hillFar, 140, 0.35);
      for (const [x, y, sc, roof] of [[40, 270, 0.1, "#E58C9E"], [96, 266, 0.08, "#6FAE8C"], [300, 266, 0.09, "#8E7BCF"], [352, 270, 0.1, "#E7A75A"], [404, 264, 0.08, "#6FAE8C"]]) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        K.lanternHouse(ctx, x, y, sc, { paper: "#FFE9C2", paperLo: "#E2B98A", roof, door: T.wood, windows: [0] });
        ctx.restore();
      }
      K.hill(ctx, w, 300, 10, 2.1, T.hillMid, 120, 0.3);
      K.tree(ctx, 22, 340, 0.7, 0.2);
      K.tree(ctx, 410, 332, 0.78, 0.15);
      K.tree(ctx, 372, 344, 0.5, 0.3);
      K.tree(ctx, 60, 350, 0.5, 0.3);
      K.hill(ctx, w, 346, 7, 4.4, T.hillNear, 600, 0.34);
      meadow(ctx, w, 350, 440);
      // mowed bands of light across the lawn (follow the hill, give the ground a surface)
      for (let i = 0; i < 6; i++) {
        const y = 380 + i * 64;
        const band = K.P((q) => {
          q.moveTo(0, y);
          q.bezierCurveTo(140, y - 14, 290, y + 14, 430, y - 6);
          q.lineTo(430, y + 18);
          q.bezierCurveTo(290, y + 38, 140, y + 10, 0, y + 24);
          q.closePath();
        });
        ctx.fillStyle = K.hexA("#6A79AE", 0.1);
        ctx.fill(band);
      }
      K.texture(ctx, K.rrect(0, 350, w, 460, 0), { x: 0, y: 350, w, h: 460 }, "grass", 0.22);
      // warm light from the string lights onto the lawn
      for (let i = 0; i < 6; i++) K.glow(ctx, 30 + i * 74, 372, 60, "#FFC98A", 0.14, 0.3);
      // paths: the lane + a branch to every door (curves, varied stones); none runs under the card
      softPath(ctx, spline([[212, 820, 1.15], [196, 740, 1.0], [210, 660, 0.85], [228, 560, 0.7], [216, 460, 0.55], [212, 380, 0.42]]), 40);
      // branches taper as they leave the lane and end on each doorstep
      softPath(ctx, spline([[198, 706, 0.85], [150, 676, 0.62], [104, 648, 0.42]]), 30);
      softPath(ctx, spline([[214, 650, 0.8], [270, 640, 0.6], [334, 634, 0.42]]), 30);
      softPath(ctx, spline([[220, 492, 0.6], [166, 452, 0.42], [110, 438, 0.3]]), 28);
      softPath(ctx, spline([[220, 470, 0.58], [270, 444, 0.42], [320, 430, 0.3]]), 28);
      // back row: Sage (left), Luna (right)
      pool(ctx, 112, 432, 70);
      pool(ctx, 322, 424, 66);
      K.lanternHouse(ctx, 108, 432, 0.64, HOUSE.sage);
      K.lanternHouse(ctx, 322, 424, 0.6, HOUSE.luna);
      // the string lights in FRONT of the back houses' handles
      stringLights(ctx, -6, 318, 436, 310, 26, 13);
      K.mailbox(ctx, 156, 436, 0.7, false, T.mint);
      K.mailbox(ctx, 280, 432, 0.66, false, T.lilac);
      K.pot(ctx, 150, 446, 0.6, "flowers", "#8FB3E8");
      hedge(ctx, 30, 70, 444, 1);
      hedge(ctx, 356, 420, 440, 1);
      bench(ctx, 384, 452, 0.62);
      wick(ctx, 383, 445, 30, { ...FR.luna, expr: "curious", look: [1, -1.2] });
      wick(ctx, 172, 456, 30, { ...FR.sage, expr: "sleepy" });
      K.tree(ctx, 196, 392, 0.42, 0.1);
      mushrooms(ctx, 64, 468, 1.1);
      rock(ctx, 252, 452, 0.9);
      // picnic between the rows (front projection now)
      picnicV2(ctx, 288, 520, 0.85);
      flowerBed(ctx, 160, 200, 528, 0.85);
      K.tree(ctx, 20, 560, 0.62, 0.05);
      rock(ctx, 400, 566, 1.1);
      // middle row: the lantern-keeper's house (Wick) left, Momo right
      pool(ctx, 96, 610, 110, 0.4);
      pool(ctx, 330, 598, 104, 0.4);
      K.lampPost(ctx, 170, 600, 0.86);
      K.lanternHouse(ctx, 92, 640, 0.98, HOUSE.wick);
      K.lanternHouse(ctx, 336, 628, 0.92, { ...HOUSE.momo, windows: [-24] });
      K.mailbox(ctx, 168, 664, 1.05, true, T.coral);
      K.glow(ctx, 178, 624, 22, T.amber, 0.4);
      K.sparkle(ctx, 186, 612, 4.4, T.lemon);
      K.mailbox(ctx, 404, 652, 0.9, false, T.pink);
      K.pot(ctx, 276, 640, 0.85, "leafy", "#E9A5B4");
      K.bush(ctx, 16, 656, 0.85, T.leaf, [T.lilac, T.lemon]);
      flowerBed(ctx, 40, 80, 690, 1);
      flowerBed(ctx, 270, 300, 680, 1);
      signpost(ctx, 250, 708, 1);
      wick(ctx, 290, 664, 44, { ...FR.momo, expr: "shy" });
      // front row: market stall (left), pond (right)
      pool(ctx, 80, 770, 80, 0.32);
      stall(ctx, 80, 774, 0.95);
      K.pond(ctx, 346, 748, 64, 21);
      wick(ctx, 292, 762, 32, { ...FR.pip, expr: "cheer", arms: "up", sparkleEyes: true });
      K.sparkle(ctx, 276, 718, 4, T.lemon);
      K.bush(ctx, 160, 780, 0.72, T.leaf, [T.coral, T.lemon]);
      flowerBed(ctx, 230, 270, 786, 1.1);
      flowerBed(ctx, 380, 420, 786, 1.05);
      mushrooms(ctx, 150, 740, 1.2);
      K.fence(ctx, 0, 34, 786, 0.9);
      // the speaker: Wick on the lane, waving
      wick(ctx, 204, 724, 70, { expr: "happy", arms: "wave" });
      K.fireflies(ctx, [[40, 500, 1.4], [150, 506, 1.2], [262, 500, 1.3], [400, 506, 1.4], [380, 690, 1.2], [140, 700, 1.1], [248, 770, 1.3], [24, 730, 1.2], [300, 392, 1.1]]);
      K.vignette(ctx, w, h, 0.34);
      K.grain(ctx, w, h, 0.05);
      // HUD: one grammar
      K.disc(ctx, 40, 96, 48, K.ICON.back, "Puzzle");
      signPlaque(ctx, 215, 98, 176, 46, "Lantern Lane");
      K.disc(ctx, 390, 96, 48, K.ICON.letter, "Letters", { badge: true });
      jarChip(ctx, 215, 150);
      dialogueCardV2(ctx, 16, 896, 398, "Wick", "#FFE6B8", "Momo moved in next door! She left petal cookies by your mailbox.", (c, x, y, sz) => wick(c, x, y, sz, { expr: "happy", shadow: false, glow: false }));
    },
  };

  // ================================================================ (f) dialogue card × locales (DE / FR longest lines, SE width)
  const dialog = {
    w: 900,
    h: 1240,
    async draw(ctx, w, h) {
      ctx.fillStyle = "#2C2752";
      ctx.fillRect(0, 0, w, h);
      K.text(ctx, "Dialogue card v2 — 1–3 lines, height follows the text; tested at SE width (375 pt) and 430 pt", 30, 44, 18, 600, T.cream);
      K.text(ctx, "Longest en lines from r2-village-lines.en.json; de/fr = AI drafts (≈ +20–30 %); pseudo = en × 1.4 (+40 %)", 30, 70, 14, 500, "#CBBFE0");
      const L = [
        ["en", "Sage", "#A8DCC8", "sage", "I planted something for you. It'll take a while. Worth it."],
        ["de", "Sage", "#A8DCC8", "sage", "Ich habe etwas für dich gepflanzt. Es dauert eine Weile. Es lohnt sich."],
        ["fr", "Sage", "#A8DCC8", "sage", "J'ai planté quelque chose pour toi. Ça prendra du temps. Ça vaut le coup."],
        ["de", "Kuri", "#F2C6A8", "kuri", "Yuki sagt, mein Feuer knistert zu laut. Ich habe es leiser gedreht."],
        ["fr", "Luna", "#C9B6F0", "luna", "Si un jour tu ne trouves plus ton chemin, cherche la lune. J'y serai."],
        ["pseudo", "Sage", "#A8DCC8", "sage", "[Ĩ ƥļàñţéð šöɱéţĥîñĝ ƒöŕ ýöû. Ĩţ'ļļ ţàķé à ŵĥîļé. Ŵöŕţĥ îţ. ōñē ţŵō ţĥŕēē]"],
        ["ko", "세이지", "#A8DCC8", "sage", "너한테 줄 걸 심었어요. 시간이 좀 걸려요. 그래도 그럴 가치가 있어요."],
        ["ja", "セージ", "#A8DCC8", "sage", "きみのために何か植えたよ。少し時間がかかるけど、きっと待つ価値があるよ。"],
      ];
      const Fk = { sage: FR.sage, kuri: FR.kuri, luna: FR.luna };
      L.forEach(([loc, name, col, fr, text], i) => {
        const bottom = 220 + i * 140;
        for (const [j, cw] of [[0, 375 - 32], [1, 430 - 32]]) {
          const x = 30 + j * 430;
          const r = dialogueCardV2(ctx, x, bottom, cw, name, col, text, (c, px, py, sz) => wick(c, px, py, sz, { ...Fk[fr], expr: "happy", shadow: false, glow: false }));
          K.text(ctx, `${loc} · ${j ? 430 : 375} pt · ${r.lines} line${r.lines > 1 ? "s" : ""}`, x + cw, r.y - 6, 11.5, 600, "#CBBFE0", "right");
        }
      });
    },
  };

  // ================================================================ (h) icon sheet at 1× (Reality R11)
  const icons = {
    w: 430,
    h: 200,
    crops: [],
    async draw(ctx, w, h) {
      ctx.fillStyle = "#241F48";
      ctx.fillRect(0, 0, w, h);
      const list = [["gear", "Settings"], ["rules", "Rules"], ["jar", "Village"], ["today", "Today"], ["undo", "Undo"], ["magnifier", "Hint"], ["letter", "Letters"], ["back", "Back"], ["camera", "Photo"], ["album", "Album"]];
      list.forEach(([k, cap], i) => {
        const x = 42 + (i % 5) * 86, y = 50 + Math.floor(i / 5) * 92;
        K.disc(ctx, x, y, 44, (c, cx, cy, sz, col) => (k === "today" ? K.ICON.today(c, cx, cy + 1, sz, col, 17) : K.ICON[k](c, cx, cy, sz, col)), cap, { attn: k === "magnifier", badge: k === "letter" });
      });
    },
  };

  window.Scenes = { pilot, village: villageV2, villageV1: village, dialog, icons, room, gift, board: boardV2, boardV1: board, puzzle, _helpers: { wick, FR, img, roomSlice } };
})();
