# Playtest results, round 3: Megan

**Persona:** Megan, 51, Calgary. School administrator. Does sudoku and killer sudoku daily and some nonograms. Loves pure deduction and hates guessing or puzzles with several answers. Patient and methodical. Plays 10–15 minutes in the evening.
**Play order:** J (levels 1, 8, 10, 15), then W (levels 1, 4).
**Sessions:** `/Users/hyukahn/workspace/puzzle-lab/playtest/sessions-r3/Megan/{J-1,J-8,J-10,J-15,W-1,W-4}.json`

The rule line was the same on both codes: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it." There was no lantern limit.

---

## Code J

| Level | Board | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| 1 | 5×5, 3 numbers | Completed, 7 lanterns | 7 | 0 | 0 | 0 | A gentle start. The 2 at C1 has only two open sides, so B1 and C2 were certain. C2's light knocked C4 out of the 3, so the 3 needed all three of its other sides. The 2 at D3 then had just E3 and D4 left. One answer. |
| 8 | 6×6, 5 numbers | Completed, 8 lanterns | 8 | 0 | 0 | 0 | The 0 next to the 3 gave three lanterns at once, and the two 1s and the 2 followed. With seven lanterns down I thought row 1 was a free choice: A1, B1 or E1? Then I noticed B3, a little cell boxed in by stones with no lantern able to reach it except from B1. That cell settled it. I liked that moment. |
| 10 | 7×7, 6 numbers | Completed, 11 lanterns | 11 | 0 | 0 | 0 | The best J this week. Two 0s fenced things off. The 2 against the wall gave G3 and F4, and F4's light decided the 1 at D3, which decided E3. The 3 at B4 then lost C4, and its lantern at B5 shone along row 5 onto D5, which settled the 1 at E5 (E6, not D5). After that four lonely cells each had exactly one possible lantern. Satisfying, though I never had to test a branch. |
| 15 | 6×6, 5 numbers | Completed, 8 lanterns | 8 | 0 | 0 | 0 | Pleasant but familiar. The 2 next to the 0 gave two lanterns, then the 1s chained, then the same trick as level 8 (B3 is a pocket only B1 can reach). It's back to 6×6 after a 7×7 at level 10, and it was easier than level 10. |

Notes as I went: *"J1, nice. J8, almost thought row 1 was a free pick, then B3 told me B1. Good. J10, 7×7 at last, the 0s do a lot of work. J15, is this the same puzzle as J8 again? Smaller than J10."*

**1. What I did, in order.** On every board I started with the 0s and with any number that had exactly as many open sides as its value, and placed those lanterns. Then I looked at what their light ruled out and went through the numbers again. Once the numbers were done, I hunted for dark cells that only one spot could still light. I placed lanterns in small batches, two to four at a time, as I became sure of them.

**2. Unsure what to do?** Only for a moment on J8, when I thought the last lantern in row 1 could go in three places. That bothered me, given my history with this app. Then I spotted B3 and it was settled. That's a good kind of unsure.

**3. Hints.** I didn't use any on J.

**4. Stuck without knowing why?** No.

**5. Harder, easier, the same?** It got harder from 1 to 10, then dropped back at 15. Level 10 was the peak: 7×7, with one number's light settling another number. Level 15 felt like level 8 again. I still never had to follow an either-or to a dead end on J, which is what I enjoy most.

---

## Code W

| Level | Board | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| 1 | 6×6, 3 numbers | Completed, 9 lanterns | 9 | 0 | 1 | 0 | The 3 at B1 has exactly three open sides, so it was a gift (A1, C1, B2). I asked for one hint here just to see what the hint does, since I'd puzzled over the hint pictures last week. It said "put a lantern at A4, look at the number at A3", which I already knew. Then D4's 2 gave E4 and D5, and three lonely cells (F3, C6, F6) each had one possible lantern. Easier than last week's W1 with the four zeros. |
| 4 | 6×6, 5 numbers | Completed, 9 lanterns | 9 | 0 | 0 | 0 | I liked this. The 1s under and beside stones had only one free side each (D4, E6), and D4's light up the column decided D1's 1 (E1). After just three lanterns every number was satisfied, and the rest was pure "who can light this cell": F2, F5, A1 (the only spot for B1), C3. Then the bottom-left corner was a real either-or. A5 lights three cells but leaves B6 with no possible lantern, so it had to be B5 plus A6. That's the killer-sudoku feeling. |

Notes as I went: *"W1, the 3 in the top row does all the work. Tried the hint once to see. W4, numbers done after three lanterns? Then the zeros do the rest. A5 is tempting, but B6 can't be lit then. B5 and A6. Lovely."*

**1. What I did, in order.** W1: the 3, then a curious hint (A4), then the 2, then the three lonely cells. W4: the two 1s with a single free side, then the 1 at the top, then cell by cell, using the zeros as "no lantern here" marks. I thought the bottom-left corner through before placing B5 and A6.

**2. Unsure what to do?** On W4, only at the bottom-left corner. I had to compare A5 against B5 + A6. It took a minute of thought, and there was one answer.

**3. Hints.** One, on W1, out of curiosity rather than need. It showed "put a lantern at A4, look at the number at A3". It was the same move I was about to make, and the reason it gave was the right one. I placed A4 and carried on. A hint that names the number to look at is the right sort of hint for me. It teaches instead of just doing it for me.

**4. Stuck without knowing why?** No.

**5. Harder, easier, the same?** W4 was harder than W1, in the right way, with a proper either-or at the end. But W1 this week was easier than W1 last week. I only played two W levels, so I can't say much about the curve beyond that.

---

## Overall answers (in character)

**6. Compared with last week.**
- *Better:* The numbers on the phone are real digits now, with a setting to switch to dots. That was my biggest request, and it's done. The level number is on the house door in a clear little badge. The "remove" hint now points from the lantern to the number it's upsetting. Every board I played still has one answer, and the hint I tried was helpful.
- *Worse:* Nothing is clearly worse. J15 being smaller and easier than J10 is a step backward in the curve.
- *The same:* J is still gentle all the way through. W is still the one that makes me think.

Going through last week's complaints:
- J doesn't get harder: **partly fixed.** J10 at 7×7 was a step up, but J15 dropped back to 6×6 and was easier, and J never asked me to test an either-or.
- Dots instead of digits: **fixed.** Digits by default, with a dots option in settings.
- "Done" mark on numbers too subtle: **partly fixed.** A finished number turns gold-outlined, which is easier to see than orange dots. It's still only a colour change, though, and a 0 never seems to turn gold. The "too many" state (screenshot 05) is a greyed number with a ring, which doesn't say "wrong" strongly enough for me.
- No text, faint level number: **partly fixed.** The level number on the door is readable now. There's still no rule text anywhere, which I don't mind once I know the game.
- Squiggly left button I couldn't place: **not fixed.** It's a little path with a lantern and a "+". I still don't know what it does (more levels? a map?). On one screen it's a house instead.
- Lit squares in two different shades: **fixed.** They're one even gold now, with little flowers.
- "Remove" hint unclear: **partly fixed.** The glowing lantern with an arrow to the circled 0 tells me "this lantern is the problem with this number". But the arrow points *up*, so it could be read as "move it up". A small "×" or a lifted-off lantern would make it plain.
- Option to turn warnings off on harder boards: **not fixed.** Settings only has sound and digits/dots.
- (Week 1) several answers: **still fixed.** (Week 1) stone vs floor contrast: **still fixed.**
- Undo: I've never seen an undo button on the phone screens. I suppose tapping a lantern again takes it away, but I'd want to be sure.

**7. Tomorrow morning, 10 minutes: Wordle, Royal Match, J, W, or no phone?** **W.** One W board like level 4 is about ten minutes for me, and it ends with a proper either-or that has one answer. That's what I want before work. J is fine, but it's the version I'd do half-asleep. Wordle is three minutes with some luck in it. My sister and I will do it later anyway. Royal Match is not for me. Not touching the phone is honestly tempting, but one tidy deduction with my tea is a nicer start.

**8. What would make me delete it now?** The same three things: a board with two answers, ads or energy timers or "watch a video for a hint", and difficulty that never grows. If after a month every board still felt like J8, I'd drift back to the Herald killer sudoku and the app would quietly go to the second page and then away.

**9. Screenshots.**
- **01 onboarding A:** First I notice the hand tapping a square and a lantern appearing. The light runs right and down and stops at the stones. That teaches "a lantern lights its row and column until a rock" quite well, without words. The 2s and the 3 are right there, but nothing in this picture tells me what they mean yet.
- **02 onboarding B:** First the gold 4 with a lantern on each side. That's clear: four lanterns touch the 4, and it turns gold when it's right. The hand on the 3 confuses me. Am I meant to tap the rock? It has two lanterns beside it already. Is the point that it needs one more? Also, the lanterns in this picture don't light anything, unlike picture A, which made me wonder whether they're "pretend" lanterns.
- **01c onboarding C:** Two lanterns in the top row joined by a blue dotted line, and the hand placing the second one. I think this is meant to say "these two can see each other, which isn't allowed". But blue dots look friendly, like "connect these". There's no red, no cross, no frown. A first-timer might think that's what you're supposed to do.
- **03 mid-game:** Real digits, at last. The finished 1 and 2 turn gold and the unfinished 3 and 0 stay white, which is easy to see. The lit squares with flowers are pretty. The level number "6" on the door is a nice touch. One window in the house is lit.
- **04 stuck stone:** First the two dashed circles on dark squares, with lines running to the 0 and the 2 (top) and to the 1 (bottom). I worked out that it means "this square can't be lit any more, and these rocks are why". That's very useful, but I had to think about it. The lines through the rocks look a little like a necklace.
- **05 overfull:** The 1 at the bottom has two lanterns beside it, and it's gone grey with a ring. I can tell something's different, but grey reads as "switched off", not "too many". I'd like red, or the number shaking.
- **06 hint remove:** The lantern under the 0 glows blue, with an arrow to the circled 0. Much better than last week: I can see which lantern and which number. But "take this one away" still isn't said. The up arrow could mean "move it up". The hint button turns into a lantern with a little chevron, which I don't understand.
- **07 hint place:** A pale outline lantern on an empty square, and a gold ring around the 3. Perfectly clear: "put one here, look at this number". Same as last week, and still the best of the pictures.
- **08 deduce level 1:** It's the same board I played as W1. A calm, empty board, clear digits and a "1" on the door. The left button is a little house here instead of the path. I don't know why it changes.
- **10 settings:** Sound on/off, and digit "3" versus a three-dot stone. Plain and clear, and I'd pick the digit. It's nice that they listened. There's no "turn off warnings" or "show mistakes" option, which I'd like for harder boards.
- **Would a first-timer get the game from the guide alone, without words?** Mostly, not completely. Picture A teaches placing and how light travels. Picture B teaches the numbers, if you look at the 4 rather than the hand. Picture C is the weak one: I don't think a newcomer would understand "lanterns mustn't see each other" from a blue dotted line. Nothing says "light every square" either, though the house windows hint at it. I'd add a red cross or a shake on picture C, and a closing picture of a fully lit board with a tick.

**10. How close to an app I'd keep for months?** I'd say a 7 out of 10, up from about 6 last week. It's on the home screen, next to the sudoku, but it hasn't earned its place there yet. The single change that would move it most is a steady difficulty curve on the W-style boards, like the newspaper going from Monday-easy to Saturday-hard, so that by Thursday I'm regularly testing an either-or like W4's corner. The looks are nearly there now. What I need to know is that the puzzles will keep growing with me.

---

## Out of character: tester notes

- **I solved each board mostly in my head and entered lanterns in batches of 2–5.** The logged times are about 17–30 seconds per level, which doesn't represent real play. A real Megan would take perhaps 2–4 minutes on J1/W1 and 6–10 on J10/W4, placing lanterns one at a time.
- **The one hint (W1) was a deliberate curiosity check, not a need.** I asked after placing the 3's lanterns, when A4 was already obvious. Q3 relies on it. I never saw a "remove" hint in play, so those comments come only from screenshot 06.
- **Uniqueness (hand reasoning, no solver):** all six boards were fully forced. J8 and J15 used the same idea (a stone-boxed pocket at B3 reachable only from B1). J10 had one cross-number interaction (B5's light deciding the 1 at E5). Only W4 needed a genuine two-option comparison (A5 vs B5+A6). J never required branch testing.
- **Curve:** J15 (6×6, 8 lanterns) is easier than J10 (7×7, 11 lanterns). W1 this round is the same board as screenshot 08 ("deduce 1") and is easier than round 2's W1.
- **Text vs phone:** The text harness gives explicit "Stuck:" reasons and ⊘/✗ marks. The phone conveys these as dashed circles, connector lines and a greyed number. My judgments on clarity (05 overfull reading as "off", 01c's blue dotted line reading as "connect", the up-arrow on 06) are interpretations of still images for a 51-year-old on a dim evening screen. Animations might make them clearer.
- **Undo:** I never saw an undo or restart control in any screenshot. If tapping a lantern removes it, a first-timer may still look for an undo button.
