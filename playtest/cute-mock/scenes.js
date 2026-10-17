// Mock scenes for BENCHMARK-CUTE.md (design direction, not production code).
(function () {
  const W = window.Wick;
  const T = {
    // proposed tokens (see BENCHMARK-CUTE.md §4.3)
    skyTop: "#1E1D3F",
    skyDusk: "#3A2F63",
    skyMauve: "#7A5A8E",
    skyRose: "#D9909E",
    skyPeach: "#F6BFA2",
    hillFar: "#8A6A9E",
    hillMid: "#5F4A7E",
    hillNear: "#3B3263",
    ground: "#2A2550",
    sheet: "#2C2752",
    sheetHi: "#3A3468",
    lip: "#1E1A3D",
    paper: "#FFF3DE",
    paperLo: "#F3DFC2",
    ink: "#3B2C45",
    inkSoft: "#7A6A86",
    primary: "#FFC864",
    primaryLip: "#D9983F",
    cream: "#FFF3DE",
    pink: "#F6A7B8",
    mint: "#A8DCC8",
    lilac: "#C9B6F0",
    lemon: "#FFE59A",
    tileDark: "#2F2A57",
    tileDarkHi: "#3A3466",
    litA: "#FBD48E",
    litB: "#E9A963",
    wall: "#46396C",
    wallRim: "#F2A7B8",
    roof: "#2A2148",
  };

  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }

  // ---------- UI kit ----------
  function chunkyCircle(cx, cy, d, icon, opt = {}) {
    const r = d / 2;
    const face = opt.face || T.sheetHi;
    const lip = opt.lip || T.lip;
    return `<g>
      <ellipse cx="${cx}" cy="${cy + r + 5}" rx="${r * 0.9}" ry="5" fill="#0A081E" opacity=".28"/>
      <circle cx="${cx}" cy="${cy + 4}" r="${r}" fill="${lip}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${face}"/>
      <path d="M${cx - r * 0.62} ${cy - r * 0.5} A${r * 0.8} ${r * 0.8} 0 0 1 ${cx + r * 0.2} ${cy - r * 0.78}" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      ${icon}
    </g>`;
  }
  function pill(x, y, w, h, content, opt = {}) {
    const face = opt.face || T.primary;
    const lip = opt.lip || T.primaryLip;
    const r = h / 2;
    const ghost = opt.ghost;
    return `<g>
      <rect x="${x + 6}" y="${y + h + 2}" width="${w - 12}" height="8" rx="4" fill="#0A081E" opacity=".25"/>
      ${ghost ? "" : `<rect x="${x}" y="${y + 4}" width="${w}" height="${h}" rx="${r}" fill="${lip}"/>`}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${ghost ? "rgba(255,243,222,.08)" : face}" ${ghost ? `stroke="rgba(255,243,222,.4)" stroke-width="2"` : ""}/>
      ${ghost ? "" : `<rect x="${x + 14}" y="${y + 5}" width="${w - 28}" height="${h * 0.3}" rx="${h * 0.15}" fill="#FFFFFF" opacity=".28"/>`}
      ${content}
    </g>`;
  }
  const stroke = (d, col = T.cream, w = 2.6) => `<path d="${d}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  const icons = {
    town: (cx, cy) =>
      stroke(`M${cx - 13} ${cy + 8} L${cx - 13} ${cy - 1} L${cx - 6} ${cy - 8} L${cx + 1} ${cy - 1} L${cx + 6} ${cy - 6} L${cx + 13} ${cy + 1} L${cx + 13} ${cy + 8} Z`) +
      `<rect x="${cx - 8.5}" y="${cy + 1}" width="4.5" height="4.5" rx="1.2" fill="${T.primary}"/>`,
    undo: (cx, cy) => stroke(`M${cx - 9} ${cy - 5} L${cx - 12} ${cy - 11} M${cx - 9} ${cy - 5} L${cx - 3} ${cy - 7} M${cx - 9} ${cy - 5} A11 11 0 1 1 ${cx - 10} ${cy + 5}`),
    hint: (cx, cy) =>
      `<circle cx="${cx - 2}" cy="${cy - 2}" r="8" stroke="${T.cream}" stroke-width="2.6" fill="rgba(255,243,222,.14)"/>` +
      stroke(`M${cx + 4} ${cy + 4} L${cx + 10} ${cy + 10}`, T.cream, 3.2) +
      `<circle cx="${cx + 13}" cy="${cy - 13}" r="5" fill="${T.primary}" stroke="${T.sheetHi}" stroke-width="2"/>`,
    gear: (cx, cy) => {
      let d = "";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        d += `M${cx + Math.cos(a) * 7.5} ${cy + Math.sin(a) * 7.5} L${cx + Math.cos(a) * 11} ${cy + Math.sin(a) * 11} `;
      }
      return stroke(d, T.cream, 3.4) + `<circle cx="${cx}" cy="${cy}" r="7" stroke="${T.cream}" stroke-width="2.6" fill="none"/><circle cx="${cx}" cy="${cy}" r="2.4" fill="${T.cream}"/>`;
    },
    share: (cx, cy, col = T.ink) => stroke(`M${cx} ${cy + 3} L${cx} ${cy - 11} M${cx - 6} ${cy - 5} L${cx} ${cy - 11} L${cx + 6} ${cy - 5} M${cx - 9} ${cy - 2} L${cx - 9} ${cy + 9} L${cx + 9} ${cy + 9} L${cx + 9} ${cy - 2}`, col, 2.8),
    home: (cx, cy, col = T.cream) =>
      stroke(`M${cx - 10} ${cy - 1} L${cx} ${cy - 10} L${cx + 10} ${cy - 1} M${cx - 7} ${cy - 3} L${cx - 7} ${cy + 9} L${cx + 7} ${cy + 9} L${cx + 7} ${cy - 3}`, col, 2.8) +
      `<rect x="${cx - 2.5}" y="${cy + 1}" width="5" height="5" rx="1.2" fill="${T.primary}"/>`,
  };
  function calendarChip(x, y, day) {
    return `<g>
      <rect x="${x + 2}" y="${y + 6}" width="46" height="54" rx="12" fill="#0A081E" opacity=".25"/>
      <rect x="${x}" y="${y + 4}" width="46" height="54" rx="12" fill="${T.paperLo}"/>
      <rect x="${x}" y="${y}" width="46" height="54" rx="12" fill="${T.paper}"/>
      <path d="M${x} ${y + 12} a12 12 0 0 1 12 -12 h22 a12 12 0 0 1 12 12 v6 h-46 z" fill="${T.sheetHi}"/>
      <circle cx="${x + 23}" cy="${y + 9.5}" r="6" fill="${T.cream}"/><circle cx="${x + 26}" cy="${y + 8}" r="5.4" fill="${T.sheetHi}"/>
      <text x="${x + 23}" y="${y + 47}" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="22" fill="${T.ink}">${day}</text>
    </g>`;
  }

  // ---------- scenery ----------
  function sky(w, h, horizon, seed = 7) {
    const r = rng(seed);
    let stars = "";
    for (let i = 0; i < 60; i++) {
      const x = r() * w,
        y = r() * horizon * 0.62,
        s = r() < 0.12 ? 1.8 : 0.9 + r() * 0.6;
      stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" fill="#FFF3DE" opacity="${(0.35 + r() * 0.55).toFixed(2)}"/>`;
    }
    stars += W.sparkle(70, 120, 6, "#FFF3DE", 0.8) + W.sparkle(300, 190, 5, "#FFF3DE", 0.7) + W.sparkle(150, 80, 4, "#FFF3DE", 0.6);
    return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${T.skyTop}"/><stop offset="${(0.42 * horizon) / h}" stop-color="${T.skyDusk}"/>
      <stop offset="${(0.75 * horizon) / h}" stop-color="${T.skyMauve}"/><stop offset="${(0.93 * horizon) / h}" stop-color="${T.skyRose}"/>
      <stop offset="${horizon / h}" stop-color="${T.skyPeach}"/><stop offset="1" stop-color="${T.skyPeach}"/></linearGradient>
      <radialGradient id="moonGlow"><stop offset="0" stop-color="#FFF3DE" stop-opacity=".35"/><stop offset="1" stop-color="#FFF3DE" stop-opacity="0"/></radialGradient>
      <radialGradient id="winGlow"><stop offset="0" stop-color="#FFD98A" stop-opacity=".38"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
      <mask id="moonMask"><rect width="${w}" height="${h}" fill="white"/><circle cx="${w - 72}" cy="88" r="20" fill="black"/></mask></defs>
      <rect width="${w}" height="${h}" fill="url(#sky)"/>${stars}
      <circle cx="${w - 80}" cy="96" r="60" fill="url(#moonGlow)"/>
      <circle cx="${w - 80}" cy="96" r="22" fill="#FFF3DE" mask="url(#moonMask)"/>`;
  }
  function hills(w, y) {
    return `<path d="M0 ${y - 30} C80 ${y - 60} 160 ${y - 40} 230 ${y - 52} C300 ${y - 64} 380 ${y - 44} ${w} ${y - 58} L${w} ${y + 40} L0 ${y + 40} Z" fill="${T.hillFar}"/>
      <path d="M0 ${y - 8} C90 ${y - 30} 170 ${y - 14} 250 ${y - 24} C330 ${y - 34} 390 ${y - 18} ${w} ${y - 26} L${w} ${y + 40} L0 ${y + 40} Z" fill="${T.hillMid}"/>
      ${[30, 66, 352, 396].map((x, i) => `<g opacity=".9"><path d="M${x - 9} ${y - 18 - (i % 2) * 6} l9 -9 l9 9 v12 h-18 z" fill="${T.hillNear}"/><rect x="${x - 3}" y="${y - 14 - (i % 2) * 6}" width="5" height="5" rx="1" fill="${i % 2 ? T.primary : "#E8A0A8"}" opacity=".9"/></g>`).join("")}
      <path d="M0 ${y + 8} C110 ${y - 6} 300 ${y - 6} ${w} ${y + 8} L${w} ${y + 80} L0 ${y + 80} Z" fill="${T.hillNear}"/>`;
  }
  function stringLights(x0, x1, y, n, lit) {
    let s = `<path d="M${x0} ${y} Q${(x0 + x1) / 2} ${y + 22} ${x1} ${y}" stroke="#1A1636" stroke-width="1.6" fill="none" opacity=".8"/>`;
    const cols = [T.primary, T.pink, T.mint, T.lemon, T.lilac];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t;
      const yy = y + 22 * 2 * t * (1 - t) * 1.0 + 4;
      const on = i < lit;
      const c = cols[i % cols.length];
      s += `${on ? `<circle cx="${x}" cy="${yy + 6}" r="11" fill="${c}" opacity=".22"/>` : ""}
        <rect x="${x - 1}" y="${yy - 2}" width="2" height="4" fill="#1A1636"/>
        <rect x="${x - 5.5}" y="${yy + 1}" width="11" height="12" rx="4.5" fill="${on ? c : "#6A5E8E"}" opacity="${on ? 1 : 0.7}"/>
        <rect x="${x - 6.5}" y="${yy}" width="13" height="2.6" rx="1.3" fill="#2A2148"/>`;
    }
    return s;
  }
  function flowerBox(x, y, w) {
    const r = rng(x * 13 + y);
    let s = `<rect x="${x}" y="${y}" width="${w}" height="7" rx="3" fill="#7A5640"/>`;
    for (let i = 0; i < 5; i++) {
      const fx = x + 5 + (i * (w - 10)) / 4;
      const col = [T.pink, T.lemon, "#FFFFFF", T.pink, T.lilac][i];
      s += `<circle cx="${fx}" cy="${y - 2 - r() * 3}" r="${3 + r()}" fill="#6FA287"/><circle cx="${fx + 1}" cy="${y - 5 - r() * 2}" r="2.6" fill="${col}"/>`;
    }
    return s;
  }
  function windowLit(x, y, w, h, on, curtain = true) {
    return `<g>
      ${on ? `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w}" ry="${h * 0.9}" fill="url(#winGlow)"/>` : ""}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.42}" ry="${w * 0.42}" fill="${on ? "#FFE3A0" : "#57497F"}"/>
      ${on ? `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="${w * 0.36}" fill="#FFF6DC" opacity=".55"/>` : ""}
      ${on && curtain ? `<path d="M${x + 2} ${y + 6} Q${x + w * 0.3} ${y + h * 0.4} ${x + 3} ${y + h - 4} L${x + 2} ${y + h - 4} Z" fill="${T.pink}" opacity=".85"/><path d="M${x + w - 2} ${y + 6} Q${x + w * 0.7} ${y + h * 0.4} ${x + w - 3} ${y + h - 4} L${x + w - 2} ${y + h - 4} Z" fill="${T.pink}" opacity=".85"/>` : ""}
      <path d="M${x + w / 2} ${y + 2} V${y + h - 2} M${x + 2} ${y + h * 0.55} H${x + w - 2}" stroke="#2A2148" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.42}" fill="none" stroke="#2A2148" stroke-width="2.6"/>
    </g>`;
  }
  function cat(x, y, s, col = "#F6E3C8", spot = "#E89B6B") {
    // loaf cat, eyes closed (content)
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="16" rx="18" ry="3" fill="#0A081E" opacity=".3"/>
      <path d="M-17 15 C-19 2 -12 -6 0 -6 C12 -6 19 2 17 15 Z" fill="${col}"/>
      <path d="M14 12 C22 12 24 4 20 0" stroke="${col}" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M-11 -2 L-13 -14 L-5 -7 Z M11 -2 L13 -14 L5 -7 Z" fill="${col}"/>
      <path d="M-11.5 -4 L-12 -10 L-7.5 -6.5 Z" fill="#F7A3A0"/>
      <path d="M2 -6 C6 -6 9 -3 10 0 C6 0 3 -2 2 -6 Z" fill="${spot}"/>
      <path d="M-8 3 Q-5.5 5 -3 3 M3 3 Q5.5 5 8 3" stroke="#3B2C45" stroke-width="1.6" stroke-linecap="round" fill="none"/>
      <circle cx="0" cy="6" r="1" fill="#E07A80"/>
      <ellipse cx="-10" cy="7" rx="2.6" ry="1.4" fill="#F7A3A0" opacity=".8"/><ellipse cx="10" cy="7" rx="2.6" ry="1.4" fill="#F7A3A0" opacity=".8"/>
    </g>`;
  }
  function house(cx, base, wd) {
    const x0 = cx - wd / 2,
      x1 = cx + wd / 2,
      top = base - 190;
    return `<g>
      <circle cx="${cx + 52}" cy="${top - 62}" r="7" fill="#FFF3DE" opacity=".18"/><circle cx="${cx + 60}" cy="${top - 80}" r="9" fill="#FFF3DE" opacity=".13"/><circle cx="${cx + 70}" cy="${top - 100}" r="11" fill="#FFF3DE" opacity=".08"/>
      <rect x="${cx + 38}" y="${top - 58}" width="22" height="40" rx="4" fill="${T.roof}"/>
      <rect x="${x0}" y="${top}" width="${wd}" height="190" rx="10" fill="${T.wall}"/>
      <rect x="${x1 - 6}" y="${top + 6}" width="4" height="178" rx="2" fill="${T.wallRim}" opacity=".55"/>
      <path d="M${x0 - 18} ${top + 8} Q${x0 - 18} ${top - 2} ${x0 - 8} ${top - 8} L${cx - 10} ${top - 82} Q${cx} ${top - 90} ${cx + 10} ${top - 82} L${x1 + 8} ${top - 8} Q${x1 + 18} ${top - 2} ${x1 + 18} ${top + 8} Z" fill="${T.roof}"/>
      <path d="M${cx + 10} ${top - 80} L${x1 + 10} ${top - 6}" stroke="${T.wallRim}" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>
      ${windowLit(cx - 18, top - 50, 36, 34, true, false)}
      ${windowLit(x0 + 22, top + 26, 40, 50, true)}${flowerBox(x0 + 18, top + 80, 48)}
      ${windowLit(x1 - 62, top + 26, 40, 50, false)}${flowerBox(x1 - 66, top + 80, 48)}
      <path d="M${cx - 24} ${base} V${base - 62} Q${cx - 24} ${base - 88} ${cx} ${base - 88} Q${cx + 24} ${base - 88} ${cx + 24} ${base - 62} V${base} Z" fill="#2A2148"/>
      <rect x="${cx - 17}" y="${base - 74}" width="34" height="22" rx="11" fill="${T.paper}"/>
      <text x="${cx}" y="${base - 57.5}" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="16" fill="${T.ink}">14</text>
      <circle cx="${cx + 15}" cy="${base - 36}" r="2" fill="${T.primary}"/>
      <g><rect x="${x0 + 14}" y="${base - 26}" width="20" height="18" rx="5" fill="#C27A5A"/><circle cx="${x0 + 24}" cy="${base - 34}" r="11" fill="#6FA287"/><circle cx="${x0 + 18}" cy="${base - 38}" r="3" fill="${T.pink}"/><circle cx="${x0 + 29}" cy="${base - 31}" r="3" fill="${T.lemon}"/></g>
      ${cat(x1 - 30, top - 15, 0.95)}
    </g>`;
  }

  // ---------- board ----------
  const STONE = "M-0.42 0.05 C-0.44 -0.22 -0.22 -0.38 0.02 -0.37 C0.27 -0.36 0.43 -0.2 0.42 0.04 C0.41 0.27 0.22 0.4 -0.02 0.39 C-0.25 0.38 -0.4 0.26 -0.42 0.05 Z";
  function stone(cx, cy, cs, n, opt = {}) {
    const s = cs;
    const pale = n !== null && n !== undefined;
    const g = `st${Math.round(cx)}_${Math.round(cy)}`;
    return `<g>
      <defs><radialGradient id="${g}" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="${pale ? "#F3F1FA" : "#9A94B8"}"/><stop offset="0.6" stop-color="${pale ? "#CFCBE2" : "#6F6990"}"/><stop offset="1" stop-color="${pale ? "#8F88AE" : "#463F66"}"/></radialGradient></defs>
      <path transform="translate(${cx + 2} ${cy + 5}) scale(${s})" d="${STONE}" fill="#0A081E" opacity=".35"/>
      <path transform="translate(${cx} ${cy}) scale(${s})" d="${STONE}" fill="url(#${g})"/>
      <path transform="translate(${cx} ${cy}) scale(${s})" d="M-0.36 0.18 C-0.25 0.33 0.1 0.38 0.3 0.25 C0.2 0.36 -0.2 0.4 -0.36 0.18 Z" fill="#7FA678" opacity=".85"/>
      ${pale ? `<text x="${cx}" y="${cy + s * 0.17}" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="${s * 0.5}" fill="${T.ink}">${n}</text>` : ""}
      ${opt.done ? `<path transform="translate(${cx} ${cy}) scale(${s * 1.08})" d="${STONE}" fill="none" stroke="#FFC864" stroke-width="${2.6 / (s * 1.08)}" opacity=".9"/>` : ""}
      ${opt.sprout ? `<g transform="translate(${cx + s * 0.18} ${cy - s * 0.33})"><path d="M0 2 V-6" stroke="#6FA287" stroke-width="2" stroke-linecap="round"/><path d="M0 -4 C-7 -10 -10 -3 -1 -2 Z" fill="#8CC79F"/><path d="M0 -6 C6 -13 10 -5 1 -4 Z" fill="#A8DCC8"/></g>` : ""}
    </g>`;
  }
  function board(x, y, size, n, spec) {
    const pad = 14,
      gap = 5;
    const cs = (size - pad * 2 - gap * (n - 1)) / n;
    let s = `<defs><linearGradient id="litg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.litA}"/><stop offset="1" stop-color="${T.litB}"/></linearGradient></defs>
      <rect x="${x}" y="${y + 8}" width="${size}" height="${size}" rx="30" fill="#1C1838"/>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="30" fill="#433C72"/>
      <rect x="${x + 8}" y="${y + 8}" width="${size - 16}" height="${size - 16}" rx="24" fill="#231F45"/>`;
    // moss tufts on the rim
    const r = rng(3);
    for (let i = 0; i < 9; i++) s += `<circle cx="${x + 20 + r() * (size - 40)}" cy="${r() < 0.5 ? y + 4 : y + size - 4}" r="${2 + r() * 2}" fill="#7FA678" opacity=".8"/>`;
    const at = (c, rr) => [x + pad + c * (cs + gap), y + pad + rr * (cs + gap)];
    for (let rr = 0; rr < n; rr++)
      for (let c = 0; c < n; c++) {
        const [cx, cy] = at(c, rr);
        const lit = spec.lit.has(rr * n + c);
        s += lit
          ? `<rect x="${cx}" y="${cy}" width="${cs}" height="${cs}" rx="14" fill="url(#litg)"/><rect x="${cx + 4}" y="${cy + 3}" width="${cs - 8}" height="5" rx="2.5" fill="#FFFFFF" opacity=".35"/>`
          : `<rect x="${cx}" y="${cy}" width="${cs}" height="${cs}" rx="14" fill="${T.tileDark}"/><rect x="${cx + 4}" y="${cy + 3}" width="${cs - 8}" height="4" rx="2" fill="${T.tileDarkHi}" opacity=".8"/>`;
      }
    for (const st of spec.stones) {
      const [cx, cy] = at(st.c, st.r);
      s += stone(cx + cs / 2, cy + cs / 2, cs, st.n, st);
    }
    for (const l of spec.lanterns) {
      const [cx, cy] = at(l.c, l.r);
      const k = cs * 1.02;
      s += W.lantern(l.e || "idle", { x: cx + (cs - k) / 2, y: cy + (cs - k) / 2 - 2, size: k, look: l.look, squash: l.squash, lean: l.lean, coral: l.coral });
      if (l.sparkle) s += W.sparkle(cx + cs - 6, cy + 8, 7, "#FFF3DE") + W.sparkle(cx + 8, cy + 14, 4, "#FFF3DE", 0.8) + W.sparkle(cx + cs - 2, cy + cs * 0.55, 4, T.lemon, 0.9);
    }
    return s;
  }

  // ---------- screens ----------
  const PW = 430,
    PH = 932;
  function playScene(o = {}) {
    const lit = new Set([0, 1, 2, 3, 4, 5, 8, 9]);
    const spec = {
      lit,
      stones: [
        { r: 1, c: 1 },
        { r: 1, c: 2, n: 0, done: true, sprout: true },
        { r: 2, c: 0, n: 2 },
        { r: 2, c: 4, n: 3 },
        { r: 3, c: 2 },
        { r: 3, c: 3, n: 3 },
      ],
      lanterns: [
        { r: 0, c: 1, e: "happy" },
        { r: 1, c: 0, e: "idle", look: [0.8, 0.5] },
        { r: 1, c: 4, e: "happy", squash: true, sparkle: true },
      ],
    };
    return `${sky(PW, PH, 400)}
      ${stringLights(60, 370, 122, 10, 4)}
      ${hills(PW, 410)}
      ${house(215, 428, 200)}
      <rect x="0" y="440" width="${PW}" height="${PH - 440}" fill="${T.ground}"/>
      <path d="M0 444 C120 432 310 432 ${PW} 444 L${PW} 456 L0 456 Z" fill="${T.hillNear}"/>
      <ellipse cx="215" cy="452" rx="30" ry="7" fill="#5F587F"/><ellipse cx="215" cy="470" rx="34" ry="8" fill="#5F587F"/>
      ${W.wick("curious", { x: 178, y: 384, size: 74, look: [1.2, 1.6] })}
      ${chunkyCircle(28, 62, 44, icons.gear(28, 62))}
      ${chunkyCircle(52, 476, 54, icons.town(52, 476))}
      ${calendarChip(98, 446, 17)}
      ${chunkyCircle(310, 476, 54, icons.undo(312, 478))}
      ${chunkyCircle(376, 476, 54, icons.hint(376, 476))}
      ${board(20, 526, 390, 5, spec)}`;
  }

  function resultScene() {
    const r = rng(11);
    let petals = "";
    const cols = [T.pink, T.lemon, T.mint, T.lilac, "#FFFFFF"];
    for (let i = 0; i < 16; i++) petals += W.petal(40 + r() * 350, 70 + r() * 260, 0.9 + r() * 0.7, r() * 360, cols[i % cols.length]);
    // mini solved board for the postcard
    const mini = (x, y, s) => {
      const n = 5,
        cs = s / n;
      let m = `<rect x="${x - 4}" y="${y - 4}" width="${s + 8}" height="${s + 8}" rx="12" fill="#433C72"/>`;
      const stones = new Set([6, 7, 10, 14, 17, 18]);
      const lan = new Set([1, 5, 9, 13, 20, 23]);
      for (let i = 0; i < 25; i++) {
        const cx = x + (i % n) * cs,
          cy = y + Math.floor(i / n) * cs;
        m += stones.has(i)
          ? `<rect x="${cx + 1.5}" y="${cy + 1.5}" width="${cs - 3}" height="${cs - 3}" rx="5" fill="#2F2A57"/><circle cx="${cx + cs / 2}" cy="${cy + cs / 2}" r="${cs * 0.32}" fill="#CFCBE2"/>`
          : `<rect x="${cx + 1.5}" y="${cy + 1.5}" width="${cs - 3}" height="${cs - 3}" rx="5" fill="url(#litg2)"/>`;
        if (lan.has(i)) m += W.lantern("happy", { x: cx - 1, y: cy - 2, size: cs + 2, glow: false });
      }
      return m;
    };
    const stamp = (x, y) => {
      let edge = "";
      const w = 92,
        h = 108;
      for (let i = 0; i <= 8; i++) edge += `<circle cx="${x + (i * w) / 8}" cy="${y}" r="4" fill="${T.paper}"/><circle cx="${x + (i * w) / 8}" cy="${y + h}" r="4" fill="${T.paper}"/>`;
      for (let i = 0; i <= 9; i++) edge += `<circle cx="${x}" cy="${y + (i * h) / 9}" r="4" fill="${T.paper}"/><circle cx="${x + w}" cy="${y + (i * h) / 9}" r="4" fill="${T.paper}"/>`;
      return `<g transform="rotate(4 ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#E9A5B4"/>${edge}
        <rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="6" fill="#3A2F63"/>
        ${W.wick("happy", { x: x + 14, y: y + 18, size: 64 })}
        <text x="${x + w / 2}" y="${y + h - 14}" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="11" fill="${T.cream}" letter-spacing="1">DUSKWICK</text></g>`;
    };
    const slot = (x, y, on, i) =>
      on
        ? `<circle cx="${x}" cy="${y}" r="15" fill="#FFE6AD"/><circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#D9983F" stroke-width="2"/>${W.wick(i === 2 ? "happy" : "sleepy", { x: x - 13, y: y - 15, size: 26, glow: false, shadow: false })}`
        : `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#C8B9A6" stroke-width="2" stroke-dasharray="3 4"/>`;
    return `${sky(PW, PH, 400, 9)}${hills(PW, 410)}${house(215, 428, 200)}
      <rect x="0" y="440" width="${PW}" height="${PH - 440}" fill="${T.ground}"/>
      <rect width="${PW}" height="${PH}" fill="#140F2C" opacity=".55"/>
      <defs><linearGradient id="litg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.litA}"/><stop offset="1" stop-color="${T.litB}"/></linearGradient>
      <radialGradient id="burst"><stop offset="0" stop-color="#FFD98A" stop-opacity=".45"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient></defs>
      <circle cx="215" cy="190" r="150" fill="url(#burst)"/>
      ${petals}
      ${W.sparkle(150, 130, 9)}${W.sparkle(290, 120, 7, T.lemon)}${W.sparkle(320, 210, 5)}${W.sparkle(110, 220, 5, T.pink)}
      ${W.wick("cheer", { x: 160, y: 120, size: 110 })}
      <g transform="rotate(-2 215 470)">
        <rect x="34" y="268" width="362" height="420" rx="24" fill="#0A081E" opacity=".35" transform="translate(4 10)"/>
        <rect x="34" y="268" width="362" height="420" rx="24" fill="${T.paper}"/>
        <rect x="46" y="280" width="338" height="396" rx="16" fill="none" stroke="#E8D4B8" stroke-width="2" stroke-dasharray="6 6"/>
        ${mini(62, 304, 170)}
        ${stamp(272, 300)}
        <g opacity=".75"><circle cx="262" cy="446" r="34" fill="none" stroke="${T.inkSoft}" stroke-width="2"/>
          <text x="262" y="442" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="12" fill="${T.inkSoft}">OCT 17</text>
          <text x="262" y="458" text-anchor="middle" font-family="Fredoka" font-weight="500" font-size="11" fill="${T.inkSoft}">#14</text>
          <path d="M300 432 q10 -6 20 0 t20 0 t20 0 M300 446 q10 -6 20 0 t20 0 t20 0 M300 460 q10 -6 20 0 t20 0 t20 0" stroke="${T.inkSoft}" stroke-width="2" fill="none"/></g>
        <line x1="62" y1="506" x2="368" y2="506" stroke="#E8D4B8" stroke-width="2"/>
        <g transform="translate(62 520)"><circle cx="13" cy="15" r="11" fill="none" stroke="${T.ink}" stroke-width="2.6"/><path d="M13 9 V15 L17 18 M10 1 H16" stroke="${T.ink}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <text x="34" y="26" font-family="Fredoka" font-weight="600" font-size="30" fill="${T.ink}">0:36</text>
          ${W.sparkle(126, 10, 8, "#E6A93F")}${W.sparkle(138, 22, 5, "#E6A93F")}</g>
        <g transform="translate(228 524)"><path d="M14 2 C20 10 24 14 24 21 A10 10 0 0 1 4 21 C4 14 9 10 14 2 Z" fill="#F4A15A"/><path d="M14 12 C17 16 19 18 19 22 A5 5 0 0 1 9 22 C9 18 11 16 14 12 Z" fill="#FFE59A"/>
          <text x="34" y="27" font-family="Fredoka" font-weight="600" font-size="30" fill="${T.ink}">3</text></g>
        <g>${[0, 1, 2, 3, 4, 5, 6].map((i) => slot(84 + i * 44, 610, i < 3, i)).join("")}</g>
        <path d="M352 594 l8 -10 l8 10 v14 h-16 z" fill="#E9A5B4"/><text x="360" y="640" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="11" fill="${T.inkSoft}">D7</text>
      </g>
      ${pill(64, 742, 190, 60, icons.share(159, 772, T.ink))}
      ${pill(272, 742, 94, 60, icons.home(319, 772), { ghost: true })}`;
  }

  window.Scenes = { T, PW, PH, playScene, resultScene, chunkyCircle, pill, icons, calendarChip, board, cat };
})();
