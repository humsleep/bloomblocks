# Playtest results, round 3: Priya

**Persona:** Priya, 39, Leicester (UK). Pharmacist with one young child. Plays Royal Match most evenings, plus short bursts on her lunch break. Loves decorating and seeing progress. Has bought the odd starter pack. Wants to feel clever without straining.

**Play order:** J (levels 1, 8, 10, 15), then W (levels 1, 4).
Sessions are in `playtest/sessions-r3/priya/<code>-<level>.json`.

Both versions showed the same rule line as before: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it." There is no lantern limit.

"Moves" below is the game's own counter (every lantern placed or removed). The logged times are command latency, not real thinking time.

---

## Version J

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (5×5) | Completed | 8 | 1 | 0 | 0 | The top "2" only had two spaces, a freebie. Around the "3" I picked a spot that was already lit and it went red, so I undid it. Then the other three went in, and the last "2" had only two spots left. Lovely warm-up. |
| 8 (6×6) | Completed | 12 | 2 | 0 | 0 | Did the "2" in the bottom-right corner first (two spaces, done). Around the "3" I put one next to the "0" by mistake and the zero complained, so I undid it. Tried the wrong side of the left "1" (clash), undid it. Then one dark square was left between the "0" and the "3". I could see it could only get light from above. My corner lantern was in the way, so I put one above the square, it clashed, and I took the corner one out. Done, no hint. Pleased. |
| 10 (7×7) | Completed with 1 hint | 14 | 3 | 1 | 0 | A big jump: 7×7, eleven lanterns, three zeros. The edge "2" was a freebie. Around the "3" I again picked a lit spot (clash). The "1"s were fine. Then the corner habit: top-left clashed. I did the two bottom corners. The top strip had five dark squares and zeros everywhere. I tried the one spot that looked like it would light the most, and two numbers went "too many". Undid it and took a hint ("put a lantern at F2, it can only be lit by itself"). After that, one more lantern in the top row finished it. That was work for a level 10. |
| 15 (6×6) | Completed with 1 hint | 12 | 2 | 1 | 0 | The "2" next to the "0" had exactly two spaces, nice. The left "1": wrong side first (clash), then the right one. On the top "2" I took the top and right spots, which turned out wrong. Corner habit again (clash). Did the two bottom squares. Then everything was happy, but two squares were dark, one tucked between the "0" and the "2". That was my old "all happy but not finished" feeling. The hint said "take back the lantern at E1 (1 of 1)". Then it was obvious: the spot under the "2" instead, and one at the top to light the tucked-in square. |

### Answers after J (in character)

1. **What I did, in order:**
   - **Level 1:** the top "2" freebie, a wrong lantern by the "3" that I undid, the rest of the "3", then the right-hand "2".
   - **Level 8:** the bottom-right "2", then the "3" (I tried a spot next to the zero by mistake and undid it). Then the left "1" (wrong side, undid it), the "1" on the right, the corner, and a final swap at the top to light the square between the "0" and the "3".
   - **Level 10:** the edge "2", the "3" (a clash I undid), the two "1"s, a corner clash I undid, the two bottom corners, and one wrong guess in the middle-top that I undid. Then a hint, and two more lanterns.
   - **Level 15:** the "2" by the zero, the "1" (a clash I undid), the top "2" done wrong, a corner clash I undid, the bottom two, a hint, then the fix.
2. **Not sure what to do?** Level 10, at the top. Five dark squares spread out, zeros everywhere, and every number already happy. I didn't know which square to light first. Also level 15 near the end: every number was happy and two squares were dark.
3. **Hints:**
   - **Level 10** said "put a lantern at F2, F2 can only be lit by a lantern on itself". Once I looked, that made sense: the square was boxed in. Right after, I could see a lantern in the top row would light the last three squares.
   - **Level 15** said "take back the lantern at E1 (1 of 1)". The "1 of 1" was reassuring, because only one thing was wrong. Right after, I moved it to the other free side of the "2" and saw the top-left fix myself.
   - Both times I still did the finishing myself, which I like.
4. **Stuck and couldn't tell why?** Level 15. Everything happy, two squares dark, and the one between the "0" and the "2" looked like the rocks were the problem. Actually it was my lantern on the top row stealing the only spot that could light it. On level 8 the same situation happened, but it was one square, so I could see it.
5. **Harder, easier, same?** Up and down. 1 easy, 8 comfortable (no hint!), 10 suddenly a big 7×7 with lots of lanterns, then 15 back to 6×6 and a bit easier than 10. Level 10 is the bump. I'd have expected the biggest board at 15.

---

## Version W

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (6×6) | Completed | 11 | 2 | 0 | 0 | Totally different from last week's W-1! A "3" in the top row with exactly three spaces: three lanterns straight in. The "1" on the left: I tried the spot right under the corner (clash), then the other one. The "2" in the middle had exactly two spaces. Then I mopped up: right-edge square, one bottom-right corner that clashed (moved it down one), and the last square bottom-middle. Very satisfying first level. |
| 4 (6×6) | Completed with 1 hint | 13 | 2 | 1 | 0 | The bottom "1" between rocks had only one free side, a freebie. The middle "1": I put one next to the "0" first and the zero went wrong. Undid it. Top "1": tried the side that clashed, then the other. Then the top-left corner (right this time!), a lantern in the middle row, and the right edge. Bottom-left: I put one on the left, and the square beside the "0" stayed dark. Took a hint ("take back A5"), then put two in its place. |

### Answers after W (in character)

1. **What I did, in order:**
   - **Level 1:** the "3" freebie (three in), the "1" (a clash I undid), the "2" freebie, the right edge, a bottom-right clash I undid, then the last square.
   - **Level 4:** the one-sided "1" first, then the next "1" (by the zero by mistake, undid it). Then the top "1" (a clash I undid), the top-left corner, the middle, the right edge, the bottom-left, the bottom-right, a hint, and two lanterns to finish.
2. **Not sure what to do?** Level 4 at the very end. One dark square beside the bottom "0", everything else lit and happy. I could have worked it out, but it was lunchtime and I wanted it finished.
3. **Hint:** "Take back the lantern at A5 (1 of 1)". Right after, I put one in the corner below it and one beside it, and it lit up. Two taps.
4. **Stuck and couldn't tell why?** Not really this time. On W-4 I knew *where* the problem was, just not the neat fix.
5. **Harder, easier, same?** Gently harder from 1 to 4, which is how it should be. Both 6×6, both started with a freebie. W-1 was easier than last week's W-1 by a mile.

---

## Then

**6. Compared with last week (going through my complaints):**

| Last week's complaint | This week |
|---|---|
| W's level 1 was a 6×6 full of zeros with no obvious start; I needed a hint on level 1 | **Fixed.** W-1 opens with a "3" that has exactly three spaces. No hint needed. |
| W jumped to 7×7 by level 8 | **Can't say for W** (I played W-4, still 6×6). But **J now has a 7×7 at level 10**, harder than its level 15. So the lump moved to J. |
| "Every number happy, a couple of squares dark, nothing tells me which lantern is wrong" | **Partly fixed.** The hint now says "take back X (1 of 1)", which tells me how many are wrong as well, and that's lovely. The new stuck picture draws a line from the dark square to the rocks next to it. But on J-15 the culprit was my lantern far away, not the rocks. A line to the rocks would have sent me looking in the wrong place. It happened in J-15 and W-4, so it's still the moment I reach for a hint. |
| Picked the wrong three around a "3" | Still me (J-1, J-10). Not the game's fault. The clash shows straight away, so it's cheap. |
| Numbers as dots on pebbles; the zero looked like an "O" | **Fixed.** Digits are back, big and clear, and there's a switch in settings if you want dots. |
| Orange dots/digits = done? I wasn't sure | **Partly fixed.** The guide shows the "4" turning gold when its lanterns are all round it, so I'd learn it from that. |
| White ring on a number, no idea why | **Partly.** Now a ring seems to mean "look here": round the "3" on the place hint, and round the "1" when it has too many. The same ring for two meanings is a bit muddling. |
| The "remove" hint picture was unclear | **Partly fixed.** There's now an arrow from the glowing lantern to the "0" it's upsetting, and the zero turns grey with a ring. Better. An up-arrow could still read as "move it up", though. One word ("take out") would settle it. |
| The squiggly golden button on the left: no idea | **Not fixed.** It's a little lantern on a path with a "+". On the deduce screen it's a house instead. Still a guess. The "+" makes me worry it's buy-more-hints. |
| Level number tiny and grey | **Partly.** It's now the house number on the door, which is cute, but I only realised that after a few screens. |
| No red when lanterns clash | **Not fixed** in the pictures. The guide uses a blue dotted line between two lanterns, and "too many" is grey, not red. Red was the clearest thing in week 1. |
| Wanted the town/house progress | **Partly.** Different houses, and the windows light up as I go, which I love. But I don't see a street I'm filling in yet. |

**7. Tomorrow morning, 10 minutes, choose ONE: Version J (just).**
Level 1 and level 8 were both mine with no hint, and in ten minutes I'd get two or three warm-up wins before the kettle's done. W is honestly level with it this week. W-1 was lovely, and if J keeps sticking a 7×7 at level 10 I'd swap. Not Royal Match: ten minutes isn't enough and I'd run out of lives. Not Wordle: two minutes with my sister, already done. Not "don't touch the phone": we both know.

**8. What would make me delete it now?**
If hints start costing money or run out (that "+" button makes me nervous). Two or three 7×7s in a row that I can only finish with hints. Or if the house just resets every level and there's nothing I'm *building*.

**9. The new phone look (screenshots):**
- **01 guide A (finger taps a square):** First I notice the house and the finger. Tap a square and a lantern appears, and its row and column turn golden. That's clear with no words. The lantern is pale, not glowing, which is slightly odd next to the golden squares.
- **02 guide B (the "4" with four lanterns, finger on the "3"):** The "4" has a lantern on every side and has gone gold. I get "number = that many lanterns touching". The finger on the "3" says "now you do this one". Clear.
- **01c guide C (two lanterns in a row with a blue dotted line):** This is the one I'd hesitate on. I *think* it means "these two can see each other, not allowed". But it's blue and calm, with no cross and no red, so it could just as easily mean "join them up" or "drag one along". It needs a cross or a red flash.
- **03 gentle mid-level:** Gorgeous. A glowing window in the house, golden lit squares with little flowers, big lanterns. The "1" and "2" have gone gold because they're done. The "0" stays white even though it's fine, so I'd wonder why it isn't gold too.
- **04 stuck squares:** The two dark squares get a dashed circle and a thread to the rocks beside them. I'd read it as "these squares are stuck because of these rocks". Clever, but quite subtle, and as I said, sometimes it's my own lantern to blame, not the rock.
- **05 too many:** The "1" goes dark grey with a ring and the two lanterns next to it have halos. I'd spot it, but grey looks like "switched off" rather than "too many". Red or a shake would be clearer.
- **06 hint remove:** The glowing lantern with the arrow up into the grey "0". The hint button changes to a lantern with an up-arrow. I get "this one is upsetting the zero", and I'd probably tap it away. Better than last week.
- **07 hint place:** A pale ghost lantern above the "3" with a ring round the "3". Very clear: put one here, because of that number.
- **08 deduce level 1:** A plain dark board, a "3", a "1" and a "2", and a little house button bottom-left. Looks like the W-1 I played: inviting enough, because there's a "3" in the top row.
- **10 settings:** Sound on/off, and digits vs dots. Simple, no words needed, and I'd pick digits. Fine.
- **Would a first-timer get the game from the guide alone, no words?** Mostly. Lighting rows (A) and the numbers (B) come across. "Lanterns can't see each other" (C) doesn't really. Without red or a cross, my mum would think the dotted line was something to copy.

**10. How close to an app I'd keep on my home screen for months?**
"Nearly there. Seven out of ten, up from a six." It looks pretty enough to sit next to Royal Match now, and the hints are kind. **The single change that would move it most:** let me see my street filling up. After each level, show the house joining a row of lit houses I've done, with something new on each one (a cat in a window, a bakery sign). Then I'd come back for the *next house*, not just the next puzzle.

---

## Out of character: tester notes

- **Reading the board:** I played from the ASCII board, with exact coordinates, ✓/↑/✗/⊘ marks and the `Stuck:` line. I didn't act on `Stuck:` early and only fixed squares once they were visibly the last dark ones. A real Priya on the phone would likely be slower and make more moves.
- **Solving ability:** I worked out every solution early. The mistakes were deliberate persona habits:
  - a lit spot or a "0"-adjacent spot around a "3";
  - the wrong side of a "1";
  - the corner habit;
  - the "take the obvious two of three" choice on J-15's "2".

  The hints (J-10, J-15, W-4) were role-play judgements of her patience, not real stuck points.
- **Difficulty curve:** J-10 is 7×7 with 11 lanterns and three zeros. It is clearly harder than J-15 (6×6, 8 lanterns). J-8 was solvable without a hint. W-1 now has a forced opening (a "3" with exactly three free sides), unlike round 2's W-1. W-4 was a fair step up.
- **Stuck-reason mismatch:** In J-15, with E1 placed, `Stuck: B3 (rocks A3 C3)` blamed the rocks. The real reason B3 couldn't be lit was that E1's row light covered B1, the only legal spot. In the v4 "stuck" screenshot, the thread goes to rocks, so the phone may make the same misattribution. That could point players away from the actual culprit lantern.
- **Hint text:** "F2 can only be lit by a lantern on itself" is clear to me, but slightly technical for her. "1 of 1" in the remove hint is a good reassurance cue.
- **Screenshots:**
  - No red appears for conflicts or overfull in any v4 shot. Conflict in the guide (01c) is a blue dotted line with no negative cue.
  - Overfull is shown in grey.
  - The ring is used both for "too many" (05/06) and "look here because" (07).
  - The left button (lantern on a path with "+") is still unexplained.
  - A satisfied "0" stays white while satisfied numbers turn gold.
  - Guide lanterns are drawn pale and unlit.
