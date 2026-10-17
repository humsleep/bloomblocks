# Playtest results, round 2: Megan

**Persona:** Megan, 51, Calgary. School administrator. Does sudoku and killer sudoku daily, plus some nonograms. Loves pure deduction, hates guessing and puzzles with several answers. Patient and methodical. Plays 10 to 15 minutes, mostly in the evening.
**Play order:** J (levels 1, 3, 8, 15), then W (levels 1, 3, 8).
**Sessions:** `/Users/hyukahn/workspace/puzzle-lab/playtest/sessions-r2/Megan/{J-1,J-3,J-8,J-15,W-1,W-3,W-8}.json`

Both codes showed the same rule line: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it." That's the numbers-on-stones game I liked best last week (it was V then). Neither code had a lantern limit.

---

## Code J

| Level | Board | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| 1 | 5×5, 3 numbers | Completed, 6 lanterns | 6 | 0 | 0 | 0 | Nice opener. The 2 in the corner (A5) has only two free sides, so A4 and B5 are certain. Then the 2 at C4 could only use C3 and D4, and the last two lanterns (A1, E2) were the only cells that could reach their corners. One answer. |
| 3 | 5×5, 4 numbers | Completed, 7 lanterns | 7 | 0 | 0 | 0 | The 0 in the corner plus the 2 at E3 gave D3 and E4 straight away. The 3 at B2 had to use B1 and C2, and D3 was already lighting B3, so the third lantern was A2. B4 and D5 were the only lanterns left that could reach their dark cells. Tidy. |
| 8 | 6×6, 5 numbers | Completed, 8 lanterns | 8 | 0 | 0 | 0 | The 3 against the edge (F3) gave three lanterns at once, and the 2 next to the 0 gave two more. D1 was the only cell that could light A1, and that settled the 1 at C5. Pleasant, but it never made me stop and think. |
| 15 | 6×6, 4 numbers | Completed, 9 lanterns | 9 | 0 | 0 | 0 | Same feel as level 8. The 3 on the edge gave three lanterns, the 2 gave two, and the 1 gave one. After that every dark cell had exactly one possible lantern. I expected a 7×7 by level 15. |

Notes as I went: *"J1, good, the corner 2 tells you where to start. J3, the 0 and the 2 work together nicely. J8, the 3 on the wall again. J15, is that it? Still 6×6, and nothing to test."*

**1. What I did, in order.** Same method as last week. I started with the 0s and with numbers that have exactly as many free sides as their value (the corner 2s, the 3s against a wall), and placed those lanterns. Then I looked at what they lit, and found the dark cells that only one remaining cell could light. On every J level that was enough. I placed lanterns in two or three batches as I became sure of them.

**2. Unsure what to do?** No. The rule line is clear and the first move was obvious on every board.

**3. Hints.** I didn't use any. I never needed one.

**4. Stuck without knowing why?** No, never.

**5. Last vs first.** Somewhat harder in that the board is bigger and has more lanterns, but it took the same kind of thinking. Level 15 was barely harder than level 8. I never had to check an either-or, which is the part I enjoyed most last week. It's correct and fair, and it's gentle all the way through.

---

## Code W

| Level | Board | Outcome | Moves | Undos | Hints | Restarts | How it felt |
|---|---|---|---|---|---|---|---|
| 1 | 6×6, 5 numbers (four 0s) | Completed, 8 lanterns | 8 | 0 | 0 | 0 | Different from J1, and I liked it. Four zeros mostly told me where lanterns *couldn't* go, so I had to look for lonely cells boxed in by stones (A4, A6, F1, F3), each with only one place to be lit from. Then the bottom-right corner was an either-or: E6 alone leaves F5 dark, so it had to be F5 plus E6. Proper level-1 thinking, not just copying numbers. |
| 3 | 6×6, 6 numbers | Completed, 10 lanterns | 11 | 1 | 0 | 0 | The 4 is a gift, and then the 2 and the 1s on the left fell in turn. At the bottom I tapped E6 without thinking it through, because it lights the whole bottom row. The board said "Dead cells: F5" straight away. Fair enough. I undid it, put in F5, and then C5 and B6 were forced. |
| 8 | 7×7, 8 numbers | Completed, 10 lanterns | 11 | 1 | 0 | 0 | The best board this week. The 3 at B5 with a stone below it gave three lanterns, and then C3, D4 and F7 were cells only one lantern could reach. I misread row 1 and put E2 in for the 1 on E1. The 2 on D3 immediately showed "can't be satisfied", and F1 became a dead cell. I undid it and saw that C1 doesn't reach past the stone. So F1 it was. Then the real question: D2 or E3 for the 2 on D3? D2 leaves E5 with no possible lantern, so it's E3, then G2. A genuine either-or with one answer. Lovely. |

Notes as I went: *"W1, four zeros! Mostly they tell you where NOT to go. Good. W3, tapped E6 too fast, the dead-cell warning caught me. W8, my own mistake on row 1, but the ⊘ on the 2 told me at once that something was off. D2 or E3, worked out, E3. That's the killer-sudoku feeling."*

**6. W, briefly.**
1. *What I did:* Zeros first, to cross out cells. Then I hunted for cells shut in by stones that only one lantern could light. Then numbers. On W3 and W8 I made one hasty move each, saw it was wrong from the warnings, and undid it. Then I resolved one real either-or on W1 and W8 by following each branch.
2. *Unsure:* Briefly at the start of W1, when four zeros gave me "no" information but no "yes". That's not a complaint, it made me look harder.
3. *Hints:* None. The ⊘ mark and the dead-cell line did that job for me after my mistakes, and they told me what was wrong without telling me the answer. That's how I like it.
4. *Stuck without knowing why:* No. Each time I went wrong, the board told me right away which number or cell had become impossible.
5. *Last vs first:* Harder, and harder in the right way. It was a 7×7 board with more numbers and one either-or that needed real checking. It felt like going from a Monday sudoku to a Wednesday one.

---

## Overall answers (in character)

**7. Compared with last week.**
- *Better:* The budget versions with "pick any of these" endings are gone. Every board I played this week, J and W, had exactly one answer as far as I could reason. That was my main complaint, and it's fixed. The warnings ("needs more than its free sides can take", dead cells) are very helpful when I slip. They told me *that* I'd made a mistake and roughly where, without giving the answer away.
- *Worse:* J doesn't get harder the way last week's numbers version did. Last week's level 8 made me test D4 against E5, but J's level 15 never asked that of me. If J is the main game I'd be bored within a week.
- *The same:* The rule line and the board reading are the same. W feels like last week's V version, or a little harder, and that's a compliment.

**8. Tomorrow morning, 10 minutes. ONE of [Wordle, Royal Match, J, W, no phone].** **W.** Ten minutes is one or two W boards. Each one makes me find something, and each has one answer. J is pleasant, but I could do it half-asleep, and I'd rather save "half-asleep" for my tea. Wordle is three minutes with some luck in it. Royal Match isn't for me. Not touching the phone is tempting, but one tidy deduction is a nice way to start the day.

**9. What would make me delete it?** Same as last week: boards with more than one answer, ads, energy timers, or "watch a video for a hint". New this week: if the difficulty stayed at J's level for weeks. I'd also be annoyed if the warnings ever stopped me from learning to spot things myself. I'd want an option to turn them off on harder boards.

**10. To a friend in one sentence.** "It's a little sudoku cousin where you put lanterns on a grid so every square is lit and no two lanterns shine at each other, and the dots on the white rocks tell you how many lanterns sit next to them. Every puzzle has exactly one answer."

**11. Screenshots (new phone look).**
- *First thing I notice:* the house. A big, cosy house under a moon takes up the top half of the screen, and its windows light up as the garden fills in. It's charming. Then the board, which is much bigger now and sits near my thumb.
- *Stones:* Much better than last week. Plain stones are grey with moss, and the numbered ones are bright white with black dots. I can tell them apart instantly, even at arm's length, which was my biggest complaint before. The lit squares (warm gold) against the dark navy unlit squares are very clear too.
- *Hard to understand:*
  - The numbers are **dots, not digits**. One, two and three dots are easy to count. A **hollow ring** seems to mean 0, but I had to guess that. A 4 would be four dots, which I'd have to count every time. I'd prefer a real numeral, or at least a choice.
  - The dots turn orange when the number is done, I think (the 3 at B2 in the mid-game shot). On the 0 the ring turns gold. That's subtle in the evening, and I'd like a clearer "done" mark.
  - There's **no text at all** on the screen. There's no rule line, no level name, and the tiny "1", "3", "6" in the top-right corner are so small and faint I'm not sure they're the level number.
  - The two round buttons: I guess the lantern with a "?" is the hint. The squiggly one on the left I can't place. Undo? Restart?
  - Some lit squares are pale yellow and some are deeper orange. I don't know whether that means something (lit twice? lit by the last lantern?) or is just decoration.
  - *The hint pictures:* the "place" hint (dashed outline of a lantern on an empty square, with a ring around the 3) is clear: "put one here, look at this number". The "remove" hint is not clear to me. Two lanterns glow a bit brighter and two numbers get dashed circles, but nothing says "take these away". I'd have stared at it.
- *Small phone (SE):* still readable. The board fills the width, and the house shrinks to a strip, which is fine. The squares are a decent size for my fingers.
- *Keep it?* Yes, next to my sudoku app. It's calm, pretty, and the stones are finally easy to read. I'd ask for digits instead of dots, a small "Level 8" label, and words on the remove hint.

**12. Day 7.** What would bring me back is the puzzle itself, if it's W-style and gets a little harder through the week like the newspaper sudoku. Lighting the house is a sweet reward, and I'd enjoy watching the hill town fill in, but on its own it wouldn't get me to open the app. A streak would nudge me, but I'd resent it if it nagged. Would I share the daily result? Yes, with my sister. We already text our Wordle grids every morning, so a spoiler-free result fits right in. Since every board has one answer, comparing makes sense: who needed no undos, who used a hint. I might show the Saturday-hard one to a colleague at school who does the Herald killer sudoku. I wouldn't post it anywhere public.

---

## Out of character: tester notes

- **I solved each board mostly in my head before placing lanterns, in two or three batches.** That's why the logged times are only 18–52 seconds per level. A real Megan would take a few minutes per board, probably 1–3 on J1/W1 and 5–10 on W8, and would place lanterns one by one while looking at the light.
- **The two undos are real reasoning slips, not staged.** On W8 I actually misread row 1 (I forgot that the stone at E1 stops C1's light before F1). On W3 the E6 move was a hasty, plausible human tap. I left both in because the ⊘ and "Dead cells" feedback caught them at once, which is a useful data point. A human on a phone, without the text "Dead cells: F5" line, might take longer to see what went wrong.
- **No hints used on any level.** Megan wouldn't have needed them, so my answers to Q3 come only from the screenshots (03/04), not from using the hint in play.
- **Uniqueness:** My hand reasoning found every J and W board fully forced, with one answer. W1 and W8 each needed one short "try a branch until it fails" step. J never did, at any level. I didn't run a solver.
- **Difficulty curve:** J15 is 6×6 and about as easy as J8. W reaches 7×7 by level 8 and starts with a level 1 built on zeros and lonely cells. W1 might be steeper than ideal for a true beginner, though for Megan it was fine.
- **Text vs phone:** The text board gives digits, cell names and explicit "⊘ / Dead cells" lines. The phone screenshots show dots and rings and no text, so my judgments about readability (dots vs digits, the unclear remove hint, the faint level number) are an interpretation of the images on behalf of a 51-year-old. I can't test eyesight or a dim evening screen.
