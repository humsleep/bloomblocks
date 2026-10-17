# Playtest results: Lisa

**Persona:** Lisa, 44, Columbus, Ohio. HR manager, two kids (11 and 14). Plays NYT Wordle and Connections every morning with her first coffee and posts results in the family group chat; Wordle streak of 200+ days. Plays on her phone in spare minutes (school pickup line, coffee line). Dislikes ads that interrupt and anything that feels like homework. Good at logic, impatient with trial and error. Wears reading glasses at night.

**Play order:** S, then V, then C. Levels 1, 3, 8, 15 of each. Sessions are in `playtest/sessions/Lisa/`.

---

## Version S

Rules line: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns."

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (5×5, budget 6) | Completed with 5/6 | 6 | 1 | 0 | 0 | Started in the middle (C3), then put one straight above it at C1. Red, same column. "Oh, duh." Undid it and finished quickly. Easy. |
| 3 (5×5, budget 4) | Completed with 4/4 | 4 | 0 | 0 | 0 | Corner first, then filled in. Smooth. Felt clever using exactly 4. |
| 8 (6×6, budget 6) | Completed with 6/6 | 10 | 0 | 1 | 1 | Corners first (A1, F6), then middle. With 2 lanterns left there were 4 dark squares in 4 different spots. Restarted and took a hint (F3). After that I saw that the little boxed-in single squares each need their own row, and it fell into place. A bit annoyed I needed the hint. |
| 15 (7×7, budget 6) | Completed with 6/6 | 11 | 1 | 1 | 0 | Center first, then corners. Got to 6 lanterns with ONE dark square (E3). Moved C2 to E2, and then C3 was dark instead. Whack-a-mole. Took a hint. It said C4 and also said my A1 was wrong, so I had to rethink my "obvious" corner. Finished after that, but the hint did the real thinking. |

**Notes in the moment:** "The budget number is what makes it hard. Without it I'd just keep dropping lanterns." "Getting to one dark square with no lanterns left is the worst feeling. You don't know which of your 6 is the bad one."

**1. What I did, in order:** Level 1: middle lantern, made a same-column mistake, undid it, finished. Level 3: corner and then the edges, no mistakes. Level 8: corners and middle, ran out of lanterns, restarted, took a hint, then solved it. Level 15: middle and corners, ended with one dark square, swapped a lantern and got a different dark square, took a hint that told me my corner lantern was wrong, then solved it.

**2. Was there a moment I wasn't sure what to do?** Yes, twice: level 8 with 2 lanterns left and 4 dark squares, and level 15 at 6/6 with one dark square. Nothing on the board tells you which lantern is the wrong one, so all you can do is guess and swap.

**3. How I'd solve the next level:** Start with the squares that are boxed in by rocks, because they need their own lantern, and only then use the big open rows.

**4. Last vs first:** Harder, a lot harder. Level 1 took 20 seconds. Level 15 needed a hint because with a tight lantern count you have to plan the whole board in your head, and if you're off you can't tell where.

---

## Version V

Rules line: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it."

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (5×5) | Completed | 7 | 1 | 0 | 0 | The "2" next to the bottom edge told me exactly where 2 lanterns go. Like Minesweeper, which I like. Used B2 for the "1" at first, then saw A1 could never be lit, so undid it and used A1. Quick. |
| 3 (5×5) | Completed | 8 | 2 | 0 | 0 | Tried B4 for the "1" and then C4 for the "2", and they hit each other. Undid both, used A5, and the rest followed. Satisfying. |
| 8 (6×6) | Completed | 13 | 1 | 1 | 0 | The "3" was easy to start on, but I picked the wrong 3 of its 4 sides (D4). Everything after that looked fine and all the numbers matched, yet 5 squares were still dark. Tried A3 and broke a number. Took a hint (D1). Then I saw D4 had to move down to E5, and it unlocked everything. Last lantern at F3 was a nice "aha." |
| 15 (7×7) | Completed | 15 | 0 | 0 | 0 | Zeros and the "3" in the corner gave me 3 lanterns for free. Got down to one dark square (A5) and moved the bottom lantern up. Then row 7 went dark, so I moved D2 down to D7, and then had to swap F1 to E2 to fix the "3". Every swap had a reason. No hint, and I felt smart. |

**Notes in the moment:** "Ooh, numbers, okay, this is more my speed." "The 0s are great, they tell you where NOT to go." "Level 8 had all numbers matched but still dark squares. Confusing for a sec, because 'numbers matched 6/6' feels like you're winning."

**1. What I did, in order:** Level 1: filled in around the "2" first, put one wrong lantern by a "1", undid it, done. Level 3: made a wrong guess at a "1" that clashed, undid it, then worked it out from the "2". Level 8: started from the "3", picked the wrong side, got stuck with dark squares, took one hint, moved one lantern, done. Level 15: did the corner "3" and the zeros first, then fixed three things one after another (A5, D7, E2), then added C1. No hint.

**2. Was there a moment I wasn't sure what to do?** Level 8, when every number said matched but squares were still dark. I didn't know which lantern to doubt. On 15 I felt stuck for a moment at one dark square, but the numbers told me what to move.

**3. How I'd solve the next level:** Do the zeros and the big numbers next to edges first, and then let each dark square tell you which lantern has to move.

**4. Last vs first:** Harder, but it felt fair. Level 15 was bigger, but I got through it with no hint because every move had a reason. Level 8 was actually the one that got me.

---

## Version C

Rules line: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns." (Same wording as S.)

| Level | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|
| 1 (5×5, budget 6) | Completed with 5/6 | 5 | 0 | 0 | 0 | Done in about 10 seconds. |
| 3 (5×5, budget 7) | Completed with 5/7 | 5 | 0 | 0 | 0 | Same, very easy. Had 2 lanterns to spare. |
| 8 (6×6, budget 8) | Completed with 6/8 | 6 | 0 | 0 | 0 | Easy. Fun in a mindless way, like popping bubble wrap. |
| 15 (7×7, budget 8) | Completed with 8/8 | 14 | 0 | 0 | 0 | Finally had to think. Got to 7 lanterns with 2 dark squares (E1, C7). Tried a swap that just moved the dark square. Then I saw a lantern on the left edge could light the whole column AND row 2, which freed one up. Solved it without a hint. |

**Notes in the moment:** "Is this the same game as S? Same sentence." "Lots of spare lanterns, so it's relaxing, but I'm not really solving anything." "Okay, level 15 at least made me think."

**1. What I did, in order:** Levels 1, 3 and 8: put lanterns in the middle and the corners, and they were done with lanterns left over, no mistakes. Level 15: middle column first, then corners, came up 2 squares short, tried one swap, then moved two lanterns to the left edge and filled in the last two gaps.

**2. Was there a moment I wasn't sure what to do?** Only on level 15, when I had 1 lantern left and 2 dark squares. Before that, never.

**3. How I'd solve the next level:** Put lanterns where they light a whole row and a whole column at once, and fill the corners last.

**4. Last vs first:** Harder, but only level 15. The first three were basically the same easy level. The jump to 15 felt sudden, but it was solvable because I had a couple of spare lanterns to play with.

---

## Overall answers (in character)

**5. If I closed the app right now, what would I do instead?** Check the family group chat to see if my sister posted her Connections score yet, then probably scroll Instagram until the car line moves.

**6. Tomorrow morning, 10 minutes, choose ONE:** **Wordle.** It's my 200+ day streak and the whole family posts in the chat; I'm not breaking that for a game I met yesterday. Not Royal Match because it's ads and lives and it never ends. Of these lantern versions I'd pick V if I had to (the numbers make it feel like a real puzzle, not guessing), but it doesn't have a streak or anyone to share with yet. S felt like guessing with hints, and C was too easy until the last one. "Don't touch the phone" is lovely in theory, but no.

**7. What would make me delete it?** Ads popping up between levels, a timer or "lives" system, or hitting a level where the only way forward is to swap lanterns at random or buy hints. Also if it nagged me with notifications.

**8. Describe it to a friend in one sentence:** "It's like Minesweeper meets Sudoku: you put lanterns on a little garden so every square gets lit, but they can't shine on each other."

**9. Ranking (most likely to play again to least):**
1. **V**: the numbers give you a reason for every move, so I never felt like I was guessing, and I got level 15 without a hint.
2. **C**: relaxing and quick for the pickup line, but too easy until the last level, so it never felt like much of a win.
3. **S**: the tight lantern count made me end up with one dark square and no idea which lantern was wrong, and I needed two hints. That's the trial-and-error I hate.

**10. Screenshots:** First thing I notice is how dark it is: navy on navy, with a big empty gap in the top half of the screen. The rocks are the lighter gray-blue squares and the empty squares are darker, and honestly at night with my readers I'd have to squint to tell a dark empty square from the background. I almost thought the lighter ones were the "lit" ones. Once lanterns are down, the gold glow and the red "Two lanterns see each other" are very clear. I like the red. The row of little circles at the top: I assume it's how many lanterns I have? It's not labeled. "Garden lit!" with the big yellow Next button is cute and clean. On level 15 the squares are a good size for my thumb. Would I keep it on my phone? It's calm and classy, not junky, so maybe, but it looks a bit plain and gloomy. I'd want it a little brighter or warmer.

**11. The town and daily puzzle:** The daily puzzle with a shareable result is the part that matters. That's exactly why I play Wordle and Connections: everyone gets the same puzzle and we compare in the chat. If my husband and my 14-year-old could do the same lantern puzzle and post little squares, yes, I'd come back tomorrow. The town lighting up is sweet, but I wouldn't come back for it. What would bring me back on day 7 is a streak counter I don't want to break, the family chat talking about it, and the puzzle staying 3–5 minutes with no ads. The puzzle should use the numbers version.

---

## Out of character: tester notes

- **I solved most boards analytically before moving.** I mapped the board's row and column runs and often worked out a full solution in my head first. Then I chose moves to copy how Lisa would plausibly play: corners and middle first, realistic wrong guesses. The early mistakes on S-1, V-1, V-3 and the first attempts on S-8, S-15, V-8, V-15 and C-15 came from those plausible heuristics. They were not real confusion on my part.
- **The hints on S-8, S-15 and V-8 were my call about her behavior, not real dead ends.** I judged that an impatient player would reach for a hint at those points. On S-8 and V-8 I could already see the solution. A real human might instead have quit there, or kept swapping lanterns longer.
- **The timestamps in the session files are not human.** Levels show 15–80 seconds, which is far faster than a person on a phone. Use the move, undo and hint counts, not the times.
- **ASCII is easier for me than a phone screen.** Cell names and exact symbols make it easy to trace row and column runs. On the real dark-navy UI, the low contrast between stone and floor (see Q10) would likely slow down a 44-year-old player at night. I saw only the four screenshots and did not play the visual UI.
- **I can do spatial and logical deduction faster than a typical casual player.** That especially helps with V's number rules. Real players may find V-8 and V-15 a good deal harder than I did, and C-15 and S-15 more frustrating.
- **I noticed that C's rule text is word-for-word the same as S's.** C's levels had more spare lanterns. That shaped Lisa's sense that C is "S but easier."
