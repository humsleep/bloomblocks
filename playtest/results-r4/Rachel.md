# Playtest results, round 4: Rachel

**Persona:** Rachel, 49, Toronto. Accountant. Plays LinkedIn Queens, Zip and Tango every workday morning, compares times with colleagues, keeps streaks religiously. Competitive about speed, wants clean logic with one answer, likes sharing results, gets bored once a puzzle type feels "solved".

**Play order:** J 12, 16, 20, 30, then W 4. Sessions are in `playtest/sessions-r4/Rachel/`. Same rule line as always: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it."

---

## Levels

| Level | Outcome | Moves | Undos | Hints | Restarts | Time (log) | How it felt |
|---|---|---|---|---|---|---|---|
| J-12 (6×6) | Completed | 9 | 0 | 0 | 0 | ~30s | The "3" on the left edge only has three sides, so that's three free lanterns. The top "3" takes three of four. The "2" can't use C4 because B4 lights it. Then the "1" and the "0" settle the bottom. The last dark squares (D5, F2, F5) only work with F5. A good straight chain, but no real decision. |
| J-16 (7×7) | Completed | 10 | 1 | 0 | 0 | ~27s | Lots of forced moves: the "1" between two rocks, the "3", the "2". Then D4 lights the G column, so G5 has to light the corner. At the top I tapped A1 because it lights the most. The board said `Stuck: C2 … G2 (light from A1 F3 D4 B6 E6; rocks G1 C3 G3)`. My A1 *was* in the list this time, but so were four other lanterns and three rocks. I knew A1 was the only one I'd picked by choice, so I undid it and put A2 + C1. |
| J-20 (7×7) | Completed | 11 | 0 | 0 | 0 | ~15s | The easiest of the four. Only three numbers. The "3" forces three, the "2" takes the two sides that are left, the "1" takes G2, and then five squares each light only themselves. Fastest time of the day on a 7×7. This is the level where I thought "oh, it's J again." |
| J-30 (8×8) | Completed | 14 | 1 | 0 | 0 | long (most of it me thinking before tapping) | Finally a big board. Five zeros. The forced ones went quickly: H6, F5, F8 + G7, A7 + B6, H3 for the G3 corner. Then C4 can only be lit from D4, which kills D7, so it's C7. The top-left took real thought. I took E2 for the "1" because it also lights F2. The board said `Stuck: C3 (light from E2; rocks C2 A4 B4)`. That was spot on. C3 sits between the "0" and nothing else, so only a lantern on E3 in row 3 can reach it. Undo, then E3, D1, F2, A2. That's the "aha" I play for. Best J board I've had. |
| W-4 (6×6) | Completed | 9 | 0 | 0 | 0 | well under a minute | **The same board as last week.** I remembered it: E6, D4, E1, then A1, C3, F2, F5, and this time B5 + A6 instead of the greedy A5. Clean run, no mistakes, but it's memory, not logic. If the daily ever repeats a board, I'll notice. |

---

## Answers (in character)

**1. Did J get harder as you went?** Not in a straight line. 12 to 16 was a small step up (bigger board, one top-left decision). **20 was a step down**: three numbers and a lot of "this square only lights itself". **30 was properly harder**: 8×8, five zeros, and one deduction (C3 needs E3) you only find if you look. So the curve goes up, dips at 20, then jumps at 30. Same shape as before: a dip in the middle and the hard part pushed late. If I'm playing in order, level 20 is where I'd get bored.

**2. Stuck and couldn't tell why? Did the "Stuck:" line help?** It's much better. On J-30 it said `C3 (light from E2; …)`, and E2 was exactly the lantern I'd placed lazily. It named my lantern first. That's the fix I asked for. On J-16 it named my A1 too, but buried in a list of five lanterns and three rocks. All true, but as an accountant I want the *one* line item that changed. Five lanterns is a full audit, not a pointer. I found it because A1 was my only "choice" lantern, not because the message told me.

**3. Hint or undo, what happened right after?** Two undos, no hints. Both times the undo took the culprit back and the right move was obvious within seconds (J-16: A2 + C1; J-30: E3, then D1 for the "1", F2 and A2 by elimination). Undo is quick and clean. I didn't use a hint; I was racing my own times.

**4. Round-3 complaints, one by one:**
- *J's difficulty peaks too early (15 back to 6×6, reused trick).* **Partly fixed.** J-30 is a real 8×8 step up with a new deduction. But J-20 is easier than J-16, so it's still not a steady climb.
- *No timer anywhere.* **Mostly fixed.** The daily result shows ⏱ 2:41 and a 🔥 streak, and it's in the share text. But I don't see a timer *while* I play (08), only at the end. Queens shows it ticking. I want to see the clock.
- *"Stuck" blames rocks when my own lantern is the culprit.* **Fixed.** The text now says "light from E2", and screenshot 04 draws a thread to the lantern. Sometimes the list is too long (J-16), so: fixed, but noisy.
- *Two-lanterns rule shown only by a dotted line.* **Fixed.** Screen 03 now has red halos on both lanterns and a red ✕ between them. Nobody could miss that.
- *Guide was missing the goal.* **Fixed.** Screen 00 is a fully lit little board with the "4" gone gold and the house windows on. That's the goal.
- *Guide B lanterns didn't light anything.* **Fixed.** In 02 the floor lights up around the "3".
- *Overfull rock not obviously "wrong".* **Partly fixed.** In 05 the "2" turns dark red with a red ring, which is better. But it has a double *up* arrow on it. To me, up means "needs more", the opposite of what's wrong. I'd expect a down arrow or a minus.
- *Squiggle/road button means nothing.* **Not fixed.** Still a road with a lantern on it (07), and on the daily it's a house. Still no label. I've just stopped pressing it.
- *Tiny level number.* **Same.** It's on the door, readable, fine. Not worth more fuss.
- *Top half is sky and house.* **Same.** It lights up nicely as you solve, and I've accepted it, but on a speed puzzle I'd trade half of it for a bigger board.
- *Same trick repeated across levels.* **Better.** J-30 had a new one. J-20 had no trick at all.

**5. Screenshots (v5):**
- **00 guide goal:** First thing I see: a fully lit 3×3 with four lanterns around a gold "4", and the house windows on. "Light it all and the house lights up." Clear. It also quietly teaches that a gold number means "done".
- **01 guide light:** A hand tapping, and a yellow cross of light running up the column and left until it hits the "4" rock. Clear: light goes in straight lines and rocks stop it.
- **02 guide numbers:** Three lanterns around a "3", which goes gold. Clear. The "0" next to it stays white even though it's also "correct". A first-timer might wonder why only one of them changed colour. The hand at the bottom right, pointing at an already-lit square, confused me. What is it tapping?
- **03 guide conflict:** Two lanterns in a row with red halos and a red ✕ between them. Instantly clear: not allowed. Best of the four.
- **Would a first-timer learn all the rules without words?** Yes, now. Goal, light, numbers, conflict: all four are there. The only thing it doesn't show is that a "0" means *no* lantern can go next to it, and that's the rule W leans on most.
- **04 stuck light:** A dark square with a crossed-out star, and thin threads to the lantern above and to the "2". It points at the lantern now. Good. The dashed rings around the "3" and the other "2" are unexplained: do they mean "unsatisfied"? I'm guessing.
- **05 overfull:** The red-brown "2" with a red ring stands out, good. But the "^^" arrows say "more" to me, and the problem is "too many".
- **06 hint remove:** One lantern glows blue, and the hint button turns into a lantern with a curly back-arrow. "Take this one back." Clear. I'd like a small "1 of 2" like the text version has, so I know how deep the hole is.
- **07 undo and buttons:** Three round buttons: road, undo arrow, lantern-?. Undo and hint are obvious. The road still isn't. No timer while playing.
- **08 daily start:** A 6×6 with a glowing frame and a house button. Nothing says "Daily", no number, no date, no clock running. I'd want "#3" and a ticking timer at the top. It's half the screen of sky, there's room.
- **09 daily result:** **This is what I've been asking for.** A big ⏱ 2:41 and 🔥 5, with a share button. Lovely. Unclear: the two little lanterns next to the streak, one lit and one dark. Streak freezes? Hints? No idea. Also no "best time" or "yesterday" to beat.
- **10 share sheet:** The system share sheet (in Korean on this phone) with "Lanternly 🌒" as the preview and Copy. Fine, it's the normal phone sheet. I can't see the full text before I send it, but Copy works for Teams.

**6. The share text.**
```
Lanternly #3 🌒
🟨🟨🟨🟨🟨🟨✨
⏱ 2:41 🔥3
```
**Yes, I'd send it.** To the team Teams chat where Queens and Tango times go, before the 9 o'clock stand-up, and to my sister. What I'd change:
- The row of six 🟨 means nothing to me. Is it the six rows? Six lanterns? If it means "no mistakes", say so. Queens doesn't need squares; the time *is* the brag. I'd use that line for something that counts: `0 hints · 1 undo`, or a ✨ only for a clean run.
- Put the time first and bigger: `Lanternly #3 ⏱ 2:41` on line one. In a chat preview, line one is all anyone sees.
- Add a link so Priya can play the same board in one tap.
- 🔥3 is good. Keep it.

**7. Tomorrow morning, 10 minutes, one choice: the daily of this game.** Now it has a time and a streak I can post, and that's the whole reason I play puzzles in the morning. Version W is still the better puzzle, but W-4 was the same board as last week, and I can't post a time for it. Version J is fine but dips at 20. Wordle is the bus. Royal Match eats mornings. Not touching the phone isn't an option, I have streaks. My one worry: the daily is "gentle". If it's J-20-gentle, everyone in the chat gets 1:05 and there's no race. Give it a W-style Friday.

**8. Score: 7.5 / 10** (up from 6.5). The timer and streak in a shareable result, the fixed guide, and the stuck line that finally names my lantern all moved it. The single change that would move it most now: **make the daily a real race, with a live timer on screen while I play and a difficulty that builds over the week (gentle Monday, W-8-hard Friday).** If every day is gentle, the times all bunch together and there's nothing to brag about.

---

## Out of character: tester notes

- I solved every board by deduction from the ASCII grid. My two wrong taps (J-16 A1, J-30 E2) were deliberate "greedy speed-player" taps on choices I hadn't finished checking, so I could see the Stuck line. Both are plausible for Rachel.
- **J-16 Stuck line, verbose:** after A1 the reason listed `light from A1 F3 D4 B6 E6; rocks G1 C3 G3` for both C2 and G2. It's correct, but it lists every contributor. The one lantern that wasn't forced (A1) isn't singled out. Consider ranking or listing only the lanterns whose removal would free a candidate. In J-30 only E2 was listed, which was ideal.
- **W-4 is identical to round 3's W-4** (same index, same seed). A returning tester recognises it instantly, so its timing and mistakes this round reflect memory, not difficulty.
- **J curve:** J-20 (3 numbers, 7×7, ~15s, five self-lighting singletons) was clearly easier than J-12 and J-16. J-30 (8×8, one non-local deduction: C3 forces E3) was the only board with a real "find it" step.
- I never used `hint` this round, so I have no new data on the hint text. The 06 screenshot read is from the image only.
- The "since start" counter in `show` keeps counting after COMPLETE (e.g. J-12 showed 408s later). The times in my table are from the move output at completion. J-30's log time is dominated by my reasoning before the first taps, not by tapping.
- The screenshot 09 streak (5) differs from the share text in the question (🔥3). I assumed these are just different sample states.
- 05: the "^^" (double up-chevron) on an overfull rock reads as "needs more" to me; this may be a real design issue, not just my reading.
- The project CLAUDE.md was auto-loaded into context. I ignored it and opened only the allowed files.
