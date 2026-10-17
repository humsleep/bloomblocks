# Playtest results, round 2: Sophie

**Persona:** Sophie, 47, Brisbane. Hospital nurse on rotating shifts. Plays in 2–3 minute breaks and on the bus (Block Blast, Vita Mahjong). Needs reading glasses; small or low-contrast things annoy her. Often interrupted. Wants to switch off, not be tested. Drops a game if she gets stuck twice.

Play order: J (1, 3, 8, 15), then W (1, 3, 8). Sessions: `playtest/sessions-r2/Sophie/<code>-<level>.json`.

Both versions had the same rule line: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it." My first thought: "Oh, numbers again. That's the Minesweeper one from last week."

---

## Version J

| Level | Outcome | Moves | Undos | Hints | Restarts | Log time | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (5×5) | Completed | 6 | 0 | 0 | 0 | 21s | The 2 in the bottom corner has only two sides, so both get a lantern. I remembered that from last week. Then the 2 in the middle, then two leftover corners. Nice and quick. |
| 3 (5×5) | Completed | 8 | 1 | 0 | 0 | 27s | Went for the 3 first and picked the wrong three sides. The 1 next to it went to "too many" straight away, so I knew which one to swap. One undo, then the rest was easy. A good kind of mistake: it told me right away. |
| 8 (6×6) | Completed, 1 hint | 10 | 0 | 1 | 0 | 38s | The 3 on the right edge and the 2 on the left were easy. Then I put a lantern next to the 1 at the bottom, and two squares in the top-left corner went dark for good. I couldn't see any way to light them. Hint said "Remove lanterns at: D5", just one. I took it off, put one at the top instead, and it all fell into place. A short wobble, not a proper stuck. |
| 15 (6×6) | Completed | 10 | 1 | 0 | 0 | 35s | Did the 3 first again. Put a lantern next to the 2 at the top left and it went red because the lantern on the right could see it. Undid it and used the two corner squares instead. After that the 1 had only one dark side left, and the leftover pockets were one lantern each. Felt good. |

Notes in the moment:
- J-1: "Corner 2, two sides, both lanterns. I've got this one."
- J-3: "Oops, the 1 says too many. Fine, swap it."
- J-8: "Two dark squares up the top and nowhere to put anything. Why? ... Oh, the bottom one was shining all the way up." The hint named a single lantern, which I liked.
- J-15: "Red. Okay, not there." Then the rest went smoothly. Done on one bus stop.

### Answers after J (in character)

1. **What I did, in order:** Level 1: the corner 2, then the middle 2, then the two corners left over. Level 3: three lanterns round the 3, the 1 said too many, I swapped one, then did the 2 on the right and mopped up. Level 8: the 3 and the 2 first, then a lantern by the 1 at the bottom, which killed the top corner. Took a hint, moved that lantern to the top, finished. Level 15: the 3 first, a wrong one by the 2 that went red, undid it, used the corners instead, then filled the little pockets.
2. **Not sure what to do:** Level 8, with two dark squares in the top-left that nothing could light. I couldn't tell which of my lanterns was to blame until the hint told me. The other times I knew what to do. The red or "too many" told me at once.
3. **The hint:** It said "Remove lanterns at: D5", just the one. Right after, I took it off, saw the top row needed a lantern in the same column, put it at D1, and the bottom sorted itself out (C6 for the 1, E5 for the last square). It worked immediately. That's the hint I want.
4. **Stuck and couldn't tell why:** The same moment on level 8. Everything around the numbers was ticked off, and two squares were simply dark with nowhere legal to go. The cause was a lantern three rows down that shone up the column. On a phone I'd never have spotted that myself.
5. **Last vs first:** About the same, maybe a touch harder. Level 15 was actually less fiddly than level 8 for me. It's the same size, and the 3 and the corners told me most of it. Level 8 was the one that tripped me.

---

## Version W

| Level | Outcome | Moves | Undos | Hints | Restarts | Log time | How it felt |
|---|---|---|---|---|---|---|---|
| 1 (6×6) | Completed, 2 hints | 16 | 0 | 2 | 0 | 70s | Level ONE is a 6×6 full of zeros and one lonely 1. Nothing obvious to start with. I put a lantern next to the 1, one in the middle and one in the bottom middle. Everything looked fine until the end: 27 of 28 lit, one dark square in the top-right corner, and the 1 said too many when I tried to fix it. The hint told me to take off **four** lanterns. Four, on level one. After that I had no idea where to start, so I took a second hint ("F1 can only be lit by a lantern on itself"). That one made sense, and I finished. Strike one. |
| 3 (6×6) | Completed, 1 hint | 13 | 1 | 1 | 0 | 46s | The 4 was lovely: all four sides, done. The 2 and 1s on the left were fine. Then a lantern in the bottom middle for the 1, and two squares were left dark, both next to 1s that were already happy. I tried one anyway: all lit, but the 1 went wrong. That's exactly the feeling that made me quit V last week. Undid it and took a hint: "Remove D6". Fixed it. Strike two, honestly. |
| 8 (7×7) | **Gave up** | 11 | 1 | 1 | 0 | 59s | Big board, eight numbers. The 3 on the left with its three free sides was easy. Did the two 2s and the 1 at the top, filled the corners, and got 35 of 37 lit with every number ticked. Two dark squares and nowhere legal to put anything. I tried the corner one and it broke the 0. Took a hint: "Remove lanterns at: D2, G5, D6". Three lanterns, one of them in a corner I thought had nothing to do with anything. That's twice stuck in a row (three times, really). Closed it. |

Notes in the moment:
- W-1: "Why is level one bigger than the last version's level 15? And all these zeros." Then: "Take off FOUR? I've done nothing right then."
- W-3: "The 4 is a gift. ... And now it's all lit and the 1 is wrong. Not this again."
- W-8: "Thirty-five out of thirty-seven, all the numbers happy, and I'm still wrong somewhere. Three lanterns to take off, and I can't see why the corner one matters. No. Bus stop."

### Answers after W (in character)

6. **Same questions for W, briefly:**
   1. *What I did:* Level 1: a lantern by the 1, then the middle and the bottom, then little pockets, then stuck on one corner. Hint (remove four), second hint (put one at F1), finished. Level 3: the 4, the left side, a wrong lantern at the bottom, two dead squares, a hint, finished. Level 8: the 3 and the 2s, pockets, two dead squares, a hint saying remove three, gave up.
   2. *Not sure what to do:* At the very start of level 1. There was no number that told me where to begin, just zeros saying where *not* to go. And at the end of every level.
   3. *Hints:* Level 1: "remove E2, F3, D5, F6". After that I was back to half a board and lost, so I asked again. "Put a lantern at F1, it can only be lit by itself" was clear and got me going. Level 3: "remove D6", clear, fixed in two taps. Level 8: "remove D2, G5, D6". I didn't follow it. I quit.
   4. *Stuck and couldn't tell why:* Every W level ended with all the numbers ticked off and one or two squares dark that nothing could light. The mistake was always made much earlier, somewhere else on the board.
   5. *Last vs first:* Level 1 already felt hard, so it didn't climb. It was hard from the start, and level 8 was bigger and more tangled. The first level should be where I learn, and here it was where I got stuck first.

---

## Final answers (in character)

**7. Compared with last week:**
- **Better:** J is the numbers version done kindly. Last week the number version (V) beat me on level 15. This week J's level 15 went through with one undo. The "too many" and the red conflict show up right when I make the mistake, so I can fix it on the spot. The hint now names exactly which lantern(s) to take off. Last week it once told me to put a lantern where it then went red, and that didn't happen this time.
- **Worse:** W is worse than anything last week. Last week's level 1s were all easy, and W's level 1 needed two hints. W also has the same trap as V: you get everything lit and every number happy, and it's still wrong because of a lantern on the other side of the board. A hint that says "remove four" doesn't feel like help. It feels like being told off.
- **Same:** It's still a numbers puzzle at heart, more Minesweeper than garden. I liked C from last week (no numbers, spare lanterns) for pure switch-off. J is close to C on easiness and a bit more satisfying, because the numbers give you little "aha"s. Even in J, the trap where a lantern far away kills a corner (J-8) is still there.

**8. Tomorrow morning, 10 minutes. ONE of [Wordle, Royal Match, J, W, don't touch the phone]?**
**Version J.** I finished all four, only one hint, and the hint fixed things straight away. Each level was one bus stop long, and when something went wrong it mostly told me right then. Not W: I was stuck on every level and gave up on the third, and I don't start my morning feeling thick. Not Wordle: it's one go a day and I do it with my daughter in the evening. Not Royal Match: loud, pushy, and eats 30 minutes. Not "don't touch the phone": 10 quiet minutes is exactly what a gentle game is for.

**9. What would make me delete it now?**
If W is the version that ships, or if the daily puzzle is like W. Getting stuck on level 1 and having four lanterns taken off is a delete on day one for me. Also the "all lit, all ticked, still wrong" ending happening twice in a row. And ads between levels, or a streak that nags me after a night shift.

**10. To a friend, one sentence:**
"You put little lanterns on stones-and-garden squares so the whole garden lights up, with dots on the rocks telling you how many go next to them. It's calm when the levels are kind, and each one you finish turns on a window in a little house."

**11. The new phone look (screenshots):**
- **First thing I notice:** The house. The sky, the moon and the little house up top are lovely, and in the middle one some windows are glowing. Much nicer than last week's empty navy top half. The lit squares are now a proper warm lantern-orange with little flowers on them, not that cardboard mustard. The lanterns look like actual paper lanterns. When the whole board is lit (the "complete" picture), all the windows glow and it's really pretty.
- **Stones vs dark squares:** Much better. The plain rocks are round grey pebbles with moss, the number rocks are white, and the dark floor squares are flat tiles. I can tell them apart without my glasses now. The dark tiles are still quite dark against the dark board edge, but because the rocks look so different, it doesn't matter as much.
- **The numbers as dots:** I like dots like on a dice. I can count three dots faster than read a small "3". The dots seem to turn orange when that rock is happy, which is good, if I've guessed right. **But the 0 is a ring/donut.** I'd never guess that means "zero, nothing next to me". I'd think it was a button or a "target". W is full of zeros, so that matters.
- **Hard to see or understand:**
  - The "remove" hint (03) is very subtle: a soft glow round two lanterns and faint dashed circles round two rocks. On the bus I'd miss which lanterns it means. I'd want them to wobble or turn a clear colour with an X.
  - The place-hint (04), a dashed ghost lantern, is clear enough.
  - The left round button with the swirly gold squiggle: no idea. Undo? Restart? Magic? The right one with the "?" lantern I'd guess is the hint. In 03 it changed to a lantern with an up arrow and I didn't understand what that meant.
  - The tiny grey number in the top right corner (1, 3, 6) is too small and faint. I assume it's the level number.
  - On the smaller phone (08) the cells are smaller but still okay. The two ring stones next to each other bottom right look like eyes, and I had to look twice at which ones are rings.
  - Nothing says "Light every square" on screen any more. Fine once you know, but a first-timer gets no words at all.
- **Would I keep it?** Yes, with J-style levels. It looks like something I'd open to calm down, which the old one didn't quite. Compared with my notes: the murky blue-on-blue problem is fixed, the light is warm now, and the house gives the top half a reason to be there. What's still missing: clear button meanings and a 0 that looks like a 0.

**12. Day 7, the town and the daily puzzle:**
What brings me back on day 7 is seeing the town: which windows are still dark, and wanting that house (then the next one) all glowing, like finishing a picture in Vita Mahjong. The daily puzzle is fine if it's gentle, J level 1–3 size, doable in one bus stop without a hint. I'd share the result with my daughter (we already swap Wordle) and maybe the nurses' group chat on a day I did it cleanly. I wouldn't paste a day I needed hints, and definitely not if it's a W-style one. On the streak: I work nights and rotating shifts, so I *will* miss days. If missing one day wipes my streak, I'll stop caring about it in a week. A streak that lets me skip a day, or just counts the windows I've lit, would keep me going.

---

## Out of character: tester notes

- **My play is more deductive than a tired human's, and I steered the mistakes on purpose.** I worked out each board's full solution in my head, then placed "intuitive" taps where a casual player plausibly would: the middle or bottom-middle square next to a number, or the obvious-looking sides of a 3. The J-3 B3 error, the J-8 D5 trap, the J-15 B2 conflict, the W-1 E2/C4/D5 opening, W-3 D6 and W-8 D2/D6/G5 were all such deliberate "natural first taps". A real Sophie might make more mistakes or different ones. Treat the counts as roughly representative, not measured.
- **The give-up on W-8 is a persona decision, not a solving failure.** I could see the solution (it needs D4, F6, B7, G2 and so on). Sophie's "stuck twice" rule was already used up by W-1 and W-3, so the three-lantern removal hint on W-8 was a natural quit point. A more patient player would have followed the hint and probably finished.
- **The text board helps more than a phone does.** The harness prints `Dead cells: A1 C1` and exact `✓/↑/✗` per number. In the phone screenshots I saw no visible "dead cell" signal, and number state seems to be only a dot colour change. On the phone, the J-8 and W endings ("why is this square dark?") would likely take longer and feel worse than they did for me.
- **The hint on W-1 was the harshest moment:** "Remove lanterns at: E2, F3, D5, F6" (four of seven) on the very first level. Then "put a lantern at F1 — F1 can only be lit by a lantern on itself" was a good, explanatory hint. Single-cell remove hints (J-8, W-3) felt fine.
- **Level sizes as I saw them:** J goes 5×5, 5×5, 6×6, 6×6. W starts at 6×6 on level 1 and reaches 7×7 by level 8. W's level 1 has mostly 0s and a single 1, so there is no forced starting move a beginner can see. That (not the board size alone) is what made it feel hard.
- **Log times are command-batching times, not human thinking times,** and there were no real interruptions.
- I read only tools/PLAYTEST.md, my own round-1 notes and the six listed screenshots, and ran only `npm run -s play` commands. Project context loaded automatically at session start was ignored for judging.
