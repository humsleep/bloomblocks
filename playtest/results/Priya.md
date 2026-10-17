# Playtest results: Priya

**Persona:** Priya, 39, Leicester (UK). Pharmacist with one young child. Plays Royal Match most evenings on the sofa for 20 to 30 minutes, and in short bursts on her lunch break. Loves decorating the castle and seeing progress. Has bought the odd starter pack. Doesn't like "hard logic" puzzles; wants to feel clever without straining.

**Play order:** V, then C, then S. Levels 1, 3, 8 and 15 of each.
Sessions are in `playtest/sessions/Priya/<code>-<level>.json`.

---

## Version V (numbers on rocks)

Rule line: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it."

| Level | Outcome | Moves | Undos | Hints | Restarts | Time | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (5×5) | Completed | 7 | 1 | 0 | 0 | ~26s | The "2" by the bottom edge only had two spots, so that was a nice freebie. I put one next to the "1" in the wrong place, it went red, and I moved it. Pleasant. |
| 3 (5×5) | Completed | 8 | 0 | 0 | 0 | ~25s | I tried the lantern next to the "1" first again and it clashed. I swapped it to the corner and everything fell into place. I liked the zeros: they tell you where *not* to look. |
| 8 (6×6) | Completed with 1 hint | 15 | 1 | 1 | 0 | ~80s | The "3" with four spaces got me. I picked the wrong three and the game said "too many lanterns at E4", which was really helpful. Then I got stuck in the top-left with two dark squares and every number happy. I took a hint and it told me which lantern was wrong. Once I swapped it, I could see the rest. |
| 15 (7×7) | Completed with 1 hint | 16 | 1 | 1 | 0 | ~60s | The "3" tucked against the edge with exactly three spaces was a lovely start: three lanterns straight away. The bottom-left "2" and "1" fought each other. Then the bottom row wouldn't light without clashing. A hint (C1 in, F1 out) untangled it, and I had to shuffle two more myself. Satisfying at the end, but I did need a nudge. |

### Answers after V

1. **What I did, in order:** Level 1: filled in the "2" first, tried the "1", clashed, moved it, then mopped up the corners. Level 3: same pattern. Wrong guess by the "1", fixed it, finished the top. Level 8: did the "3" wrong, read the warning, fixed it. Did the "2" up top and lit nearly everything. Got stuck on two dark corner squares, took a hint, swapped two lanterns, done. Level 15: put three lanterns round the "3" by the edge, then the other "3", then worked down the left side. Got stuck on the bottom row, took a hint, moved a couple of lanterns, done.
2. **A moment I wasn't sure what to do?** Yes, on level 8 when every number said it was matched and two squares were still dark. Nothing told me where the mistake was, because it was a "right number, wrong spot" thing. Same at the end of 15: everything lit except the bottom row, and the only lantern that would fix it clashed with one I'd put up top.
3. **How I'd solve the next level, in one sentence:** Start with the numbers that only have exactly that many spaces round them, put the zeros' neighbours off-limits, then fill the gaps and swap things when they go red.
4. **Last level vs first:** Harder, but in a good way at first. The numbers give you somewhere to start, so I never stared at a blank board. It got harder because by level 15 the corners of the board depend on each other, and fixing one bit breaks another bit far away. That's where I needed the hint.

---

## Version C (plain board, lantern budget)

Rule line: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns."

| Level | Outcome | Moves | Undos | Hints | Restarts | Time | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (5×5) | Completed (4/6 lanterns) | 4 | 0 | 0 | 0 | ~18s | Barely a puzzle. I put lanterns in the obvious nooks and it was done. Nice and relaxing. |
| 3 (5×5) | Completed (7/7) | 7 | 0 | 0 | 0 | ~15s | Just lit it up. Didn't think at all. |
| 8 (6×6) | Completed (8/8) | 14 | 0 | 0 | 0 | ~35s | I went one over the budget (9/8) the first time, then rearranged the bottom-left. Felt a bit clever when I swapped two lanterns for one in a better spot. |
| 15 (7×7) | Completed (8/8) with 1 hint | 13 | 1 | 1 | 0 | ~72s | Big open board. I put lanterns down the middle and ended one over. The hint said the best answer uses only **6**, which made me feel a bit thick, even though I was allowed 8. It told me C7 was in and A1 was out. Then I spotted a lantern in the corner that lit a whole column and the bottom row together. That was my "ooh" moment. |

### Answers after C

1. **What I did, in order:** Level 1: four lanterns in the obvious spots, done. Level 3: same, used exactly the budget. Level 8: lit the top first, then went over budget in the bottom-left, moved two lanterns around and got it in 8. Level 15: put three lanterns down the middle column, then the edges, ran out with two dark squares. Took a hint, swapped the top-left one for the bottom-left corner, done at 8/8.
2. **A moment I wasn't sure what to do?** Level 15, when every square was lit but I was one lantern over. Without numbers there's nothing to tell you *which* lantern is the wasteful one. You just stare at it.
3. **How I'd solve the next level, in one sentence:** Put lanterns in the little pockets between rocks first, then try to make each remaining lantern light a long row and a long column at once.
4. **Last level vs first:** Harder, mostly because the board is bigger and empty. Level 1 felt like colouring in. Level 15 felt like I had to "see" it all at once, which isn't really how I like to play. The hint mentioning "6" when I'd used 8 took a bit of shine off finishing.

---

## Version S (plain board, tight lantern budget)

Rule line: same as C. "Light every cell. Lanterns can't see each other. Use at most the shown lanterns." The budgets felt tighter.

| Level | Outcome | Moves | Undos | Hints | Restarts | Time | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (5×5) | Completed (5/6) | 5 | 0 | 0 | 0 | ~10s | Easy. Middle lantern, then the corners. |
| 3 (5×5) | Completed (4/4) | 6 | 0 | 0 | 0 | ~22s | Only 4 allowed, so I had to think. I got two squares on the right stuck, moved one lantern, and it worked. A nice little "aha" for a small board. |
| 8 (6×6) | Completed (6/6) with 1 hint and 1 restart | 14 | 0 | 1 | 1 | ~48s | Used all 6 and still had two dark squares. Hint said the corner one was wrong. I restarted and built it round the lantern it suggested. I still put one in the wrong corner and had to move it at the end. Bit of a slog. |
| 15 (7×7) | Completed (6/6) with 1 hint | 14 | 0 | 1 | 0 | ~50s | My middle-column idea used too many. The hint said top-middle in, and the one I'd put on row 2 out. That clashed with my middle one, so I took that out too. At the end, the bottom row needed a lantern where my row-6 one was, so I moved the row-6 job to the right-hand edge. That last swap felt really good, but I was tired of it by then. |

### Answers after S

1. **What I did, in order:** Level 1: one in the middle and four round the edges, done. Level 3: corner, middle, then two lanterns that wouldn't fit. Swapped one and finished on exactly 4. Level 8: filled up to the limit with two squares dark. Took a hint, restarted from the hinted lantern, fixed the last corner by swapping. Level 15: middle column, ran short, took a hint, rebuilt the top. Then I moved the bottom lantern down and the right-edge lantern down to cover both.
2. **A moment I wasn't sure what to do?** Level 8, when I'd used all 6 lanterns and still had dark squares. Nothing on the board points you anywhere; it's just "wrong". Same on 15 before the hint.
3. **How I'd solve the next level, in one sentence:** Try to put lanterns on the edges where they light a full row *and* a full column, and if I'm short, ask for a hint and build round it.
4. **Last level vs first:** Much harder. Level 1 took ten seconds and level 15 needed a hint plus a real think. It feels harder because there's only one way to fit it in and nothing on the board helps you find it. You either "see" it or you guess and swap.

---

## Final questions (in character)

**5. If you closed the app right now, what would you do instead?**
Open Royal Match and do a level or two so I can put the next bit of the garden in. Or, honestly, scroll a bit and go to bed.

**6. Tomorrow morning, 10 minutes. Choose ONE.**
**Version V.** The numbers give me a way in, so I don't sit there staring, and the "too many lanterns at…" message felt like the game was on my side. The early levels made me feel a bit clever in under a minute. Not Royal Match, because ten minutes in the morning isn't enough. I'd lose lives and get annoyed, and I save it for the sofa. Not Wordle, because I already do that with my sister, and it's two minutes, not ten. Not C, because it's pleasant but a bit empty; nothing to "work out" on the early levels. Not S, because it's C but stingier, and being one lantern short with no clue why is how I'd start my day grumpy. And "don't touch the phone" is a lovely idea that never happens.

**7. What would make you delete this app?**
Several big boards in a row that I can only finish with hints. The same dark blue screen every time, with nothing to build or collect, so it feels like homework. Or if they start rationing hints and then charging me for them on the hard ones. I'd feel tricked.

**8. Describe it to a friend in one sentence.**
"It's a little puzzle where you put lanterns on a grid to light up every square without them shining at each other. Quite calming, and the ones with numbers are oddly satisfying."

**9. Rank (most likely to play again to least):**
1. **V.** The numbers tell me where to start and the game tells me when I've overdone it, so I feel clever rather than stuck.
2. **C.** Relaxing and generous on the early levels. But without numbers it's either too easy or a big blank board, and the "best is 6" hint made my 8 feel like a fail.
3. **S.** Same game as C, but the tight limit means every big board ends with me one lantern short and no idea which one is wrong.

**10. The current-look screenshots.**
The first thing I notice is how *dark* it is. It's a dark navy screen with a big empty gap in the middle, and the grid squashed at the bottom. Fine for the sofa at night, but it looks a bit gloomy and unfinished. On the first screen I honestly couldn't tell straight away which squares were rocks and which were empty floor. The rocks are a slightly lighter grey-blue and the floor is a slightly darker blue, which is a small difference on a phone at arm's length. The lit squares are a muddy mustard-brown rather than a lovely warm glow, so it doesn't look "lit". The red clash squares and "Two lanterns see each other" are very clear. The six little circles under the title confused me. Are they lanterns left? Stars? Lives? "Garden lit!" with the big yellow Next button is cheerful, though. As it stands I wouldn't delete it, but I wouldn't move it to my home screen either. It doesn't have that "ooh, pretty" feeling Royal Match has.

**11. The hill-town idea (lighting houses, daily shared puzzle, spoiler-free result).**
Ooh, yes, that changes things for me. Lighting a little window and seeing the town slowly glow is exactly my thing. It's the castle decorating, but calmer. I'd come back tomorrow to light the next house. The daily puzzle I could take or leave, but the paste-able result I'd actually use with my sister, like Wordle. What would bring me back on **day 7** is *seeing* the town: a street that's nearly all lit and I want to finish it. It would help even more if the houses had something to them (a cat in a window, a little shop sign) so it feels like *my* town. If the daily puzzle were a hard 7×7 with no numbers, I'd skip it. If it's a V-style one I can do on my lunch break in a couple of minutes, I'd keep a streak going.

---

## Out of character: tester notes

- **Reading the grid:** For me, the ASCII grid with coordinates is easier than a real phone screen. I see exact row/column alignment, and the status line spells out counts like "Lit 26/28" and "too many lanterns at C2". A human on the phone has to scan for dark tiles. The screenshots also show that rocks and floor are low-contrast. So Priya would probably be slower, and might miss dark squares more than I did.
- **Spatial reasoning:** I can work out full lines of sight and full solutions far faster than a casual player. I deliberately played "persona-paced": first guesses near the numbers, natural mistakes (picking the wrong 3-of-4 around a "3", building down the middle column, corner habit), and hints at points where I judged she'd lose patience. Real timings would be several times longer than the logged seconds; the "s since start" values reflect command latency, not thinking time.
- **Hints were role-play choices:** The hint use and when it happened (V-8, V-15, C-15, S-8, S-15) are my judgement of her patience, not true inability. I could have solved those levels without hints. A real Priya might give up on S-8 or S-15 instead, or take more than one hint.
- **No give-ups:** None were recorded. On a tired evening, S-15 (and possibly C-15) is the most likely real give-up point.
- **Observations about C and S:** C and S showed identical rule text. The only difference I noticed was the budget. C's budget was slack (C-15 allowed 8 when the hint said 6 is optimal), and S's budget looked equal to the optimum. The C-15 hint saying "optimal solution (6 lanterns)" while the budget was 8 felt mildly deflating in character.
- **Strongest positive in V:** the "too many lanterns at X" message.
- **Weakest moment across all versions:** "everything matched or used up, but some squares dark, and no indication which lantern is wrong".
