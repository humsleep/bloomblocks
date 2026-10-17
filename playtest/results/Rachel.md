# Playtest results: Rachel

**Persona:** Rachel, 49, Toronto. Accountant. Plays LinkedIn Queens, Zip and Tango every workday morning, compares times with colleagues, keeps streaks religiously. Competitive about speed, likes clean logic with exactly one right answer, likes sharing results, gets bored fast once a puzzle type feels "solved".

**Play order:** V, then C, then S. Sessions are in `playtest/sessions/Rachel/`.

---

## Version V (numbered rocks, no lantern limit)

Rule line: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it."

| Level | Outcome | Moves | Undos | Hints | Restarts | Time (log) | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (5×5) | Completed | 7 | 1 | 0 | 0 | ~24s | I tapped B2 before reading the board properly, a habit from Queens where you just start. Then I saw the "2" at the bottom, which forces both of its open neighbours, and everything followed from it. I undid B2 and it ran from there. Satisfying. |
| 3 (5×5) | Completed | 6 | 0 | 0 | 0 | ~18s | The "1" next to the "0" on the left edge is the trick. If the lantern goes at B4 it kills the "2" below, so it has to be A5. After that it was pure follow-through. Clean. |
| 8 (6×6) | Completed | 8 | 0 | 0 | 0 | ~30s | This is the first one I had to actually think about. The "3" plus the "1" right beside it means D6 and C5 are certain, then it's D4 or E5. I tried D4 in my head and E5 ended up stranded in the dark, so it's E5. The top-right "2" then took a little case work (D1+F1 dies, D1+E2 works). That's the "aha" I play these for. |
| 15 (7×7) | Completed | 9 | 0 | 0 | 0 | ~45s | The "3" on the right edge gives you three lanterns for free, and the two zeros box in the bottom right. The bottom-left "2" and "1" took one real case split (B6 vs C7). One answer, no guessing. Lovely. |

## Version C (plain rocks, "use at most N lanterns")

Rule line: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns."

| Level | Outcome | Moves | Undos | Hints | Restarts | Time (log) | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (5×5, max 6) | Completed | 4 | 0 | 0 | 0 | ~9s | I used 4 of 6. Barely a puzzle, more like colouring in. |
| 3 (5×5, max 7) | Completed | 5 | 0 | 0 | 0 | ~16s | 5 of 7. The only cell I had to think about was the top-left corner. |
| 8 (6×6, max 8) | Completed | 8 | 0 | 0 | 0 | ~25s | 8 of 8, so I hit the limit exactly, but I wasn't trying to. I just placed lanterns greedily and it worked. The bottom-left corner (A6) was the only spot I had to look at twice. |
| 15 (7×7, max 8) | Completed | 6 | 0 | 0 | 0 | ~29s | 6 of 8. A big board with long open rows, and you just put a lantern in each row. The limit never pressed on me. It also clearly has lots of right answers, so whose time even counts? |

## Version S (plain rocks, tighter "use at most N lanterns")

Rule line: identical to C.

| Level | Outcome | Moves | Undos | Hints | Restarts | Time (log) | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (5×5, max 6) | Completed | 6 | 0 | 0 | 0 | ~18s | 6 of 6. Exactly on budget, which felt a bit tighter than C, but mostly I was just filling gaps. |
| 3 (5×5, max 4) | Completed | 4 | 0 | 0 | 0 | ~17s | 4 of 4. Now the limit matters. My first idea in my head (A4 + D2) came to 5, so I switched to A1 + D4, which covers both long lines, and it fit. A small "oh, nice". |
| 8 (6×6, max 6) | Completed | 6 | 0 | 0 | 0 | ~24s | 6 of 6. I counted the cells that can only be lit along their row and got six separate stretches that each need a lantern, so it has to be exactly one lantern per stretch. That's real logic. A couple of the picks were still free choices, though. |
| 15 (7×7, max 6) | Completed | 6 | 0 | 0 | 0 | ~28s | 6 of 6. Same counting trick: rows 1, 4 and 6 each need one, the left and right columns need one, and the bottom middle needs one. It felt like level 8 again on a bigger board. |

---

## After version V

1. **What I did, in order:** Level 1: I jumped in with a lantern at B2, read the numbers, undid it, then went 2 → its two neighbours → the 1s → the corners. Level 3: worked out the left-edge 1 against the bottom 2, then filled the top. Level 8: locked in the 3/1 pair, ruled out D4 because it leaves a dark cell, then split the top "2" into cases. Level 15: started from the edge 3 for three free lanterns, used the zeros to rule things out, split once at the bottom left, and finished the top.
2. **Unsure moment:** Only right at the start of level 1, when I'd placed a lantern before reading the numbers. Also briefly on level 8 when choosing D4 vs E5. That was the good kind of unsure, the kind you reason your way out of.
3. **Next level, one sentence:** Find the biggest number on an edge or next to a zero, take the lanterns it forces, and follow the chain from there.
4. **Last vs first:** Harder, but in a good way. Level 15 needed one real either-or decision instead of a straight chain, and the board was bigger. It still never felt like guessing.

## After version C

1. **What I did, in order:** On each level I put lanterns where they lit the longest open lines, then mopped up the leftover corners. I finished every level under or at the limit without trying.
2. **Unsure moment:** Not really. On level 8 I glanced at A6 because only its own column can reach it. Otherwise no.
3. **Next level, one sentence:** Put a lantern in each long row, then patch the corners. The limit won't stop you.
4. **Last vs first:** About the same. The board got bigger, but it's the same "fill it in" job, and level 15 was honestly no harder than level 8. The limit was so loose it felt like decoration.

## After version S

1. **What I did, in order:** Level 1: a central lantern, then filled the corners, landing exactly on 6. Level 3: my first plan was one lantern too many, so I picked lanterns that each cover two long lines. Level 8: counted the stretches that must each have a lantern, got exactly 6, then placed one per stretch. Level 15: same counting, then placed them.
2. **Unsure moment:** Level 3, when I realised my first plan came to 5 with only 4 allowed. That was the only time I had to back up (in my head, not on the board).
3. **Next level, one sentence:** Count the stretches of floor that can only be lit along their own row or column, and that tells you where the lanterns have to go.
4. **Last vs first:** A bit harder than level 1 but about the same as level 3. Once I'd spotted the "count the must-have stretches" trick on level 8, level 15 was the same trick again. Some lanterns could go in either of two spots, which bugs me. I like one right answer.

---

## Overall

5. **If I closed the app right now:** I'd finish my LinkedIn trio (Queens, Zip, Tango) and post my times in the team chat before the 9 o'clock standup.
6. **Tomorrow, 10 minutes, one choice:** **Version V.** It's the only one that felt like Queens or Tango: numbers that force moves, one right answer, and a real "aha" on the bigger boards. Not Wordle because I already do that on the bus. Not Royal Match because it's a time sink with lives and boosters, and I'd never stop at 10 minutes. Not S because it's decent but I'd figured out its trick by level 8. Not C because it's too easy to bother. "Don't touch the phone"? Be serious, I have a streak mentality.
7. **What would make me delete it:** Puzzles with more than one valid answer (then times mean nothing), energy/lives or ads between levels, a daily puzzle that loses my streak because of a sync bug, or every level feeling the same after a week.
8. **To a friend, one sentence:** "It's like Queens but with lanterns: light up the whole garden without two lanterns seeing each other, and the numbers on the rocks tell you how many lanterns go next to them."
9. **Ranking:**
   - **V:** Real logic, one answer, numbers to chew on, and it got harder the right way.
   - **S:** The tight lantern limit makes you count, which is a nice trick, but I solved the trick fast and some boards allow more than one answer.
   - **C:** The limit never mattered, so it's just colouring in. I'd be bored by day two.
10. **Screenshots:** The first thing I notice is that huge empty gap between "Level 1" and the board. Half the screen is just navy. The rocks and the unlit floor are both shades of grey-blue, and on the first-launch screen I had to squint to tell which squares are rocks. At 49, with my reading glasses in the other room, that's a problem. The lit squares are a muddy mustard brown, not glowy. The red "two lanterns see each other" warning is very clear, which is good. The six little circles under the title presumably count lanterns, but nobody told me that. And there's no timer anywhere! I want to see my time. As it is, it looks tidy but dim and a bit sleepy. I'd keep it only if the daily puzzle was good.
11. **The town / daily puzzle / shareable result:** Yes, that changes things. One shared daily puzzle with a paste-able result is exactly how Queens and Wordle got into our team chat, and I'd absolutely post it next to my Queens time. The town lighting up is cute but not why I'd come back. What brings me back on day 7 is a streak counter, my solve time in the share text, and a puzzle that's actually different each day (V-style numbers, one answer). If day 7 feels like day 1, I'll drift off.

---

## Out of character: tester notes

- I solved every level by full logical deduction in my head before touching the board. That's why there are almost no undos, no hints and no restarts. A real person on a phone would tap more, experiment, and probably make a couple of wrong placements on V-8 and V-15.
- The "time" values come from wall-clock timestamps. They mostly reflect my reasoning latency and shell round-trips, not human tapping speed, so treat them as unreliable. A real speed-focused player would likely be faster on C and S1 and slower on V-8 and V-15.
- Reading the ASCII grid with coordinates makes it easy to reason about whole rows and columns at once, and to count "stretches that need a lantern" in S. On a phone, with stones and floor in similar colours, that would be harder and slower.
- For C and S I did not check whether any other answers exist. My note that S has free choices is based on noticing it during my own deduction on S-8, not on an exhaustive check.
- I first placed B2 on V-1 before analysing, which was partly a genuine slip on my side. I kept it as Rachel's "jump in" habit.
- My judgments of the screenshots (low stone/floor contrast, empty space, no timer) are based on the images only. I didn't look at the real device, so contrast may look different on an actual screen.
