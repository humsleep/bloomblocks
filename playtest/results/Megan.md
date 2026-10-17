# Playtest results: Megan

**Persona:** Megan, 51, Calgary (Canada). School administrator. Does sudoku and killer sudoku every day (paper on weekends, an app on weekdays) and some nonograms. Loves pure deduction. Hates guessing and puzzles with many valid answers. Patient and methodical, plays 10–15 minutes at a time, mostly in the evening.
**Play order:** C, then S, then V. Levels 1, 3, 8 and 15 of each.
**Sessions:** `/Users/hyukahn/workspace/puzzle-lab/playtest/sessions/Megan/{C,S,V}-{1,3,8,15}.json`

---

## Code C ("Use at most the shown lanterns", no numbers)

| Level | Board / budget | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| 1 | 5×5, ≤6 | Completed with 4/6 | 4 | 0 | 0 | 0 | D1 sits alone between two stones, so it had to be lit from its column. That was a nice first step. After that I could put lanterns almost anywhere. |
| 3 | 5×5, ≤7 | Completed with 5/7 | 5 | 0 | 0 | 0 | Pleasant. The corners and one-cell gaps told me where to look. Still, my C3 could just as well have been C2 or C4. |
| 8 | 6×6, ≤8 | Completed with 6/8 | 6 | 0 | 0 | 0 | Same again. I had two spare lanterns, and E3/E4 were interchangeable. It didn't feel like I'd *found* anything. |
| 15 | 7×7, ≤8 | Completed with 8/8 | 8 | 0 | 0 | 0 | This was the first one where the count mattered. Rows 2, 4 and 6 each needed a lantern, and the columns at both edges needed one each. I had to plan where those overlapped before I touched anything. It was satisfying, and it's the only C level I'd call a puzzle. |

Notes as I went: *"Level 1: 'at most 6'. I used 4. So was 4 the answer, or 6, or anything in between? ... Level 8: two lanterns left over again. Level 15: OK, now the limit is actually doing something."*

**1. What I did, in order.** On each board I first looked for the cells that only one row or one column could reach: little pockets between stones and corners. I put lanterns there first, then filled in whatever was still dark. Level 1 took four lanterns, level 3 five, level 8 six. On level 15 I worked out the full-width rows and both edge columns on paper, so to speak, and used exactly the eight allowed.

**2. Unsure moments?** Not about *what* to do. On levels 1, 3 and 8 I was unsure whether I'd *finished properly*, because I came in under the limit and several other placements would have worked too. Nothing on the screen told me whether fewer lanterns was better.

**3. How I'd solve the next level.** I'd find the cells that only one line can light, place those lanterns first, and use the lantern count to settle anything that's still open.

**4. Last vs first.** Harder, and it felt better because of it. On level 15 the limit was tight enough that I had to reason. On level 1 the limit was so loose it hardly counted.

---

## Code S (same rule text as C)

| Level | Board / budget | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| 1 | 5×5, ≤6 | Completed with 5/6 | 5 | 0 | 0 | 0 | Easy. B1 and D5 were forced by their stones, and then there was some free choice. |
| 3 | 5×5, ≤4 | Completed with 4/4 | 4 | 0 | 0 | 0 | The tight count pushed me to A1 and D4 quickly. That was good. But the last lantern could go on C5 *or* E5 and both worked. That annoyed me. |
| 8 | 6×6, ≤6 | Completed with 6/6 | 6 | 0 | 0 | 0 | I enjoyed this one. Six separate bits of the board each needed their own lantern, and that forced B2 and E5, which was clever. After that it fell apart: A4 or A6, F1 or F3, B6 or C6, and they all worked. |
| 15 | 7×7, ≤6 | Completed with 6/6 | 6 | 0 | 0 | 0 | The symmetric garden looked lovely. Corners and edge columns made a clear start. But the board is a mirror image, so the mirrored answer must work too. |

Notes as I went: *"S3: 'C5 or E5?' Both. Hm. ... S8: the counting argument was really nice, then I had a choice of three pairs. ... S15: pretty, but I could have mirrored it."*

**1. What I did, in order.** Same method as C: pockets and corners first, then the lantern count. On levels 3, 8 and 15 the count was exactly what I needed, so I used every lantern. Level 1 had one to spare.

**2. Unsure moments?** On level 3 with the last lantern, and on level 8 after B2 and E5. I could see more than one correct finish and had to just pick. I hate that. It feels like a guess even when it isn't wrong.

**3. How I'd solve the next level.** I'd count the separate dark pockets that each need their own lantern, compare that with the limit, and let that force the first few placements.

**4. Last vs first.** Somewhat harder, about the same as C's last level. The tight budgets started the levels well, but every level ended with "pick one of these", so they didn't feel like they had a single answer.

---

## Code V (numbers on stones, no budget)

| Level | Board | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| 1 | 5×5, 5 numbers | Completed, 6 lanterns | 6 | 0 | 0 | 0 | Oh, this is lovely. The 2 next to the 1 gave me C4 and D5, then A5, E2 and A1 followed one at a time, and B3 was the last cell left. One answer. |
| 3 | 5×5, 3 numbers | Completed, 6 lanterns | 6 | 0 | 0 | 0 | The 1 under the 0 made A5 certain, because B4 led to a contradiction. A1 versus B1 was decided by row 2. Everything had a reason. |
| 8 | 6×6, 6 numbers | Completed, 8 lanterns | 8 | 0 | 0 | 0 | The best of the lot. The 3 and the 1 next to each other forced C5 and D6. Then I had to test D4 against E5 and follow D4 until it broke. That's exactly like trying a pair in killer sudoku. |
| 15 | 7×7, 8 numbers | Completed, 9 lanterns | 9 | 0 | 0 | 0 | The 3 on the edge gave three lanterns at once. Then the 1, the 0 and the 2 worked through the bottom-left. The last step, C1, was the only lantern left that could reach row 1. Very satisfying. |

Notes as I went: *"V1: this is the real puzzle. ... V8: had to follow one branch to a dead end, but it was a fair dead end. ... V15: the 3 against the wall is a great opening."*

**1. What I did, in order.** I started with the zeros and the big numbers next to walls, since those fix lanterns straight away. Then I crossed out every cell that a placed lantern was shining on. Then I looked for dark cells that had only one possible lantern left. On level 8 I checked one either-or by following it through until it failed. I didn't place anything until I was sure.

**2. Unsure moments?** Briefly on level 8, choosing between D4 and E5, and on 15 before I saw that the B6/C7 choice would knock out A7. In both cases a bit of thinking settled it. I never had to guess.

**3. How I'd solve the next level.** I'd start with the 0s and the numbers that are full, cross off what the lanterns light, and keep looking for the one dark cell that only one lantern can reach.

**4. Last vs first.** Harder, but "harder in the right way". There were more numbers working together and one real either-or to check. It felt like going from an easy sudoku to a medium. It was still fair, and still had one answer.

---

## Overall answers (in character)

**5. If I closed the app right now?** I'd do the killer sudoku in my app, or the one in the Calgary Herald's weekend pull-out if it's a Saturday. Probably with a cup of tea before bed.

**6. Tomorrow morning, 10 minutes. ONE of [Wordle, Royal Match, S, V, C, no phone].** **Version V.** Ten minutes is about one or two V boards, and every one has a single answer I can reason my way to. That's what I want from a puzzle. Wordle is fine but takes three minutes and involves a fair bit of guessing. Royal Match is candy for people who want to tap. C and S mostly ended with "pick any of these", and I don't need to spend my morning on that. Not touching the phone is honestly tempting, but I'd rather start the day with one tidy deduction.

**7. What would make me delete it?** Puzzles with more than one answer. If V started giving me those, or if the app got stuffed with ads, energy timers, or "watch a video for a hint", it would be gone. I'd also lose interest if the levels stayed at level-1 difficulty for weeks.

**8. To a friend in one sentence.** "It's like a little logic grid where you place lanterns so every square is lit without any two shining at each other, and the numbers on the rocks tell you how many lanterns are next to them. Sort of a cousin of sudoku."

**9. Ranking (most likely to play again → least).**
1. **V.** Every board had exactly one answer, and the numbers gave me a real place to start. It feels like sudoku.
2. **C.** Level 15 was a proper puzzle. The early levels were too loose, but at least it seemed to get tighter as it went.
3. **S.** The tight counts were clever at the start, but every level I finished had another correct answer. That's the thing I mind most.

**10. Screenshots.**
- *First thing I notice:* the dark navy look and the big "Level 1 / 5x5 garden" title. Then a large empty gap in the middle before the board. The board sits low on the screen, near my thumb, which I suppose is fine.
- *Hard to see:* the stones and the dark floor are two slightly different shades of grey-blue. With my reading glasses off in the evening, I'd have trouble telling which is which, especially on the 7×7. A stone needs to look like a stone. The six little circles under the title aren't explained anywhere. I worked out they're the lantern allowance only because they fill up yellow. The unlit text ("Light every tile") is small and low contrast.
- *Clear:* the conflict screen is very clear, with red rings and "Two lanterns see each other". The lit squares in mustard and the yellow lanterns are warm and easy to read. "Garden lit! 5 lanterns · 5 moves" is nice, but it doesn't tell me whether 5 was the best possible. That nagged at me after C and S.
- *Would I keep it?* It's calm and not garish, which I like. With better contrast on the stones and numbers in a good big font, yes, I'd keep it next to my sudoku app.

**11. The town / daily puzzle / shareable result.** The little hill town lighting up is sweet, and I'd like seeing it fill in, but it isn't what brings me back. The daily shared puzzle might. My sister and I already text each other our Wordle grids, so a spoiler-free result to paste would actually get used. What would bring me back on day 7 is the daily puzzle being a proper V-style one with a single answer that gets a bit harder through the week, like the newspaper sudoku going from Monday-easy to Saturday-hard, plus a streak or the town as a gentle record of it. If the daily were a C or S board with several answers, sharing results would be pointless, because everyone's "solution" would be different.

---

## Out of character: tester notes

- **I solved every board completely in my head before placing anything**, then entered the lanterns in quick batches. That's why every session shows 0 undos, 0 hints, 0 restarts, and only 12–39 seconds of logged time. A real Megan would take several minutes per board (I'd guess 1–3 minutes on level 1 and 5–10 on V8/V15), would probably place lanterns and look at the lit area as she went, and might undo once or twice on V8/V15. Treat the timing and undo data as unrepresentative. The *logical* findings (which levels were forced, which allowed several answers) are reliable.
- **Several answers.** I worked out by hand (I didn't use the solver) that C1, C3, C8, S1, S3, S8 and S15 each allow more than one correct placement. For example, S3 accepts either C5 or E5 as the last lantern, and S15's board is mirror-symmetric. C15 looked close to forced, but I didn't check it exhaustively. All four V boards were fully forced by my reasoning, including one short "try it and it breaks" step on V8 and V15.
- **Grid reading.** The ASCII grid with cell names makes row and column segments easier for me to list than for a person on a phone. On the other hand, I can't feel spatial things like "this corner looks lonely" the way a sighted player would. Being easy to reason about in text probably made all variants feel more approachable than they would on a small screen.
- **C and S had the same rule text.** Without the numbers, I couldn't tell them apart except by how tight the lantern limits were.
- **Screenshot judgments** (stones vs floor contrast, the unexplained budget dots) are my reading of the images taken on behalf of a 51-year-old. I can't actually test eyesight or a dim evening screen.
