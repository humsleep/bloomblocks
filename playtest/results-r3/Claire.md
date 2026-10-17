# Playtest results, round 3: Claire

**Persona:** Claire, 36, Bristol (UK). Freelance graphic designer. Plays Monument Valley, Two Dots, Alto's Odyssey, A Little to the Left. Very sensitive to visual quality; deletes cheap-looking apps within a minute. Likes medium puzzles with an "aha". Plays in the evening and in short gaps.

Play order: J (1, 8, 10, 15), then W (1, 4). Sessions: `playtest/sessions-r3/Claire/<code>-<level>.json`.
Both codes showed the same rule line: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it." There was no lantern limit.

"Moves" is the harness counter: every place or remove toggle, including ones I later undid. Taking a lantern off by tapping it again counts as a move, not an undo.

---

## Code J

| Level | Outcome | Lanterns | Moves | Undos | Hints | Restarts | How it felt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (5×5) | Completed | 7 | 8 | 1 | 0 | 0 | The "2" at the top only has two open sides, so B1 and C2 went straight in. For the "3" I tapped C4 without looking and it went red against C2, so I undid it. After that the middle "2" could only use E3 and D4, and the "3" took the other three sides. A calm warm-up with one proper little deduction. |
| 8 (6×6) | Completed | 8 | 9 | 1 | 0 | 0 | The zero next to the "3" takes away one side, so the "3" has exactly three: C2, D3, C4. Lovely. Then the "1" on the left had one legal side (A5), the "1" on the right had one (F2), and the "2" at the bottom took E5 and F6. For the top row I went for the corner, A1. The board said B3 was stuck. B3 sits in a slot between two rocks and can only be lit from up its own column, so I swapped A1 for B1 and it was solved. A small "oh, of course". |
| 10 (7×7) | Completed | 11 | 14 | 1 | 0 | 0 | The best J level. The "2" on the right edge has two free sides, so G3 and F4. F4 lights D4, so the "1" at D3 must be E3. For the "1" at E5 I picked D5 because it was central, and the "3" turned into the "can't be done" mark. D5 was lighting B5, one of the 3's only sides. I undid it and used E6, then the "3" took B3, A4 and B5. Then I got careless at the top and put F1 next to the corner zero. The zero went to "too many" at once, so I took it off. I worked out that D2 can't hold a lantern because of the middle zero, so D1 and F2 covered the top, and the two bottom corners only had themselves. Proper thinking, and it never felt unfair. |
| 15 (6×6) | Completed | 8 | 10 | 0 | 0 | 0 | The "2" next to the zero takes C2 and C4, and that forces A5 for the "1" on the left. For the top-right "2" I picked E1 + F2 (corner instinct). It said B3 and E3 were stuck, and E3's reason pointed at the "2". So the "2" wanted E3 rather than E1, and with E1 gone, B1 could light the whole B column. Then D6 and F6 in the two little dead-ends. A nice moment, but it's 6×6 again straight after a 7×7, and over in a few minutes. |

Notes while playing: J is calm and fair. Every level opens with a number you can't argue with. Level 10 was the high point. Level 15 felt like a step back down.

### Answers after J (in character)

**1. What did you just do, in order?**
Level 1: the top "2", a careless C4 that clashed, undo, then the middle "2" and the "3". Level 8: the "3" with the zero beside it, the two "1"s, the bottom "2", then A1 in the corner, which left B3 stuck, so I swapped it for B1. Level 10: the edge "2", the "1" under it, D5 for the other "1" (wrong, the "3" became impossible), undo, E6, the "3"'s three lanterns, a silly F1 next to the zero, off again, then D1, F2 and the two bottom corners. Level 15: the "2" by the zero, the left "1", E1 + F2 for the top "2", stuck cells, swapped E1 for E3, then B1 and the two dead-ends.

**2. Was there a moment you weren't sure what to do?**
On level 10, after the right-hand side was done and the top was still dark. With two zeros up there I had to stop and work out which cells were actually allowed. And for a second on level 15, when two cells went stuck at once.

**3. Hints?**
None in J.

**4. Stuck and couldn't tell why?**
No. On level 15 the stuck message pointed E3 at the "2", which led me straight to my E1. On level 8, B3 boxed in between two rocks made sense the moment I looked.

**5. Harder, easier, the same?**
Harder from 1 to 10, nicely so. 1 is one deduction, 8 is a chain, and 10 is a bigger board with two zeros and three numbers that lean on each other. Then 15 dropped back to 6×6 and was easier than 10. Same feeling as last week: the last level isn't the finale.

---

## Code W

| Level | Outcome | Lanterns | Moves | Undos | Hints | Restarts | How it felt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (6×6) | Completed | 9 | 10 | 1 | 0 | 0 | What a difference from last week. A "3" on the top edge with exactly three open sides, so instant A1, C1, B2. Then the "2" boxed in by two rocks gave E4 and D5. For the "1" on the left I tried B3 and it clashed with B2 straight down the column, so I undid it and used A4. The three dead-end cells (F3, C6, F6) each only had themselves. A proper welcome. |
| 4 (6×6) | Completed, **with 1 hint** | 9 | 13 | 0 | 1 | 0 | Zeros and ones. The "1" at the bottom between the zero and a rock has only one free side, so E6. Nice. I put D2 for the top "1", and the "1" in the middle went to "can't be done", because D2 lit D4, its only free side. So I took D2 off, used D4 and E1, then F2. Then I put A5 in the bottom-left and it said B6 was stuck "because of rocks B2 and C6". I stared at the two zeros and couldn't see what they had to do with it. I pressed hint: "Take back the lantern at A5 (1 of 1)". Then I saw it: A5 was blocking both B5 and A6. B5 + A6 instead, then A1 for the corner and C3 for the middle row. Done. |

### Answers after W (in character)

**1. What did you just do, in order?**
Level 1: the edge "3" (three lanterns), the boxed "2" (two lanterns), a wrong B3 for the "1" that clashed, undo, A4, then three dead-end cells. Level 4: the one-sided "1" at the bottom, D2 for the top "1" (which broke the middle "1"), swapped to D4 + E1, F2, then A5 in the corner area, stuck on B6, a hint, A5 out, B5 and A6 in, then A1 and C3.

**2. Was there a moment you weren't sure what to do?**
W-4, with B6 stuck. The message blamed the two zeros, and the zeros were fine. I didn't think to suspect my own A5.

**3. Hint: what did it show, and what happened right after?**
"Take back the lantern at A5 (1 of 1)." It was the only thing wrong. As soon as A5 was gone I could see that B5 lights B6 from above and A6 covers its own corner, so I finished in four taps without any more trouble. It told me *what* to remove but not *why*. The "why" came on its own, which was quite nice.

**4. Stuck and couldn't tell why?**
Yes, W-4, for exactly that moment. The stuck reason pointed at rocks, not at my lantern, so it sent me looking in the wrong place.

**5. Harder, easier, the same?**
Harder from 1 to 4, but gently. Level 1 is now a real level 1. Level 4 has fewer big numbers and leans on zeros and ones, so it's more "where can't it go" thinking. I liked that.

---

## Overall answers (in character)

**6. Compared with last week. Going through each complaint.**

- **J's last level isn't a finale (J-15 no harder than J-8).** *Not fixed.* J-10 was a lovely step up (7×7, two zeros), but J-15 went back to 6×6 and was easier than 10. The curve peaks and then dips at the end.
- **W-1 is a cold, too-dense welcome (four zeros and a "1").** *Fixed.* W-1 now opens with an edge "3" that's obvious. It's the best first board I've seen in this game.
- **A ticked number can hide the real mistake (W-8, D2).** *Partly fixed.* On J-15 the stuck line pointed at the ticked "2", which is exactly what I wanted last week. On W-4, though, the stuck line blamed two zeros when the culprit was my own lantern's light. I only got there with the hint.
- **0-rocks ticked from the start look odd.** *Partly fixed.* On the phone the zero now stays white until the cells around it are settled, then goes gold. That's better than "ticked from nothing", but it adds a white/gold/grey state that nobody explains.
- **Numbers as pips look like dice or a Dalmatian, with pip-sized moss.** *Fixed.* Real digits by default, pips only as a choice in settings, and the moss is now only on plain stones. Big improvement.
- **Zero as a hollow ring, black sometimes and gold other times.** *Partly fixed.* It's an unmistakable "0" now. The colour still changes (white on 03 and 04, gold on 05, grey on 06), and I had to work out what each means.
- **"Too many" warning so gentle I'd miss it.** *Partly fixed.* Now the stone goes dark slate with a pale blue ring, and the lanterns causing it get a soft halo. I'd notice it now. But cool blue-grey reads as "selected" more than "wrong".
- **Two unexplained shades of lit tile.** *Fixed.* One warm amber throughout.
- **The "remove" hint was too subtle.** *Mostly fixed.* One lantern gets a big halo and an arrow. But the arrow points from the lantern into the zero, and my first reading was "move it up onto the 0". A cross or a lift-off would be clearer.
- **Unlabelled top-left squiggle button.** *Not fixed.* It's still a little path with a lantern and a plus. On the deduce screen it's a house instead. I still don't know what either does without tapping.
- **Tiny grey number top right.** *Fixed.* The level number now sits on the door as a house number. Charming, and I get it.
- **Completion moment.** Not shown this round, so no comment.

*Same:* the rule and the best moments, a number with exactly as many sides as its value, then everything falling into place. *Better:* nearly all the visual complaints, and W's opening. *Worse:* nothing really. The stuck reason on W-4 was a step sideways, not backwards.

**7. Tomorrow morning, 10 minutes. Choose ONE.**
**Version W.** Level 1 now welcomes you, and level 4 had a real "oh" in it, a one-sided "1" and then the zeros fencing everything in. One W board fits one coffee. Not J: I enjoyed J-10 a lot, but J is the one I'd play at 11pm half-asleep, and its ending fizzled. Not Wordle: done in two minutes, and I'd want more. Not Royal Match: loud, endless, not me. Not "don't touch the phone": a quiet puzzle is a nicer start than the news.

**8. What would make you delete it now?**
Ads over that scene, or hints behind a video. A long run of levels that all feel like J-15, solved by habit. And if the town turns out to be this one house forever, it would go stale. Visually there's nothing left that would make me delete it. A month ago there was.

**9. The new phone look, screen by screen.**

- **01-onboarding-a (tap a lantern).** First I notice the hand tapping and the column and row turning amber, stopping at the stones. It's lovely, and the light stopping at the rocks teaches itself. The new digits on white pebbles read instantly. Unclear: the "1" on the door. Is it step 1 of the guide or level 1? And the lantern under the finger is pale and unlit while its tiles glow, which looks slightly off.
- **02-onboarding-b (four lanterns round a "4").** First I notice the "4" glowing gold with four lanterns around it, so "the number counts its lanterns" comes across. Unclear: on this screen the lanterns don't light anything, even though screen A just taught that they do, and that's jarring. The hand is pointing at the "3", which has only two lanterns, but nothing happens to it, so I don't know what it's asking me to do.
- **01c-onboarding-c (two lanterns with a dotted line).** First I notice the dotted line between the two lanterns. As a Two Dots player, a dotted line between two things means "connect these", which is the opposite of the rule. There's no red, no cross and no sad face, so nothing says "not allowed". The hand tapping the second lantern could mean "add" or "remove". This is the screen that fails.
- **03-gentle-mid-digits.** First I notice the warm board and one window lit in the house. Clear digits. The satisfied "1" and "2" are gold, and the "0" and "3" are still white. Lit tiles are one amber, with little flowers. Very nice. Unclear: why the zero is white here when it has no lanterns next to it.
- **04-stuck-stone.** First I notice the two dashed-ring cells and a faint thread running from them through the numbered stones. After a moment I read it as "this cell can't be lit any more, because of these stones". It's elegant, but the thread is very faint, and like the text in W-4 it blames stones rather than my lanterns.
- **05-overfull.** First I notice the "1" at the bottom gone dark slate with a blue ring between two glowing lanterns. Clearer than last week, and I'd see something's up. I'd still read it as "selected" before "too many". A touch of warm red or a small shake would fix that.
- **06-hint-remove-one.** First I notice the bright halo on the left lantern. Clear which one. The arrow pointing into the "0" is the confusing part (move it there?). The hint button turning into a lantern with a chevron is cute but cryptic.
- **07-hint-place.** First I notice the ghost lantern and the gold ring round the "3". Perfectly clear, the best hint visual.
- **08-deduce-1.** First I notice how clean and calm it is: house, door "1", digits, mossy rocks. It's the board I played as W-1. Unclear: the left button is a house here and a path-with-plus elsewhere, and I can't tell what either does.
- **10-settings.** First I notice the sheet sliding up over a dimmed board: sound on and off, and digits versus pips. Clear without words, and I love that I can choose. The gold outline on the selected option is tasteful.

**Would a first-timer understand from the guide screens alone, without words?** Two-thirds of it. Screen A teaches "lanterns light rows and columns until a rock" well. Screen B mostly teaches "numbers count the lanterns next to them". Screen C doesn't teach "lanterns can't see each other". It reads as "connect them". And nothing shows the goal of "light every tile", though the house windows hint at it. My mum would get the first two and then put two lanterns in a row.

**10. How close to an app I'd keep on my home screen for months?**
A solid 7.5 out of 10, "nearly there". Last week it was "I'd keep it", and this week it looks finished rather than nearly finished. What's holding it back from months is that the levels don't build to anything. J peaks at 10 and then eases off, and a lot of boards are solved by the same opening habit. **Single change:** make the last level of each run a real finale, a board where an early choice comes back three moves later (like last week's V-15 chain). Close second: redo guide screen C so the "can't see each other" rule shows red, or a no, not a dotted line.

---

## Out of character: tester notes

- **Timing isn't human.** The session timestamps (about 20–40 s per level) reflect command round-trips. A real Claire would take a few minutes on J-10 and W-4.
- **I solved each board analytically before playing,** then played the mistakes I think she'd naturally make: C4 (J-1), A1 corner (J-8), D5 central and F1 next to the zero (J-10), E1 corner (J-15), B3 (W-1), D2 central and A5 (W-4). The undo, swap and hint counts are therefore partly authored, not measured.
- **The W-4 hint was a judgement call.** I knew A5 was the problem, but the stuck message pointed elsewhere, so a real player would plausibly press hint there.
- **Possible harness or design issue:** on W-4, with lanterns at E1 F2 D4 A5 E6, the output was `Stuck: B6 (rocks B2 C6)`. B6's other possible light sources (B5, A6) were blocked by A5's light, not by rocks. The reason names only the zero-rocks, which misleads. Screenshot 04 suggests the phone draws the same "thread to the rocks" explanation, so it may mislead there too.
- **The hint format changed** from listing all removals at once (last week) to "1 of N". Here N was 1, so I couldn't compare.
- **The J curve:** J-10 was 7×7 and the hardest; J-15 was 6×6 and easier. This rests on one level each.
- **Visual judgements come from static screenshots** (I didn't watch solve.mp4, per the rules). Animation, sound and haptics aren't assessed. My readings of the zero's white/gold/grey states and of the arrow in 06 are inferences.
