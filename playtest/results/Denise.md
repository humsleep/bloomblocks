# Playtest results: Denise

**Persona:** Denise, 53, Savannah, Georgia (US). Real estate agent, always busy, rarely plays games: Solitaire, and sometimes a word game her daughter put on her phone. Doesn't want to read rules. If it isn't obvious in a few seconds she closes it. Plays while waiting for clients or at the car wash. Uses large text on her phone.

**Play order:** C, then V, then S. Levels 1, 3, 8, 15 for each.
**Session files:** `playtest/sessions/Denise/<code>-<level>.json`

---

## Code C

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (5×5, max 6) | Completed, 5/6 lanterns | 5 | 0 | 0 | 0 | Easy. I put one in the middle, then filled the dark corners. |
| 3 (5×5, max 7) | Completed, 6/7 | 6 | 0 | 0 | 0 | Easy. Same thing: middle first, then corners. |
| 8 (6×6, max 8) | Completed, 7/8 | 7 | 0 | 0 | 0 | Fine. Took a bit more looking, but I always had a spare lantern. |
| 15 (7×7, max 8) | Completed, 8/8 | 13 | 1 | 1 | 0 | Everything lit with 9 lanterns and the limit was 8. The hint said to drop my corner lantern and put one at D1. That made two of them go red, so I moved one to the side and it worked. |

Notes as I went:
- L1: "Light every cell, don't let them see each other, don't use too many." I can do that.
- L15: I put a lantern down the middle of each long row, then patched the gaps, and ended up one over. When it says OVER BUDGET I know I did something wrong, but not what.

**1. What I did, in order:** Played four boards. The first three were quick: one in the middle, then fill in the dark spots. On the last one I ran out of lanterns with one square still dark. I took it back, asked for a hint, did what it said, got two red ones, moved one over to the left edge, and it lit up.

**2. A moment I wasn't sure?** The last board, when every square was lit but I was one lantern over. I didn't know which lantern was the extra. Also for a second I didn't get why D1 and D2 were red. Then I saw they were in the same line.

**3. How I'd solve the next one:** Light the long open rows first, then fill in the leftover dark squares without going over the count.

**4. Last level vs first:** Harder, but in a fair way. The board was bigger and the lantern count was tight, so I had to be smarter about where they went, not just tap the dark spots.

---

## Code V

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (5×5, 5 numbers) | Completed, 6 lanterns | 8 | 0 | 0 | 0 | Middle lantern ran into the "2", so I took it out. Then it went fine. |
| 3 (5×5, 3 numbers) | Completed, 6 | 7 | 1 | 0 | 0 | I put a lantern by the "1", it went red, I undid it and tried the other side. Felt good. |
| 8 (6×6, 6 numbers incl. a 3) | Completed, 8 | 15 | 1 | 1 | 0 | Got all the numbers right, then 5 dark squares were left and every one of them was next to a number. I was stuck. The hint said D1, which I'd already tried and it had gone red. I made it work by removing the other lantern. |
| 15 (7×7, 8 numbers) | Completed, 9 | 18 | 1 | 2 | 0 | Long. The 3 in the corner was easy. Then the bottom got messy. Twice everything was lit except one number was wrong, and the hint sent me to the other end of the board. Two hints got me through it. |

Notes as I went:
- The numbers are kind of like Minesweeper, which I used to play. "3 touching it" is clear.
- The rule line says "A number on a rock = lanterns touching it." That's short enough that I read it.
- On the 7×7 I thought I was done, and then it said "too many lanterns at C6." The hint told me to move something on the top row, which wasn't where I was looking.

**1. What I did, in order:** Played four boards with numbers on the rocks. The first two went OK with one take-back each. On the third I matched all the numbers but couldn't light the last squares, used a hint, and finished. On the fourth I chased the numbers around the bottom, used two hints, and finished.

**2. A moment I wasn't sure?** Level 8, when all the numbers were green but there were still dark squares and every one of them sat next to a number. I didn't know what to do. Also on 15, when one number was off but the hint pointed to a completely different corner.

**3. How I'd solve the next one:** Start with the big numbers next to the edge where there's only one way to do it, then work out from there.

**4. Last level vs first:** A lot harder. There were more numbers and they depended on each other, so fixing one broke another one far away.

---

## Code S

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (5×5, max 6) | Completed, 5/6 | 5 | 0 | 0 | 0 | Easy, same as C. |
| 3 (5×5, max 4) | Completed, 4/4 | 10 | 0 | 1 | 1 | Only 4 lanterns, ran out with 2 dark. The hint told me to drop my corner, which made it worse, so I started over. Second try worked. |
| 8 (6×6, max 6) | **Gave up** at 6/6, 26/28 lit, 2 red | 7 | 0 | 1 | 0 | Ran out again. The hint said "A1 is not in it" AGAIN and told me to use D1, which turned red right away. I'm done with this one. |
| 15 (7×7, max 6) | **Gave up** at 6/6, 32/38 lit | 9 | 0 | 1 | 0 | Pretty board. I lit the long rows and ran out. The hint said C7 and to drop A1 (again!). I did it, and FEWER squares were lit than before. I quit. |

Notes as I went:
- S looks just like C, but it's stingy with lanterns. By level 3 there are only 4.
- Every hint I took said my corner lantern was wrong. Corners are where I always start.

**1. What I did, in order:** The first board was easy. On the second I ran out of lanterns, the hint confused me, I started over and got it. On the third I ran out again, followed the hint, got red lanterns, and quit. On the fourth I ran out, followed the hint, lost lit squares, and quit.

**2. A moment I wasn't sure?** Over and over: as soon as the lantern count was right at the edge. I never knew which lantern was the "wasted" one.

**3. How I'd solve the next one:** Honestly I wouldn't. If I had to, I'd put lanterns where one lights two long rows at once and avoid my usual corner.

**4. Last level vs first:** Much harder, and it got hard too fast, by level 3. It feels harder because there's no room for mistakes. In C I had a spare lantern.

---

## Overall answers (in character)

**5. If I closed the app right now, what would I do instead?** Check my email and Zillow alerts, then play a round of Solitaire. Solitaire I can play without thinking.

**6. Tomorrow morning, 10 minutes, I choose:** **Version C.** It's the one where I felt smart and never felt dumb. I had one extra lantern most of the time, so I could finish a board while waiting at the car wash.
- Not Wordle: my daughter does that, and once a day is fine, but it's a "think of a word" game and I'm not a word person before coffee.
- Not Royal Match: too loud, too many popups, and it wants money.
- Not V: I liked the numbers on the small boards, but the big one took me two hints and too long for ten minutes.
- Not S: it beat me twice.
- Not "don't touch the phone": I'd be sitting in the car anyway.

**7. What would make me delete it?** If the hint keeps making things worse like it did in S. If the boards get so big I need my readers to see the squares. If it starts nagging me with ads or "buy more hints." If I lose twice in a row in a five-minute wait, I'm gone.

**8. To a friend in one sentence:** "You put little lanterns on a grid so every square lights up, but they can't be in a line with each other. It's like Solitaire for your brain, kind of relaxing."

**9. Ranking:**
1. **C**: I won every board and only needed one hint at the end. Good for a short wait.
2. **V**: The numbers make it more interesting and I always knew where to start, but the big boards ran long and I needed hints.
3. **S**: Same as C but it hardly gives you any lanterns. I lost twice and the hints made me feel stupid.

**10. Screenshots:**
- First thing I notice: it's very dark, almost black. The gold lit squares look warm and nice, and the red "Two lanterns see each other" is clear. I'd get that right away.
- Hard to see: the rocks and the empty squares are both gray-blue, just a little lighter or darker. On my phone with the brightness down, or in the sun at the car wash, I'd probably mix them up. On the 7×7 the squares get smaller, and the rocks are only a shade different.
- Small text: "Light every tile" and "5×5 garden" are thin gray letters on dark blue. I'd have to squint, even with my big-text setting. Does it follow my big-text setting?
- The six little circles under "Level 1" are lanterns, I guess? Nobody told me. Once three turned yellow I figured it out.
- There's a big empty space between the title and the board. I'd rather have a bigger board.
- "Garden lit!" with the big yellow Next button is nice and clear.
- Would I keep it? Maybe. It looks calm and grown-up, not cartoony, and I like that. But it's too dark and the contrast is too low for my eyes.

**11. The town / daily puzzle idea:** The town lighting up is cute. I'd like seeing my little town glow, it's like decorating, and that might bring me back for a few days. The daily puzzle I could paste in a chat: my daughter and her friends do that with Wordle, so if she played too, I'd send it to her. That could be our thing. What would bring me back on day 7 is if it's still short and I can win most days, and if my daughter is playing the same puzzle. If the daily one is an S-style board that beats me, I won't be back.

---

## Out of character: tester notes

- **ASCII vs phone:** I read the grid as text with cell names (A1, D4). I can check rows and columns exactly, which is easier than eyeballing a dark phone screen. Conflict lines that span the whole board (like A4 to G4 on V-15) are easy for me to spot by row letter. A real person on a dim screen might miss them, or might not understand why two far-apart lanterns are "seeing each other."
- **Spatial reasoning:** I sometimes worked out a full solution in my head before playing, then played a more naive, persona-like line (center first, corners next, patching later). So my mistakes were partly chosen to fit the persona rather than truly made. Real Denise would probably make more mistakes, and different ones, especially on V-8 and V-15. She might have given up on V-15 instead of finishing with two hints.
- **Timing:** The session times (12–80 s per level) are my command latency, not human time. A real casual player would take several minutes on 6×6 and 7×7 boards, which makes the give-ups more likely, not less.
- **Give-ups on S-8 and S-15 were judgment calls** based on her low patience and on hints that kept pointing at her corner lantern and, when followed literally, made things worse (lit count dropped from 35 to 32 on S-15). I could have solved both. A more stubborn tester would have.
- **Hint wording:** I read "Your current lanterns cannot all be part of an optimal solution; e.g. A1 is not in this one" literally. A real player might not read past the first sentence at all.
- **Rules reading:** I read PLAYTEST.md before playing, so I knew conflict and number semantics better than a no-rules-reading persona would from the one-line rule text alone. I tried to act on just the one-line rule plus feedback, but some leakage is likely.
