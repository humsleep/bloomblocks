# Playtest results: Claire

**Persona:** Claire, 36, Bristol (UK). Freelance graphic designer. Plays Monument Valley, Two Dots, Alto's Odyssey, A Little to the Left. Very sensitive to visual quality; deletes cheap-looking apps within a minute. Likes medium-difficulty puzzles with an "aha". Plays in the evening on the sofa and in short gaps during the day.

Play order: S, then V, then C. Sessions: `playtest/sessions/Claire/<code>-<level>.json`.

---

## Code S

Rule line: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns."

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (5×5, budget 6) | Completed, 5/6 lanterns | 6 | 1 | 0 | 0 | Fine. I tried C1 to reach the top-left corner, it went red against C3, so I undid it and used B1. A warm-up. |
| 3 (5×5, budget 4) | Completed, 4/4 | 4 | 0 | 0 | 0 | Corner A1 lights a whole column and the top row, then D4 for the middle. It fell into place. Satisfying, but over almost before it started. |
| 8 (6×6, budget 6) | Completed, 6/6 | 8 | 0 | 0 | 0 | Small proper "aha". I filled the left side, then put E1, E3 and E5 down the right (the stones keep them apart, which felt clever), but that used up all six lanterns with F2, F4 and F6 still dark. Then I saw that F1 does E1's job and lights the whole F column. One swap and it was done. Nice. |
| 15 (7×7, budget 6) | Completed, 6/6 | 12 | 1 | 0 | 1 | First go I put a lantern in the dead centre (D4) because it looked like it would light the most. It doesn't, because the stone row cuts the columns. I got stuck with 4 dark cells and nothing left to place, tried one swap, then restarted. Second time I started from what must be true: the bottom row needs its own lantern, and the left and right columns each want one that also covers a full row (A4, G6). Then it solved itself. That was the best moment in S. |

Notes while playing: the budget is what makes S work. Without it I'd just scatter lanterns. Level 15's "the centre is a trap" moment is the kind of thing I like.

**1. What did I just do, in order?**
Level 1: two big lanterns in the middle and right, tried the top corner, got a conflict, undid it, then filled the corners. Level 3: four lanterns in a row with no mistakes. Level 8: did the left side, then three lanterns down the right, ran out, swapped the top one into the far corner and finished. Level 15: started in the centre, ran out with gaps, restarted, worked from the edges and the bottom row inwards, and finished in six.

**2. Was there a moment I wasn't sure what to do?**
On level 15, with the centre lantern down and 4 cells still dark and no lanterns left. I knew something was wrong but not which lantern, so I wiped the board. Also briefly on level 8, when I hit 6/6 with three dark cells on the right edge.

**3. How would I solve the next level?**
Find the cells that only one or two spots can light (corners, cells boxed in by stones), put those lanterns in first, and make each one cover a full row or column, because the count is tight.

**4. Last level vs first?**
Harder, and nicely so. Level 1 was just tapping. Level 15 punished my obvious first idea and made me plan. It feels harder because the budget is tight and the bigger board has stone rows that break up the light, so the move that looks best doesn't work.

---

## Code V

Rule line: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it." No lantern limit.

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (5×5) | Completed, 6 lanterns | 8 | 0 | 0 | 0 | The "2" in the bottom row only had two open sides, so both had to be lanterns. Lovely first deduction. Then I guessed wrong on the "1" (B2), which clashed with the lantern I needed for the top-right corner. I swapped it for A1 and added B3. |
| 3 (5×5) | Completed, 6 lanterns | 9 | 1 | 0 | 0 | Picked the wrong pair for the "2" (B5 and D5). The "1" next to it then had nowhere legal to go, which taught me something. Undid it and switched to C4 + D5. Everything else followed. |
| 8 (6×6) | Completed, 8 lanterns, **with 1 hint** | 12 | 0 | 1 | 0 | The hard one. The "3" was clear on two sides. For the third I picked D4 over E5, and for the "2" at the top I picked F1 + E2. All numbers showed matched, but five cells were dark and there was nowhere legal to put lanterns. I sat staring, then pressed hint. It said D1 and that F1 was wrong. Placing D1 clashed with D4, and then I saw that E5 can only ever be lit by a lantern on itself. I rebuilt the right side (E5, F3, A4) and it was solved. A bit deflating to need the hint, but the reason made sense afterwards. |
| 15 (7×7) | Completed, 9 lanterns | 16 | 1 | 0 | 0 | My favourite level of the whole session. The "3" in the right edge has exactly three open sides, so: instant aha, three lanterns. Then A2 from the "1" (after a silly B3 clash), B6 from the 2/1 pair, and I got to 38/39 with one cell (A5) dark. Fixing it set off a chain: A5 in, A7 out, row 7 needed D7, D7 clashed with D2, so E2 instead, which overloaded the "3", so F1 out, so C1 in. Five changes in a row, each forced by the last. Completed it without a hint. |

Notes while playing: numbers give me somewhere to start, which I like much more than staring at a blank grid. "Numbers matched 6/6" while cells were still dark misled me on level 8. I thought I was nearly there when I was actually wrong. The 0-rocks counted as "matched" from the start, which looked odd ("2/5 matched" before I'd done anything).

**1. What did I just do, in order?**
Level 1: the "2" first, then the corner, a wrong guess on the "1", swapped, done. Level 3: wrong pair on the "2", noticed the "1" couldn't be satisfied, undid, then a clean finish. Level 8: the "3" and "2" clues, a wrong choice on each, got stuck with everything "matched" but dark cells, used one hint, rebuilt the right side. Level 15: the edge "3" first, worked left, got to one dark cell, then fixed it through a chain of swaps.

**2. Was there a moment I wasn't sure what to do?**
Yes, level 8, after my sixth lantern. All numbers said matched, five cells were dark, and every place I could reach was either a clash or would break a number. That's when I pressed hint. On level 15 I hesitated at 38/39, but there I could see why.

**3. How would I solve the next level?**
Start with any number that has exactly as many open sides as its value, plus the zeros, then look for cells only one spot can light, and work outwards from those.

**4. Last level vs first?**
Harder, but it felt fair. Level 1 is a single neat deduction. By 15 there are eight numbers that depend on each other, so one early choice comes back to bite you three moves later. The difficulty comes from clues interacting, not just a bigger board, which is why the last one felt clever and not just long.

---

## Code C

Rule line: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns." (Same wording as S.)

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (5×5, budget 6) | Completed, 4/6 | 4 | 0 | 0 | 0 | Four taps. Two lanterns spare. Didn't really think. |
| 3 (5×5, budget 7) | Completed, 7/7 | 7 | 0 | 0 | 0 | Went round the edges putting a lantern wherever something was dark. Used all 7, but the limit never felt like pressure. |
| 8 (6×6, budget 8) | Completed, 7/8 | 7 | 0 | 0 | 0 | Pleasant, no friction, no moment. I could have been careless and it would still have worked. |
| 15 (7×7, budget 8) | Completed, 7/8 | 15 | 0 | 0 | 1 | This one had some bite. I made a pretty symmetrical column of three lanterns down the middle (D2, D4, D6) because it looked nice, then filled the edges and ended with two dark cells and one lantern. Restarted and made each lantern do two jobs (A4 covers row 4 and column A, B6 covers row 6 and column B). Finished with one to spare. |

Notes while playing: it felt like S's easy cousin. Same rule, but the lantern allowance is loose enough that on 3 of the 4 levels it didn't matter. Only level 15 made me think.

**1. What did I just do, in order?**
Level 1: four lanterns, done. Level 3: seven lanterns around the board, done. Level 8: seven lanterns, one at a time into dark gaps, done. Level 15: built a centre column, ran short by one, restarted, and solved it by doubling up rows and columns on the edges.

**2. Was there a moment I wasn't sure what to do?**
Only on level 15, when I had one lantern left and two dark cells in different places. Before that, never.

**3. How would I solve the next level?**
Put a lantern wherever something's still dark, and if I run short, restart and make the edge lanterns cover full rows.

**4. Last level vs first?**
Harder, but only the last one. 1, 3 and 8 felt about the same, easy and a bit empty. Level 15 suddenly asked me to plan. The jump comes from the bigger, more open board, not from the limit getting tighter in between.

---

## Overall answers (in character)

**5. If I closed the app right now, what would I do instead?**
Probably open A Little to the Left and do the daily, or scroll Pinterest for a client moodboard while pretending it's relaxing. If it's late, I'd put the phone down and read.

**6. Tomorrow morning, 10 minutes. Choose ONE.**
**Version V.** It's the one that gave me a real "oh!" (the "3" on the edge, then the chain of swaps on 15), and a single board fits 10 minutes with my coffee. Not Wordle: I'd finish it in two and want something more. Not Royal Match: it's loud, ad-ish, and goes on forever, not my aesthetic. Not S: I liked it, but it's a bit more "try it and see" than "figure it out". Not C: too easy until the very end. Not "don't touch the phone": honestly, a calm logic puzzle is a better start than the news.

**7. What would make me delete this app?**
If it looks cheap: muddy colours, ads that cover the board, or a jangly "level complete" screen asking me to rate it. If levels feel generated and samey, with no hand-made feel. If hints cost money or need a video ad. And if the lit colour stays that brownish mustard, which I'd notice every single time.

**8. Describe it to a friend in one sentence.**
"It's a quiet little logic puzzle where you place lanterns in a dark garden so every tile is lit without any two lanterns seeing each other, a bit like a cosier Sudoku."

**9. Rank S, V, C (most likely to play again to least).**
1. **V**: the numbers give me a place to start and real deductions, and the last level ended in a chain of moves that felt earned.
2. **S**: the tight lantern budget makes you plan, and level 15's "the centre is a trap" was a nice surprise, but it involves more trial and error.
3. **C**: same idea as S with a loose limit, so three of four levels were just tapping. Only the last one woke me up.

**10. The current-look screenshots.**
What I notice first is the big empty band of dark navy between the "Level 1" header and the board. The board sits at the very bottom, and the top half of the screen is doing nothing. It feels unfinished, not minimal.

The typeface is nice: rounded, friendly, warm cream on navy, which works. The little circles under the title (the lantern count?) are a good idea and look tidy.

Hard to see:
- In the empty board, **stones and dark floor are too close in colour**. The stones are a slightly lighter slate with a bottom shadow, which makes them look like raised buttons. I'd honestly think the stones were the things to tap. In the 7×7 screenshot the stone row in the middle reads as "highlighted tiles" rather than walls.
- The **lit colour is a flat olive/mustard brown**. On a game about lanterns at night I want glow: warm amber, a soft radial falloff, maybe light spilling across tiles. This brown looks like a spreadsheet cell highlight. It's the single thing most likely to make me think "cheap".
- The conflict state (red tiles with a red outline and "Two lanterns see each other") is clear and actually quite well done, maybe a touch harsh in tone against the rest.
- The "Garden lit!" screen is fine but flat: the board shrinks into the middle with lots of empty space, and nothing celebrates. I'd want a moment of warmth, like the whole garden softly glowing up.
- Grid lines and tile gaps are clean, and tiles are big enough to tap at 5×5 and 7×7. No problem there.

Would I keep it on my phone? Not in this state. The bones are tidy (good font, good spacing on the tiles, clear red error), but the colours are muddy and the layout leaves a hole in the middle of the screen. Next to Monument Valley or Alto on my home screen it looks like a prototype, which I gather it is.

**11. The full-game description (hill town at night, windows lighting, one shared daily puzzle, spoiler-free share).**
Yes, that changes things for me, mostly the town. A hill town slowly lighting up at night is exactly the kind of quiet, beautiful progress I'd come back for, as long as it's actually drawn with care (think Monument Valley's palette, not a stock "village" asset pack). Seeing my house's window glow after a solve would fix the flat "Garden lit!" moment completely. The shared daily puzzle plus a spoiler-free paste is good too: my sister and I already swap Wordle grids, so it would slot right in.

What would bring me back on day 7: seeing the town visibly further along than on day 1, with a new street or a little detail (a cat on a roof, smoke from a chimney) that I unlocked, and the daily being a V-style numbers puzzle that's a bit harder at the weekend. Plus my sister's result sitting in our chat waiting for me to beat it. If day 7 looks the same as day 1, I'd drift off.

---

## Out of character: tester notes

- **Speed and time stamps are not human.** Each level's wall-clock time in the session files (often 10–80 s) reflects my command round-trips, not real thinking time. A real Claire would take several minutes on S-15, V-8 and V-15, and might put V-8 down and come back later.
- **I solved partly by explicit row/column-segment analysis** before moving. For S-8, S-15, V-8, V-15 and C-15 I deliberately played a plausible human first attempt (an "obvious" but wrong move), then corrected. The specific mistakes are my guess at what she'd try, not something that happened naturally. The undo, restart and hint counts are therefore partly scripted to be realistic, not measured.
- **ASCII vs phone:** reading row/column lines in a text grid with coordinates is probably easier for me than tracking light beams visually on a phone. On the other hand, a human sees the lit area instantly, which I had to read cell by cell. Spotting "this cell can only be lit by itself" (V-8, E5) is likely harder for a human on a phone than it was for me with coordinates.
- **Hint use (V-8)** was a judgement call. A real player might have restarted instead, or quit for the evening. Given her patience, I think a hint is the likeliest choice, but a give-up is plausible there.
- **The C vs S difference** I noticed is mostly the looser lantern budget in C. I can't tell whether other generator differences exist. My impression of C as "too easy" rests on 4 levels.
- **Visual judgements** come from four static screenshots. I didn't see animation, sound or haptics, which would weigh heavily for this persona.
