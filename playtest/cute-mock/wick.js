// Wick — Duskwick lantern-spirit mascot. Reference construction for the mockups.
// All geometry is in a 100×100 box; the body's ground contact is (50, 92).
// The same path strings are meant to be copied into src/render/wick.ts as Path2D constants.
(function () {
  const C = {
    body: "#FFEFC9",
    core: "#FFFBEF",
    rim: "#F2C27A",
    blush: "#F7A3A0",
    ink: "#3B2C45",
    wispA: "#FFB84D",
    wispB: "#FFE7A0",
    cream: "#FFF3DE",
    wood: "#5A3D2E",
    woodHi: "#7A5640",
  };
  const P = {
    // squat mochi-drop: wide bottom, soft tip at (50,27)
    body: "M50 27 C57 35 82 45 82 66 C82 83 68 92 50 92 C32 92 18 83 18 66 C18 45 43 35 50 27 Z",
    // wick flame tuft: grows from the tip, curls right
    wisp: "M50 31 C42 25 43 13 55 6 C52 14 59 19 55 28 C53 30 51.5 31 50 31 Z",
    // soft top-left sheen
    sheen: "M29 62 C29 51 37 44 44 42.5 C38.5 48 35.5 54 35.5 62 Z",
    // cheer / wave nubs (drawn behind the body)
    armL: "M24 60 C14 54 10 44 15 41 C19 39 25 47 29 55 Z",
    armR: "M76 60 C86 54 90 44 85 41 C81 39 75 47 71 55 Z",
  };
  let uid = 0;

  // face for the free-standing Wick (eyes at y 65)
  function face(expr, look) {
    const [lx, ly] = look;
    const ink = C.ink;
    const blush = (a) =>
      `<ellipse cx="30.5" cy="73" rx="5.6" ry="3.1" fill="${C.blush}" opacity="${a}"/><ellipse cx="69.5" cy="73" rx="5.6" ry="3.1" fill="${C.blush}" opacity="${a}"/>`;
    const ovalEyes = (rx, ry, dx = 0, dy = 0) =>
      [40, 60]
        .map(
          (x) =>
            `<ellipse cx="${x + dx}" cy="${65 + dy}" rx="${rx}" ry="${ry}" fill="${ink}"/><circle cx="${x + dx + 1.1}" cy="${65 + dy - 1.9}" r="1.25" fill="${C.core}"/>`
        )
        .join("");
    const arcs = (w = 4.6, h = 5.6, sw = 2.8) =>
      [40, 60]
        .map((x) => `<path d="M${x - w} 66 Q${x} ${66 - h} ${x + w} 66" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`)
        .join("");
    switch (expr) {
      case "happy":
        return blush(0.85) + arcs() + `<path d="M46.5 73 Q50 77.6 53.5 73" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
      case "cheer":
        return (
          blush(0.95) +
          arcs(5, 6.4, 3) +
          `<path d="M44.6 71.6 L55.4 71.6 Q55.4 80 50 80 Q44.6 80 44.6 71.6 Z" fill="${ink}"/><ellipse cx="50" cy="77.4" rx="3" ry="1.8" fill="#F08F95"/>`
        );
      case "curious":
        return (
          blush(0.6) +
          `<ellipse cx="${40 + lx}" cy="${65 + ly}" rx="3.2" ry="4.3" fill="${ink}"/><circle cx="${41.1 + lx}" cy="${63.2 + ly}" r="1.15" fill="${C.core}"/>` +
          `<ellipse cx="${60 + lx}" cy="${64.5 + ly}" rx="3.9" ry="5.1" fill="${ink}"/><circle cx="${61.2 + lx}" cy="${62.5 + ly}" r="1.3" fill="${C.core}"/>` +
          `<circle cx="51" cy="75" r="1.8" fill="${ink}"/>`
        );
      case "sleepy":
        return (
          blush(0.55) +
          [40, 60].map((x) => `<path d="M${x - 4} 65.5 Q${x} 69 ${x + 4} 65.5" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`).join("") +
          `<path d="M48 74.5 Q50 75.6 52 74.5" stroke="${ink}" stroke-width="2" stroke-linecap="round" fill="none"/>`
        );
      case "worried":
        return (
          blush(0.5) +
          [40, 60].map((x) => `<circle cx="${x + lx}" cy="${66 + ly}" r="2.9" fill="${ink}"/><circle cx="${x + lx + 0.9}" cy="${64.8 + ly}" r="0.9" fill="${C.core}"/>`).join("") +
          `<path d="M34.5 59.5 L43.5 57.2" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="M56.5 57.2 L65.5 59.5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>` +
          `<path d="M45 75.5 q2.5 -2 5 0 q2.5 2 5 0" stroke="${ink}" stroke-width="2" stroke-linecap="round" fill="none"/>`
        );
      default: // idle
        return blush(0.75) + ovalEyes(3.4, 4.6, lx, ly);
    }
  }

  /** Free-standing Wick. o: {x,y,size,look:[dx,dy],glow,squash,shadow} */
  function wick(expr = "idle", o = {}) {
    const id = "wk" + uid++;
    const size = o.size || 100;
    const look = o.look || [0, 0];
    let sx = 1,
      sy = 1,
      rot = 0,
      dy = 0;
    if (expr === "cheer") (sx = 0.94), (sy = 1.08), (dy = -5);
    if (expr === "sleepy") (sx = 1.05), (sy = 0.94);
    if (expr === "curious") rot = -8;
    if (o.squash) (sx = 1.14), (sy = 0.86);
    const ws = expr === "sleepy" ? 0.62 : expr === "cheer" ? 1.25 : 1;
    const arms = expr === "cheer" || o.wave ? `<path d="${P.armL}" fill="${C.body}" stroke="${C.rim}" stroke-width="1.2"/>${o.wave ? "" : `<path d="${P.armR}" fill="${C.body}" stroke="${C.rim}" stroke-width="1.2"/>`}` : "";
    const z =
      expr === "sleepy"
        ? `<text x="70" y="34" font-family="Fredoka" font-weight="600" font-size="11" fill="${C.cream}" opacity=".8">z</text><text x="78" y="24" font-family="Fredoka" font-weight="600" font-size="8" fill="${C.cream}" opacity=".6">z</text>`
        : "";
    return `<svg x="${o.x || 0}" y="${o.y || 0}" width="${size}" height="${size}" viewBox="0 0 100 100" overflow="visible">
  <defs>
    <radialGradient id="${id}b" cx="0.44" cy="0.58" r="0.62"><stop offset="0" stop-color="${C.core}"/><stop offset="0.55" stop-color="${C.body}"/><stop offset="1" stop-color="${C.rim}"/></radialGradient>
    <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFD98A" stop-opacity=".55"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}w" x1="0" y1="1" x2="0.3" y2="0"><stop offset="0" stop-color="${C.wispA}"/><stop offset="1" stop-color="${C.wispB}"/></linearGradient>
  </defs>
  ${o.glow === false ? "" : `<circle cx="50" cy="62" r="${expr === "sleepy" ? 36 : 48}" fill="url(#${id}g)"/>`}
  ${o.shadow === false ? "" : `<ellipse cx="50" cy="93.5" rx="${23 * sx}" ry="3.6" fill="#0A081E" opacity=".35"/>`}
  <g transform="translate(0 ${dy}) translate(50 92) rotate(${rot}) scale(${sx} ${sy}) translate(-50 -92)">
    ${arms}
    <g transform="translate(50 31) scale(${ws}) translate(-50 -31)" opacity="${expr === "sleepy" ? 0.75 : 1}"><path d="${P.wisp}" fill="url(#${id}w)"/></g>
    <path d="${P.body}" fill="url(#${id}b)" stroke="${C.rim}" stroke-width="1.2"/>
    <path d="${P.sheen}" fill="#FFFFFF" opacity=".55"/>
    ${face(expr, look)}
  </g>
  ${z}
</svg>`;
  }

  // face painted on the board lantern's paper (eyes at y 56)
  function lanternFace(expr, look) {
    const [lx, ly] = look;
    const ink = C.ink;
    const bl = (a) =>
      `<ellipse cx="36.5" cy="62.5" rx="4" ry="2.3" fill="${C.blush}" opacity="${a}"/><ellipse cx="63.5" cy="62.5" rx="4" ry="2.3" fill="${C.blush}" opacity="${a}"/>`;
    switch (expr) {
      case "happy":
        return bl(0.85) + [43, 57].map((x) => `<path d="M${x - 3.4} 57.5 Q${x} 53 ${x + 3.4} 57.5" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`).join("");
      case "worried":
        return (
          bl(0.45) +
          [43, 57].map((x) => `<circle cx="${x + lx}" cy="${57 + ly}" r="2.3" fill="${ink}"/>`).join("") +
          `<path d="M38.5 51.5 L45 50" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/><path d="M55 50 L61.5 51.5" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/>` +
          `<path d="M46.5 64.5 q1.75 -1.5 3.5 0 q1.75 1.5 3.5 0" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" fill="none"/>`
        );
      case "sleepy":
        return bl(0.5) + [43, 57].map((x) => `<path d="M${x - 3} 56.5 Q${x} 59 ${x + 3} 56.5" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" fill="none"/>`).join("");
      default:
        return bl(0.75) + [43, 57].map((x) => `<ellipse cx="${x + lx}" cy="${56.5 + ly}" rx="2.5" ry="3.3" fill="${ink}"/><circle cx="${x + lx + 0.8}" cy="${55.2 + ly}" r="0.85" fill="${C.core}"/>`).join("");
    }
  }

  /** Board lantern (icon lantern) with a face. o: {x,y,size,look,squash,lean,glow,coral} */
  function lantern(expr = "idle", o = {}) {
    const id = "ln" + uid++;
    const size = o.size || 100;
    const look = o.look || [0, 0];
    const sx = o.squash ? 1.12 : 1,
      sy = o.squash ? 0.88 : 1;
    const lean = o.lean || 0;
    return `<svg x="${o.x || 0}" y="${o.y || 0}" width="${size}" height="${size}" viewBox="0 0 100 100" overflow="visible">
  <defs>
    <radialGradient id="${id}p" cx="0.5" cy="0.5" r="0.62"><stop offset="0" stop-color="#FFFCF0"/><stop offset="0.5" stop-color="#FFE6A8"/><stop offset="1" stop-color="#F2B866"/></radialGradient>
    <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${o.coral ? "#FFB3A0" : "#FFD98A"}" stop-opacity=".7"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
  </defs>
  ${o.glow === false ? "" : `<circle cx="50" cy="55" r="50" fill="url(#${id}g)"/>`}
  <ellipse cx="50" cy="88" rx="${27 * sx}" ry="3.5" fill="#0A081E" opacity=".4"/>
  <g transform="translate(50 86) rotate(${lean}) scale(${sx} ${sy}) translate(-50 -86)">
    <path d="M38 23 C38 9 62 9 62 23" stroke="${C.wood}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <rect x="25" y="29" width="4.5" height="51" rx="2.2" fill="#4A3328"/>
    <rect x="70.5" y="29" width="4.5" height="51" rx="2.2" fill="#4A3328"/>
    <rect x="28.5" y="30" width="43" height="49" rx="17" fill="url(#${id}p)"/>
    <path d="M33 38 C35 34 39 32.5 43 32.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".6"/>
    ${lanternFace(expr, look)}
    <rect x="22" y="21" width="56" height="9.5" rx="4.6" fill="${C.woodHi}"/>
    <rect x="25" y="21.5" width="50" height="2.6" rx="1.3" fill="#9A7458" opacity=".7"/>
    <rect x="22.5" y="78" width="55" height="8" rx="4" fill="${C.woodHi}"/>
    ${o.coral ? `<rect x="26" y="28" width="48" height="53" rx="18" fill="none" stroke="#F2907A" stroke-width="2.4"/>` : ""}
  </g>
</svg>`;
  }

  /** 4-point sparkle */
  function sparkle(x, y, r, col = "#FFF3DE", a = 1) {
    const k = r * 0.28;
    return `<path d="M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r} Z" fill="${col}" opacity="${a}"/>`;
  }

  /** petal confetti (pastel, calm) */
  function petal(x, y, s, rot, col) {
    return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 -6 C4 -4 4 3 0 6 C-4 3 -4 -4 0 -6 Z" fill="${col}"/>`;
  }

  window.Wick = { C, P, wick, lantern, sparkle, petal };
})();
