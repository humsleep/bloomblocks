/** DEV audition page: npm run dev → /src/audio/dev/audition.html (also from the simulator's Safari). */
import { audioState, initAudio, playCue, setAmbient, setMuted, type CueName } from "../cues.ts";
import { playAll } from "./demo.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const status = (s: string): void => {
  const st = audioState();
  $("status").textContent = `${s} · ctx ${st.context} · voices ${st.voices} · ambient ${st.ambient}${st.muted ? " · muted" : ""}`;
};

initAudio();

const pitch = $<HTMLInputElement>("pitch");
const lit = $<HTMLInputElement>("lit");
const seq = $<HTMLInputElement>("seq");
pitch.oninput = () => ($("pitchV").textContent = pitch.value);
lit.oninput = () => ($("litV").textContent = lit.value);

const NAMES: CueName[] = ["tap", "place", "spread", "remove", "invalid", "stoneTap", "nearComplete", "complete", "nextLevel"];
for (const name of NAMES) {
  const b = document.createElement("button");
  b.textContent = name;
  b.onclick = () => {
    const sequence = seq.value.split(",").map(Number).filter(Number.isFinite);
    const opts = { pitchIndex: Number(pitch.value), litCount: Number(lit.value), sequence: name === "invalid" ? sequence.slice(0, 2) : sequence };
    if (name === "place") playCue("spread", opts);
    playCue(name, opts);
    status(name === "place" ? "place + spread" : name);
  };
  $("cues").append(b);
}

$("all").onclick = () => playAll(playCue, status);
let muted = false;
$("mute").onclick = () => {
  muted = !muted;
  setMuted(muted);
  $("mute").textContent = `Mute: ${muted ? "on" : "off"}`;
  status(muted ? "muted" : "unmuted");
};
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-amb]")) {
  b.onclick = () => {
    setAmbient(Number(b.dataset["amb"]) as 0 | 1 | 2 | 3);
    status(`ambient → ${b.dataset["amb"]}`);
  };
}

$("measure").onclick = async () => {
  status("rendering…");
  const { measureAll } = await import("./meter.ts");
  const rows = await measureAll();
  (window as unknown as Record<string, unknown>)["__meter"] = rows;
  const f = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : "—");
  $("table").innerHTML =
    "<tr><th>case</th><th>peak dBFS</th><th>max M (LUFS)</th><th>integrated (LUFS)</th></tr>" +
    rows.map((r) => `<tr><td>${r.label}</td><td>${f(r.peakDb)}</td><td>${f(r.maxMomentary)}</td><td>${f(r.integrated)}</td></tr>`).join("");
  status("measured");
};
setInterval(() => status($("status").textContent?.split(" · ")[0] ?? ""), 1000);
