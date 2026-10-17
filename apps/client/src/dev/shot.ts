// DEV ONLY (tree-shaken from release): ?shot=<name>[&level=<n>][&track=deduce] drives the
// board into a state for screenshots.
//   &track=deduce   switch to the deduce track first
//   &level=<n>      jump to level n of the current track first (empty board)
//   ?shot=empty     nothing placed
//   ?shot=mid       first half of the solution
//   ?shot=almost    solution minus its last lantern
//   ?shot=solve     full solution → finale
// (On the iOS simulator the release bundle has no hook; scripts/sim-shots.ts
// writes the same states as save files instead.)
import { solutionOf } from "../game/pipsApi.ts";
import type { LanternsScene } from "../game/LanternsScene.ts";
import type { Session } from "../game/session.ts";

export async function devShot(scene: LanternsScene, session: Session): Promise<void> {
  const q = new URLSearchParams(location.search);
  const shot = q.get("shot");
  if (q.get("track") === "deduce" && session.track !== "deduce") await session.switchTrack();
  const level = Number(q.get("level") ?? "0");
  if (Number.isInteger(level) && level >= 1 && level !== session.levelNumber) session.devJump(level);
  scene.layout();
  if (!shot || session.moves.length > 0) return;
  const sol: { x: number; y: number }[] = [];
  const bb = solutionOf(session.level) ?? { lo: 0, hi: 0 };
  for (let i = 0; i < 64; i++) if (((i < 32 ? bb.lo >>> i : bb.hi >>> (i - 32)) & 1) === 1) sol.push({ x: i & 7, y: i >> 3 });
  const tapAll = (moves: { x: number; y: number }[]): void => {
    for (const m of moves) (scene as unknown as { onCellTap(x: number, y: number): void }).onCellTap(m.x, m.y);
  };
  if (shot === "solve") tapAll(sol);
  else if (shot === "almost") tapAll(sol.slice(0, -1));
  else if (shot === "mid") tapAll(sol.slice(0, sol.length >>> 1));
}
