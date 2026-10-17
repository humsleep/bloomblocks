# Duskwick playtest harness (for AI playtesters)

Play Duskwick levels turn by turn from a shell. You are given a **code** (a
single letter) for the version of the game you test. Every command is stateless:
the whole game lives in a session JSON file whose path `new` prints. Run from the
repo root (`/Users/hyukahn/workspace/puzzle-lab`).

## Rules

`new` prints the rules for your code in one line, above the board. That line is
the whole rule text. For the codes in this round it reads:

> Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it.

How light works, on every board:

- A lantern lights its own cell and shines in 4 directions (up, down, left,
  right) until a stone or the board edge. Light passes over other lanterns.
- Two lanterns that shine on each other are in **conflict** (shown as `!`).
- A digit on a stone means exactly that many lanterns touch this stone's sides
  (the up to 4 cells directly above, below, left and right of it).
- If the status line shows `Lanterns used/limit`, use at most that many lanterns
  (older codes only).

When every rule of your code is met the level is **COMPLETE** and no further
moves are accepted on it.

## Commands

```sh
npm run -s play -- new --variant <code> --index 1      # level 1 of your code (then 2, 3, …)
npm run -s play -- new --mode daily --date 2026-10-14 --variant <code>   # the daily level of that date
npm run -s play -- move    --session <file> --cell C4  # toggle a lantern on C4 (place / remove)
npm run -s play -- show    --session <file>            # print the board again
npm run -s play -- undo    --session <file>            # revert the last toggle
npm run -s play -- hint    --session <file>            # a nudge (see below)
npm run -s play -- restart --session <file>            # remove every lantern (same level)
```

`-v` / `-s` / `-c` are short for `--variant` / `--session` / `--cell`. `new`
accepts `--out <file>` to choose the session path (default
`playtest/sessions/free-<code>-<n>-<time>.json`). Hints and undos are allowed
and counted. The daily is one level per date, the same for everyone.

Every command that has something to tell you (a hint, what your move did,
`ILLEGAL: …`) prints that message **first**, above the board.

**Hints.** If some of your lanterns have to go, the hint names one of them at a
time, the one causing the most trouble first, and how many have to go in all:
`Take back the lantern at B2 (1 of 3)`. Ask again for the next one. Otherwise it suggests one cell and the
reason, e.g. `Hint: put a lantern at C3 — look at the number at D3.` It never
suggests a cell that would conflict with your lanterns.

## Reading the board

```
    A B C D E
 1  L + + 1 #
 2  + # · · ·
```

| Symbol | Meaning |
| --- | --- |
| `#` | stone (blocks light, cannot hold a lantern) |
| `0`–`4` | stone with a number: exactly that many lanterns touch this stone's sides |
| `·` | dark floor (still needs light) |
| `+` | lit floor |
| `L` | lantern |
| `!` | lantern in conflict (it sees another lantern) |

Cells are named column letter + row number, origin top-left (`A1`). Under the
board:

- `Lanterns n` (`used/limit` when there is a limit) · `Lit lit/floor` · `Conflicts`.
- `Numbers:` every numbered stone with its state, e.g. `D1 2✓  A3 3↑  C5 1✗`:
  `✓` exactly right, `↑` needs more lanterns, `✗` too many, `⊘` needs more
  than its free sides can still take. A `0` with nothing around it shows `✓`
  from the start; that is its state, not progress.
- `Stuck:` dark cells that no allowed lantern can light any more with the
  lanterns you have now (`none` when every dark cell can still be lit), and the
  one lantern to take back first: `Stuck: B3 — take back A1`. Several cells
  stuck by the same lantern share it: `Stuck: C2, G2 — take back A1`. Only
  when no lantern is to blame does it show the cause instead: `(light from E1)`
  = light shines on the spots that could have lit the cell, `(rocks A3 C3)` =
  those numbers already have all their lanterns, both together
  `Stuck: B3 (light from E1; rocks A3 C3)`. A cell also shows here when it is
  not blocked yet but the moves that are now forced would leave it with no way
  to be lit (`Stuck: A4 — take back C7`); a number in that situation shows as a
  `Stuck number:`.
- `Stuck number:` a number that can no longer come right (`⊘` or `✗`), with
  the lantern to take back: `Stuck number: D4 (2) — take back F2`. Shown only
  when there is one.
- Your lantern list and counters.

An illegal command prints `ILLEGAL: <why>` (stone, outside the board, bad cell
name, level already complete, nothing to undo) and changes nothing. `COMPLETE`
is printed once the level is solved.

## Playtest log

The session file keeps `actions`: every command with a wall-clock timestamp
(`t`, ISO 8601), milliseconds since `new` (`ms`), the cell, the result
(`placed`, `removed`, `illegal` + `reason`, `given` for hints, …) and the board
counters after it. `createdAt` / `completedAt` bracket the solve. Please do not
edit the file by hand; think out loud in your own notes instead.
