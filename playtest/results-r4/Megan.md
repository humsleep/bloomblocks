# Playtest results, round 4: Megan

**Persona:** Megan, 51, Calgary. School administrator. Does sudoku and killer sudoku daily and some nonograms. Loves pure deduction and hates guessing or puzzles with several answers. Patient and methodical. Plays 10–15 minutes in the evening.
**Play order:** J 12, 16, 20, 30, then W 4.
**Sessions:** `/Users/hyukahn/workspace/puzzle-lab/playtest/sessions-r4/Megan/{J-12,J-16,J-20,J-30,W-4}.json`

## Per level

| Level | Board | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| J12 | 6×6, 5 numbers | Completed, 9 lanterns | 9 | 0 | 0 | 0 | The best J so far. The 3 on the left edge gave A3, A5 and B4 at once, and the 0 took two cells out. Then the real work: the 3 at D2 *had* to use D3. Without it, D1, C2 and E2 would all be needed, the 2 at D4 would need D5 and E4, and E4 would see E2. That's a proper "suppose not" step. Then D5 or E4 for the 2: D5 leaves C6 with no possible lantern, so it's E4. Two either-ors, one answer. Killer-sudoku feeling. |
| J16 | 7×7, 7 numbers (3 zeros) | Completed, 9 lanterns | 10 | 1 | 0 | 0 | Mostly gifts. The 1 at E7 has one open side, the 3 at C6 has exactly three, and the 2 at D5 lost E5 to E6's light. F3 and G5 followed. The only thinking was the top-left: A2 + C1. I tried A1 on purpose to see whether the app agreed it was wrong. The Stuck line flagged C2 and G2, so I undid it. |
| J20 | 7×7, 3 numbers | Completed, 11 lanterns | 11 | 0 | 0 | 0 | Easier than J12. The 3 and the 2 and the 1 settle six lanterns, and then five lonely cells each have exactly one spot (A3, F3, E5, D7, F7). No branching at all. Pleasant, a bit like filling in the last cells of an easy sudoku. |
| J30 | 8×8, 10 numbers (5 zeros) | Completed, 13 lanterns | 13 | 0 | 0 | 0 | Big and long, about four minutes of thinking before I placed anything. A good chain: the 1 at H5 → H6 → G5's 1 must be F5 → F7's 2 is F8 + G7. Then "who can light this?" again and again: G3 only from H3, C4 only from D4, C3 only from E3, which then decided D2's 1 (D1). Lovely and tidy, but every step was forced. No either-or. |
| W4 | 6×6, 5 numbers | Completed, 9 lanterns | 10 | 1 | 2 | 0 | **The same board as last week's W4.** I recognised it immediately and remembered the answer. I put A5 down on purpose to see what the app says. The Stuck line said "B6 (light from D4 A5; rock C6)", which is exactly right. I asked for a hint. It said "Take back the lantern at A5 (1 of 1)", but that line is at the very bottom, under the legend, so I missed it the first time and asked again. Undo, then B5 and A6. |

Notes as I went: *"J12, oh, the 3 at D2 has to use D3, nice. Then E4, not D5. J16, gifts. Check A1? Yes, the app says C2 dies. J20, lonely cells. J30, 8×8 at last, long but no fork. W4, wait, I've done this one."*

---

## Answers (in character)

**1. Did the J levels get harder as I went? Where?**
In size, yes: 6×6, 7×7, 7×7, 8×8, and 9 → 9 → 11 → 13 lanterns. In depth, no. The hardest *thinking* was the first one, J12, with two real either-ors. J16 and J20 were easier than J12, and J30 was longer but every step was forced. So the levels grow longer but not cleverer. J30 took the most time, J12 took the most thought.

**2. Stuck and couldn't tell why? Did the "Stuck:" line point to the right thing?**
I was never truly stuck. I tested the Stuck line twice on purpose with a lantern I knew was wrong:
- W4, A5: "B6 (light from D4 A5; rock C6)". That's spot on and short. Yes, it pointed to the right thing.
- J16, A1: "C2 (light from A1 F3 D4 B6 E6; rocks G1 C3 G3)". The right cells were flagged, but the reason lists five lanterns and three rocks. The culprit, A1, the one I'd just placed, is in there, but I had to know already. I'd like the lantern I last touched to be named first and set apart, e.g. "mostly A1".

**3. Hint and undo: what happened right after?**
On W4 the first hint gave me the whole board back with nothing new I could see. I didn't notice the "Take back the lantern at A5 (1 of 1)" line at the very bottom, under the legend, and asked a second time. Then I read it, pressed undo (A5 was my last move, so undo was the same as taking it back) and finished. The hint itself was right and "1 of 1" is reassuring. It should sit at the top, not under the legend. On J16 the undo did exactly what I expected.

**4. Round-3 complaints:**
- *J doesn't get harder:* **partly fixed.** The boards grow steadily to 8×8 now, and J12 had real either-ors. But J20 and J30 are fully forced, so the depth peaks early.
- *Dots instead of digits:* **still fixed.**
- *"Done" mark subtle, 0 never turns gold, "too many" looks greyed out:* **mostly fixed.** The 0 in the corner turns gold in 04. "Too many" (05) is now dark red with a red ring, which says "wrong" much better. But the little "^^" chevrons beside it read to me as "needs more", the opposite of what it means.
- *No rule text:* **mostly fixed.** The four guide pictures cover the goal, light, numbers and conflict. Still no words, which I'm fine with.
- *Squiggly left button:* **not fixed.** It's still the little path with a lantern. On the daily screens it's a house. I still don't know what the path does.
- *Lit squares in two shades:* **still fixed.**
- *"Remove" hint unclear:* **partly fixed, partly worse.** The up-arrow is gone. But now the lantern to remove is a pale, ghostly lantern with a blue glow, and that's how last week's "put one here" hint looked. Same look, opposite meanings. And nothing points to *why* (no number circled, no dark cell marked). The hint button turns into a lantern with a curly arrow, which looks like a second undo button.
- *Option to turn warnings off:* **can't tell.** No settings screen this round.
- *No undo button:* **fixed.** There's a clear circular-arrow button beside the hint, dim when there's nothing to undo. Exactly what I wanted.
- *Several answers:* **still fixed.** All five boards had one answer by my reasoning.
- *New:* W4 was the very same board as last week's W4. A repeat feels like the paper printing yesterday's crossword.

**5. Screenshots**
- **00 guide goal:** First I notice the big "4" with four glowing lanterns around it and every house window lit. It clearly says "fill it all with light, and the number counts the lanterns". It's the right first picture. I'd make the lit house a beat later, after the board, so the cause and effect is obvious.
- **01 guide light:** The hand drops a lantern and the light runs up the column, left, and down, and stops at the 4. That teaches "rows and columns, rocks stop it" well. The lantern under the finger is pale and unlit, while in 00 they glow. Is it a real lantern?
- **02 guide numbers:** The gold 3 with exactly three lanterns touching it is clear, and the 0 sits with nothing beside it. The hand pointing at the cell under the 0 confused me. Is it saying "not here, because of the 0"? If so, I'd show a tap and a refusal or a cross. As it is, it looks like an instruction to tap there.
- **03 guide conflict:** Much better than last week. Two lanterns in one row with red glows and a red ✗ between them says "not allowed" at once. But a puzzler will notice that the right-hand lantern sits on top of the 0 (half hidden under the finger), so the picture breaks the 0 rule too. A sharp first-timer might wonder whether the ✗ is about the 0 instead.
- **04 stuck light:** First I notice the dark square with a sparkle and the thin lines to the lantern and the gold 2. I read it as "this square can't be lit now: that lantern's light and that full 2 are why". Clear for me, after last week. The sparkle could be a crack, or "something special here". A small "✗-in-dark" or a dimmer mark might be plainer.
- **05 overfull:** The red 2 with a red ring and three lanterns touching. Good, it says "wrong". But the "^^" reads as "more".
- **06 hint remove:** A pale lantern with a blue halo at the right edge, and the hint button changed. I can tell *which* lantern, but not that it means "take it away", and not why. It looks like the "place here" hint from last week.
- **07 undo and buttons:** The undo arrow is bright and obvious. Thank you. The path button on the left is still a mystery. The door says 6.
- **08 daily start:** A calm, empty 6×6 with digits. Nothing tells me it's *today's* puzzle or which number it is. No date, no "#3", the door has no number. The left button is a house here.
- **09 daily result:** Moon, 2:41, a flame with 5, and two little lanterns, one lit and one dark. I don't know what the two lanterns mean (streak savers?). **The flame says 5 here, but the share text says 🔥3.** That would bother me. The card also covers my finished board, and I'd like to admire it for a moment.
- **10 share sheet:** The normal phone share sheet. Fine. It only previews "Lanternly 🌒".
- **Could a first-timer learn every rule from the guide without words?** Nearly. The goal, the light, the counting and "no two in a line" now all have a picture. The weak spots are the hand in 02 (what is it pointing at?) and the conflict picture in 03, which also breaks the 0. I'd fix those two and stop there.

**6. The share text.** I'd send it to my sister, the one I do Wordle with. Only to her, not the staff group chat. I'd change three things:
- The six yellow squares say nothing to me. Six of what? Wordle's squares tell a story. These could show "no hint, no undo" per step, or just go.
- Put a mark for "no hints", like a small 💡0 or a ✓. That's the boast I'd actually want to make.
- The streak must match the result card (5 vs 3).

The time is nice. The moon is pretty.

**7. Tomorrow morning, 10 minutes: pick one.** **W.** One W board is about ten minutes and tends to end in a real either-or, which is what I want with my tea. But if W keeps repeating boards I've done, it'll lose that place. The daily is a gentle J-style board, so I'd do that in the evening, mainly to send the result to my sister. Wordle she and I do anyway. Royal Match, no. Not touching the phone is tempting but less fun.

**8. Score: 7.5 / 10** (up from 7). Undo, the red "too many", the gold 0 and the conflict picture all moved it up. The puzzles are still honest, one answer every time. What would move it most now: **make the later J levels deeper, not just bigger.** From level 20 on, every board should have at least one J12-style "suppose not" step, and W should never repeat a board. I'm happy to spend twelve minutes on an 8×8, but I want one moment in it where I have to *prove* something.

---

## Out of character: tester notes

- **Batch entry.** I solved in my head and entered moves in batches, so the logged times (20–60 s per level, apart from J30's ~226 s gap before the first move) understate real play. A real Megan would take about 4–6 min for J12/J16/J20, 10–12 min for J30, and 3 min for W4 (a remembered board).
- **Deliberate wrong moves.** J16 A1 (then undo) and W4 A5 (then two hints and undo) were deliberate probes of the Stuck line and the remove hint, not real mistakes. The second W4 hint happened because the hint text prints at the very bottom of the output, under the legend lines, and I missed it.
- **Depth by hand (no solver):** J12 needs two contradiction steps (D3 forced, then E4 over D5). J16, J20 and J30 are fully forced by counting and "only one spot can light this cell". W4 needs one A5 vs B5+A6 comparison.
- **W4 index 4 is the identical board to round 3's W4.** Returning testers noticed.
- **Possible Stuck-reason inconsistency:** on W4 with A5 placed, "B6 (light from D4 A5; rock C6)" omits C3, although C3's light falls on B3, and a lantern on B3 could otherwise have lit B6 via column B. Either the reason list is meant to be partial or C3 is missed. Also, J16's reason list for C2 was long (5 lanterns, 3 rocks) without highlighting the newly placed lantern.
- **Screenshot inconsistencies:** 09 shows streak 5, the share text says 🔥3. 03's conflict lantern sits next to a 0. 06's remove hint looks like round 3's place hint (pale lantern).
