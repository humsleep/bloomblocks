# Audio (src/audio/)

100% synthesized with the Web Audio API — no sample files. One scale (D major pentatonic), one lazily created `AudioContext`.

## API (`src/audio/cues.ts`)

```ts
initAudio(): void                         // call once at boot; idempotent; arms first-gesture unlock + lifecycle listeners, no audio work
playCue(name, opts?): void                // 'tap'|'place'|'spread'|'remove'|'invalid'|'nearComplete'|'complete'|'nextLevel'|'stoneTap'
setMuted(m: boolean): void                // fade + AudioContext.suspend() (0 audio CPU); persisting the setting is the UI's job
setAmbient(level: 0|1|2|3): void          // 0 off, 1 wind, 2 + crickets, 3 + distant water (2.5 s cross-fades)
pitchIndexForCell(x, y, h): number        // suggested pitch mapping: (h-1-y)+x → 0..14
unlockAudio(): void                       // only for code already inside a gesture handler (used by the Sfx shim)
audioState()                              // {muted, ambient, context, voices} for settings/diagnostics
```

`opts`: `pitchIndex` (0 = A3 … 14 = F#6), `litCount` (cells newly lit by this placement),
`sequence` (`complete`: pitch indices in placement order; `invalid`: the two conflicting lanterns).

### What the UI calls, when
| Moment | Call |
| --- | --- |
| boot | `initAudio()`; `setMuted(pref)`; `setAmbient(chapterLevel)` |
| place lantern | `playCue('place', {pitchIndex, litCount})` **and** `playCue('spread', {pitchIndex, litCount})` |
| place creates a conflict | additionally `playCue('invalid', {sequence: [pA, pB]})` (muted tok + soft minor-second beating) |
| remove lantern | `playCue('remove', {pitchIndex})` (also releases the near-complete pad) |
| illegal tap | `playCue('invalid')` |
| tap on stone | `playCue('stoneTap')` |
| generic UI button | `playCue('tap')` |
| one lantern / few cells short | `playCue('nearComplete')` (idempotent; call again after a remove if still near) |
| solved | `playCue('complete', {sequence: pitchIndexOfEachLanternInPlacementOrder})` |
| next level transition | `playCue('nextLevel')` |

`src/audio/Sfx.ts` is a deprecated shim so the current `main.ts` keeps working (`place/remove/deny/win/unlock` → cues).

## Cue synthesis
- **tap** — D6 sine blip (60 ms) + 10 ms 4 kHz noise grain.
- **place** — sine "tok" on the lantern's note with a 12 ms downward pitch blip, wood 2nd mode (×2.76), contact click, then a band-passed noise "match-breath"; an octave triangle glow whose low-pass opens (and level rises) with `litCount`.
- **spread** — one glass chime per lit cell (sine + ×2.76 partial), ascending the pentatonic from an octave above the lantern, 40 ms apart, max 10.
- **remove** — octave-down triangle gliding down a fourth, low-passed, plus a tiny "blown-out" puff (≈ −4.5 LU / −8.5 dB peak vs place).
- **invalid** — low-passed E3 tok, 55 ms. With `sequence:[a,b]`: two sines a minor second apart in 196–392 Hz, 150 ms attack, 1 s total.
- **stoneTap** — high-band noise gated by 4–6 random micro-bursts within 140 ms (leaf rustle).
- **nearComplete** — warm D add9 pad (8 detuned sines + slow LFO low-pass) fades in, ambient bus +3 dB, both over 800 ms; auto-releases after 24 s.
- **complete** — each lantern's note in placement order (50–130 ms apart, ≤ 16 notes, ~0.6–0.9 s), then a strummed warm D chord (D3 A3 D4 F#4 A4 E5) ringing 2.4 s; pad released.
- **nextLevel** — noise through a band-pass sweeping 320→1500→520 Hz, panning L→R, 1.25 s.
- **ambient** — wind: 2 looped brown-noise voices with random band/gain/rate gusts (2–6 s); crickets: 3 fixed "bugs" (4.3–5.1 kHz) with 3–5-pulse chirps and random rests; water: low-passed brown-noise stream + Poisson bubble grains. Everything randomized → no audible loop.

## Levels (offline-measured through the shipping graph, "Measure levels" on the DEV page)
| | peak dBFS | max momentary LUFS |
| --- | --- | --- |
| place (dim → bright) | −7.2 | −25 → −21 |
| complete (7 / 16 notes) | −9.7 / −9.3 | −17.6 / −15.9 |
| ambient 1 / 2 / 3 (integrated) | −25 / −24 / −23 | −38 / −37 / −35 |
| worst cascade (24 cues in 600 ms, limiter bypassed) | −6.5 | −15 |

Mixer: `sfx(+10 dB) / amb / pad → mix(−3 dB) → DynamicsCompressor (−16 dB, 10:1, 2 ms) → trim(−4 dB) → fader → out`.
The fader sits after the compressor so mute/background fades never pump.

## Engineering notes
- **Cold start:** `cues.ts` (eager, ~2 KB) only stores state and adds listeners. The AudioContext is created inside the first gesture (`pointerdown`/`pointerup`/`touchend`/`keydown`, capture phase, so it runs before Phaser's handler); the synth code (`runtime.ts`, 12 KB) is a separate chunk imported then. Cues fired while it loads are queued (≤ 400 ms) and played on arrival. A muted player never creates a context.
- **Voices:** cap 12; when full, steal the lowest-priority oldest voice with a 25 ms fade (`complete`/`nextLevel` are never stolen by lesser cues). Ambient/pad are not counted.
- **Allocations:** white noise (2 s) is generated once per context, brown noise (3.1 s) only when an ambient layer first starts; cues only create small nodes.
- **CPU:** cues are ≤ 2–3 oscillators each (complete ≈ 44 short-lived oscillators once). Ambient level 3 ≈ 3 looping sources + ~6 grain oscillators/s; scheduler is one 200 ms timer with 600 ms lookahead, and it stops when ambient is 0, muted or backgrounded.
- **Background:** `visibilitychange` and Capacitor `App` `pause`/`resume` → 40 ms fade, then `suspend()`; on return `resume()` + 300 ms fade-in. If WebKit refuses to resume without a gesture (or the context was `interrupted` by a call/Siri), the next tap resumes it.

## iOS silent switch / other apps' audio
On first unlock we set `navigator.audioSession.type = "ambient"` (WebKit Audio Session API, iOS 17+). Effect:
- **Silent (ring) switch on → the game is silent.** That is intended for players in public places. No `<audio>` element hack is used to bypass it.
- **The player's own music/podcast keeps playing**; our sounds mix on top instead of interrupting it.
- Without the API (older WebKit), WKWebView's Web Audio default already behaves like the ambient category (respects the switch).
- Capacitor does not set an `AVAudioSession` category natively; if a native plugin (e.g. an ad SDK) changes it, this behaviour can change — verify on device.

## DEV audition
`npm run dev`, then open `/src/audio/dev/audition.html` (from the simulator: Safari → `http://localhost:5174/src/audio/dev/audition.html`).
Buttons for every cue (with pitch / litCount / sequence controls), "Play all cues", mute, ambient 0–3, and "Measure levels" (offline render + LUFS table).
In the game page (DEV only) `window.__lanternAudio.demo()` plays the full tour; `playCue/setMuted/setAmbient/state` are also exposed. Nothing of this ships in release builds.
