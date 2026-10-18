// The "village is opening" veil: a Village tap whose first frame still needs work (code, data, backdrop) answers at
// once with the night coming in and the village lantern lighting up. It is a DOM layer on purpose: opacity /
// transform CSS animations run on the compositor, so they stay smooth and cost the busy main thread nothing —
// a Phaser tween here made the game step at full rate and starved the very loading it covers (measured, 4× CPU).

const ID = "village-veil";
const CSS = `#${ID}{position:fixed;inset:0;z-index:5;pointer-events:none;background:#060716;opacity:0;transition:opacity .16s ease-out}
#${ID}.on{opacity:.94}
#${ID}.off{opacity:0;transition:opacity .22s ease-in}
#${ID} .glow{position:absolute;left:50%;top:calc(50% - 16px);width:300px;height:300px;margin:-150px 0 0 -150px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,100,.55) 0%,rgba(255,170,90,.22) 38%,rgba(255,170,90,0) 70%);opacity:.7;will-change:transform,opacity;animation:vv-breathe 1.8s ease-in-out infinite alternate}
#${ID} svg{position:absolute;left:50%;top:calc(50% - 16px);width:64px;height:64px;margin:-32px 0 0 -32px;will-change:transform,opacity;animation:vv-rise .5s ease-out both}
#${ID}.still .glow,#${ID}.still svg{animation:none}
@keyframes vv-breathe{from{transform:scale(.72);opacity:.45}to{transform:scale(1.12);opacity:.95}}
@keyframes vv-rise{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}`;
const LANTERN =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1B1B3A" stroke="#F4D38A" stroke-opacity=".55" stroke-width="2"/>' +
  '<path d="M27 16h10v4H27z" fill="#C9966A"/><path d="M23 22h18q5 10 0 20H23q-5-10 0-20z" fill="#FFC864"/>' +
  '<path d="M27 25h10q3 7 0 14H27q-3-7 0-14z" fill="#FFF4D6"/><rect x="26" y="42" width="12" height="4" rx="1.5" fill="#C9966A"/></svg>';

let el: HTMLElement | null = null;

/** Show the veil now (idempotent). `still`: no looping motion (reduced motion). */
export function showVillageVeil(still: boolean): void {
  if (el || typeof document === "undefined") return;
  if (!document.getElementById(`${ID}-css`)) {
    const st = document.createElement("style");
    st.id = `${ID}-css`;
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const d = document.createElement("div");
  d.id = ID;
  d.setAttribute("aria-hidden", "true");
  if (still) d.className = "still";
  d.innerHTML = `<div class="glow"></div>${LANTERN}`;
  document.body.appendChild(d);
  el = d;
  // one frame later so the opacity transition runs (not a style jump)
  requestAnimationFrame(() => d.classList.add("on"));
}

/** Fade it out and remove it (the village's own fade-in runs over it). */
export function hideVillageVeil(): void {
  const d = el;
  if (!d) return;
  el = null;
  d.classList.remove("on");
  d.classList.add("off");
  setTimeout(() => d.remove(), 260);
}
