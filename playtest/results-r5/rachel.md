# Playtest results, round 5: Rachel

**Persona:** Rachel, 49, Toronto. Accountant. LinkedIn Queens/Zip/Tango every workday morning, compares times with colleagues, keeps streaks religiously. Competitive about speed, wants clean logic with one answer, likes sharing results, bored once a type feels "solved".

**Play order:** daily 2026-11-05 (J), J 22, 30, 35, then W 6. Sessions in `playtest/sessions-r5/Rachel/` (`daily.json`, `j22.json`, `j30.json`, `j35.json`, `w6.json`). Rule line unchanged.

---

## Levels

| Level | Outcome | Moves | Undos | Hints | Restarts | Time (log) | How it felt |
|---|---|---|---|---|---|---|---|
| Daily 11-05 (6×6) | Completed | 9 | 0 | 0 | 0 | 19s | Three numbers. The "2" at C5 has only two free sides, so C4 + D5. C4 lights C2, so the "3" is B1, A2, B3. B3 lights E3, so the "2" is E1 + F2. B6 and E6 for the bottom row. No decision anywhere. Done before my coffee cooled. |
| J-22 (7×7) | Completed | 12 (incl. 1 tap-off) | 0 | 0 | 0 | 41s | Zeros and the "2" at B2 force C2 + B3, then G1, G5, A4, A7. At the "2" on E4 I tapped D4 because it looked central. The board said nothing (`Stuck: none`). I put E3 next, and only then: `Stuck: F4 — take back D4`. Right answer, one line. Took D4 off, F4, then D6 and C5. A real little deduction in the middle. |
| J-30 (7×7) | Completed | 12 | 1 | 0 | 0 | 31s | The "3" at D4 plus the "1" at C3 means E4 and D5 are certain. A6/B7 from the corner "2". F7, G6. Then I tapped D3 for the "3" too fast: `Stuck: C2, G2, C4 — take back D3`. One lantern named, exactly right. Undo, C4, G3 (only thing that can reach G2), D2, A1, E1. Nice "G2 needs G3" moment, but it's a 7×7 again. Not the "big one". |
| J-35 (7×7) | Completed | 11 | 0 | 0 | 0 | 26s | Straight chain: "1" at C3 forces D3, so the D1 "2" is C1 + E1, the C2 "2" adds B2, E3 forces F3, E6 forces F6 + E7, G4 is the only way to light G2, A5 the only way to A3. Clean run. Easier than 30. |
| W-6 (7×7) | Completed | 12 (incl. 1 tap-off) | 0 | 0 | 0 | 28s | Corner "2" (F7 + G6) and the "1" at A5 (A4) are free. At the "1" on D6 I tapped D5 greedily: `Stuck number: C4 (2) — take back D5` straight away. Correct, and it told me *why* in one word: the "2" can't come right. C6 instead, then C3 + D4, D1 + E2, B2, E5. Best board of the day, and a new one this time. |

---

## Answers (in character)

**1. The daily.** It felt like 20 seconds, because it was. Three numbers on a 6×6, and every move is forced from the first one. For a *morning ritual* the size is right: it fits between the kettle and the bus. For a *race* it's too small. If Priya and I both solve it with no mistakes, we post 0:19 and 0:21 and the difference is how fast we tap, not how well we think. Would I do it every day? Yes, for the streak. Would I *talk* about it every day? Only if some days are harder.

**2. J levels.** 22, 30 and 35 were all 7×7 with about eleven lanterns, so they didn't really climb. 22 had a real "find it" step at the E4 "2" (D4 looks fine but kills F4). 30 had "only G3 reaches G2". 35 was a straight chain, the easiest of the three. **Level 30 was not a big one this time.** Last week's 30 was an 8×8 with five zeros and I loved it. This 30 is a regular 7×7 I did in half a minute. Not too long, certainly, but not satisfying as a milestone either. I'd happily spend 3 minutes on a "30".

**3. The Stuck line.** This is the round it got right. Three times stuck, three times **one** lantern named, every time the one I'd placed by choice:
- J-30: `Stuck: C2, G2, C4 — take back D3`. Perfect.
- W-6: `Stuck number: C4 (2) — take back D5`. Perfect, and immediate.
- J-22: `Stuck: F4 — take back D4`. Correct, but **one move late**: right after D4 it said `Stuck: none`, although D4 had already doomed the E4 "2" (whatever goes next, E3 or F4, leaves the other dark). It only spoke once I'd made a second move on top of the mistake. Also note it blamed D4, not the E3 I'd *just* placed. That's correct and smart, but undo would have taken E3. I tapped D4 off by hand instead.

**4. Round-4 complaints:**
- *J difficulty not a steady climb (20 dipped).* **Not fixed, different shape.** 22/30/35 are flat: all 7×7. 35 is easier than 30. And 30 lost its 8×8.
- *No timer while playing.* **Not fixed.** 09 shows the calendar tile but no running clock.
- *Stuck line too verbose (five lanterns + three rocks).* **Fixed.** One culprit, every time. Screen 03/04 also draws a single thread to one lantern.
- *Overfull rock shows "^^" (reads as "needs more").* **Fixed.** 05 now has a red "minus lantern" pill on the "2". Reads as "one too many". 
- *Squiggle/road button means nothing.* **Fixed.** It's now a row of little houses, and it opens the street. On the daily it's a house = go home. I get both.
- *Hint picture has no "1 of 2".* **Not fixed.** 06 adds a nice arrow from the lantern to the "2" it overloads (the "why"), but still no count.
- *Daily has no number or date.* **Partly fixed.** There's a calendar tile "13". But the share says "#5", so is 13 the date or the number? Pick one.
- *Six 🟨 squares in the share text.* **Fixed.** Gone; ✨ for a clean run is exactly what I asked for.
- *Time on line one.* **Not fixed.** Line one is still "Lanternly #5 🌒".
- *Link so others can play.* **Not fixed.**
- *No best time / yesterday to beat.* **Not fixed.** 10 shows time and streak only.
- *Make the daily a real race (harder some days).* **Can't tell from one day**, but this one was the gentlest board of the morning.
- *Guide never shows what "0" means.* **Fixed.** 01 is exactly that.
- *Dashed rings on numbers unexplained.* **Same.** Still in 03 and 04. I'm now fairly sure they mean "this number is affected", but it's a guess.
- *Top half is sky and house.* **Same.** Accepted.
- *W repeated last week's board.* **Fixed** for me: W-6 was new.

**5. Screenshots (v6):**
- **01 guide zero:** First I see the red "0" with a minus-lantern pill and a red ✕ to the lantern next to it, and the hand tapping that lantern away. "Nothing may touch a 0." Clear. Best guide card so far.
- **02 guide conflict:** Two lanterns with red halos and a ✕ in the light between them. Clear. The hand is pointing at a dark empty square below. Is it saying "put one there instead"? Slightly confusing, again.
- **03 stuck one culprit:** A dark square with a crossed-out star and one thread to the lantern on the top row. One culprit, finally. The dashed rings around the "3" and the "2" are still unexplained, and the thread also bends towards the "2", so at a glance it's two things.
- **04 stuck number:** The "3" with a dashed ring and a thread to the top-left lantern. Clear: "this lantern is why the 3 can't work". Good.
- **05 overfull:** Red "2" with the minus-lantern pill. Reads as "too many". Fixed.
- **06 hint remove why:** The hint button turns red with a lantern-and-back-arrow, the offending lantern glows red, and an arrow runs from it into the overfull "2". "Take this back, because of that." Very clear. Still no "1 of N".
- **07 tower reveal / 07b finger:** The camera swings to the lit lighthouse with a "1" badge, then a hand taps it. **Yes, I now understand: the tower is where the harder puzzles are, and you tap it.** Before this I never knew it was a button.
- **08 tower courtyard:** A tall tower instead of a house, door number 3, sparkly frame, and a tiny house with "1" on the right to get back. Clear that I'm on a different track. I like that the frame sparkles: it says "special".
- **09 daily start:** Calendar tile "13" with a moon, home button on the left. I know it's the daily. Still no clock while playing, and "13" vs "#5" in the share is confusing.
- **10 daily result:** Big ⏱ 2:41, 🔥 5, share and home. The two little umbrellas over lanterns and three dots: I'd guess streak shields (one used, one spare?). Better than last week's unlabeled lanterns, still a guess. No best time.
- **11 settings:** Sound on/off, "3" vs dice dots for numbers, share with or without the clock. Icon-only but I worked it out. I'll leave the clock on, obviously.
- **town-12 / town-30 / town-60:** A street of lit houses with door numbers, cats on roofs, strings of lanterns, and the lighthouse growing more lit windows (4, 15, 32). It's pretty, and it's a progress bar I can read: a house per level, a window per tower level. **Does it make me come back?** Not on its own. I come back for the streak and the time. But I'd glance at it on Fridays, and the tower windows counting up is the one bit that speaks to me: it's a score.

**6. Share text.**
```
Lanternly #5 🌒
✨ ⏱ 2:41 🔥5
```
**Yes, I'd send it**, to the team Teams chat before stand-up and to my sister. It's short and the ✨ is a nice brag. What I'd change:
- Put the time on line one: `Lanternly #5 ⏱ 2:41 ✨`. Chat previews show one line.
- Add a link so people can play the same board.
- Make "#5" match whatever the calendar tile says.
- 🔥5 is fine on line two.

**7. Tomorrow morning, 10 minutes, one choice: this game's daily.** It has the streak and a time I can post, and that's my morning. W is the better puzzle (today's W-6 had the best moment), but I can't post a W time. My worry stays the same: if the daily is always a 20-second gimme, we all tie and it stops being a race.

**8. Score: 7.5 / 10** (same as last round). The Stuck line is now exactly what I wanted, the overfull badge and the road button are fixed, the tower makes sense, and the share text is clean. But the two things that matter most to me haven't moved: **no live clock** while I play, and a **daily so easy everyone ties**. Single change that would move it most: **a daily with real spread (harder later in the week, a W-6-class board on Fridays) and a visible ticking timer.** What would make me delete it: losing my streak to a bug, or a month of 20-second dailies with nothing to compare.

---

## Out of character: tester notes

- All boards solved by deduction from the ASCII grid. My three wrong taps (J-22 D4, J-30 D3, W-6 D5) were deliberate "greedy speed-player" taps on the obvious-looking cell for a number with two options, to see the Stuck line.
- **J-22 Stuck lag:** after D4 (lanterns G1 C2 B3 A4 D4 G5 A7) the board showed `Stuck: none` and `E4 2↑`, though the position was already unsolvable: E4 needs one of E3/F4, and either choice leaves the other cell with no legal light source. The Stuck line only fired after a second move (E3). It then blamed D4, not the last move E3, so `undo` would remove the wrong lantern. Both are correct in logic but the lag cost a move.
- **J-30 is a 7×7 this round** (round 4's J-30 was 8×8 with five zeros). J-22, 30 and 35 are all 7×7 with 10–11 lanterns; 35 was the easiest of the three. No 8×8 in this set.
- Daily 11-05: 6×6, 3 numbers, 9 lanterns, all forced from the first move. Very gentle; times would cluster.
- Times in the table are the "since start" counters at completion and include my shell round-trips, not real thinking time.
- Screenshot 09/10 show calendar "13", share text says "#5": possibly different sample states, but worth checking they refer to the same thing.
- I ran only `npm run -s play -- ...` commands (several chained with `for`/`&&`/`| head` in one shell line to save round-trips; still only play commands). I read only tools/PLAYTEST.md, my own round-4 notes and the listed screenshots. The project CLAUDE.md was auto-loaded into context; I ignored it. I did not read rounds 1–3 notes (round 4 already lists the earlier complaints).
