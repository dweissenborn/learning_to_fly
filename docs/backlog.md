# Backlog

Notes on work still to do. Newest first.

## Audit, 2026-10-28

DW asked for the backlog to be checked against the live code, and for each part of the game to be checked against its design. Three read-only checks compared every entry with the code. Of 65 entries, 47 matched, 15 matched in part (mostly stale text) and 3 had drifted. Two more checks drove the real engine, journey and math code with simulated learners. Each finding below was confirmed in the code before anything changed. The entries carry the details.

Fixed the same day. Each fix has a test, seen failing first.
- **Placement.** Running the "Who did it?" stop again re-mastered skills he was relearning. A later placement now leaves alone any skill he has mastered before.
- **Text levels.** They counted guided answers and inference-check answers. In Together the clue shows by itself after the wait, so a slow, careful reader stepped down on answers the clue had already helped. Levels now move only on his own answers (LTF-50).
- **The Lantern Peaks gate.** It needed all eight gate skills at review stage 3 at the same moment, and any slip erased that. The plan says each skill "has passed its 21-day review", so a skill now keeps that once earned. A slip still rests the strand until the skill is relearned. Before the fix, a simulated learner at about 80% right opened the gate in 1 of 5 runs over 240 sessions.
- **Math.** Two problems (LTF-41, LTF-43):
  - A choice tapped after Help in a typed session was dropped from the mastery tally, so misses vanished. A simulated learner at 50% mastered every step.
  - A missed math review never sent a step back to practice.
- **Island quests.** Only four of a stay's five sessions counted. Fossil Bay's and Reef Island's quests could not finish while he was there, and their keepsake arrived without a word. The session that ends a stay now finishes the quest of the island he is leaving (LTF-46, LTF-47).
- **Skipped scouting.** Skipping the scouting trip switched pictures and read-aloud on, from scores that were never measured (LTF-63).
- **Fresh content.** The fresh-content count included check-up questions, which item choice never serves (the repeats entry).
- **Picture limit.** The date sent with a picture request was not zero-padded. From 1 November the three-a-day limit would have run on UTC days (LTF-51).
- **The journey's pace.** Changing the pace could replay a setback he had already got past. At pace 7, "One more session" showed with two sessions left (LTF-20).
- **Postcards.** Postcards from the keeper arc and the way home read "A picture of undefined" to a screen reader. Way-home postcards had no picture and no day trip (LTF-26, LTF-27, LTF-30).
- **Smaller fixes.**
  - A grown-ups' tip promised a bonus that was removed with LTF-38.
  - The test-flight note showed even with the trial off.
  - The Overview did not name his routes (LTF-25).
  - The voice named in Settings ignored being offline (LTF-37).
  - A flight-path or way-home choice counted as choosing a sea route for the "What do you think?" card.

Design questions for DW. The simulations found these; nothing was changed.
- **Reviews.** A review is one or two questions, so "80%" means every one right, and a single slip sends a skill back to practice. Use two or three questions a review, or pass a review at one miss in three?
  How often a review passes for a skill he really knows, where p is his chance of getting one question right:

  | p | 1 question (today, when several are due) | 2 questions, both right (today, when one is due) | 3 questions, 2 right | 2 questions, 1 right |
  |---|---|---|---|---|
  | 0.7 | 70% | 49% | 78% | 91% |
  | 0.8 | 80% | 64% | 90% | 96% |
  | 0.9 | 90% | 81% | 97% | 99% |

  So at 80%, today's rule sends a skill he knows back to practice after one review in five, or one in three when it is the only one due. Recommendation: 3 questions with 2 right. It is the one closest to the 80% mastery bar, and it costs two more questions a review.
  **Decided by DW 2026-10-28: 3 questions, 2 right. Built the same day.**
  - **The rule.** A review is three questions (`RULES.reviewItems`) and passes at two of three (`RULES.reviewPass`). A session stopped part way is judged on what he answered.
  - **The warm-up.** At most two skills are reviewed in one warm-up (`RULES.reviewsPerSession`), so it stays at six questions or fewer; others wait for the next session.
  - **Math.** The same rule: three problems a review, judged on the whole review, both for the check-in's provisional places and for sending a step back to practice.
  - **Tests.** Engine and math (two of three passes, one of three fails, and the order of right and wrong does not matter; seen failing first).
  - DW's other answers the same day: fast track stays as it is, and repeats keep counting for now, as a known limit for weaker learners.
- **Fast track.** It never fires on a new skill. The skill's first session is planned at level 1, and fast track needs a level 3 text. Start a new skill at the level of the step before it, or drop the level condition?
- **Repeats.** For a learner at 60 to 70% right, most own-turn answers become repeats at level 1, and repeats count toward mastery. Leave repeats out of mastery, or add level 1 content?
- **Today's step back.** It ends when old recounts age out of the 14 days, not when he improves (LTF-07).
- **Mastery pairing.** Mastery pairs his latest session with the latest one on an earlier day. A weak session earlier the same day is skipped.
- **Flight gear.** The full flight kit arrives by about session 13, before take-off at session 20. Keep it, or space the gear out?

Not built, on purpose (LTF-39):
- A grown-up button to delete one module's memory. Deleting a whole learner already keeps the plan's promise, and a module delete would need a way to tell his other devices.
- Module-scoped notes.
- Timing the picker.

## Build order for the research features

Added 2026-10-13. All 18 proposals from the research review (LTF-01 to LTF-18) were approved. Guest codes (LTF-19) were added at DW's request. The mockups and the full case for each are on the review page in claude.ai. The research is in the project doc `claude/reading-research/2026-10-12.md`. Each entry below links its studies. The findings are rules R17 to R30 in `docs/plan.md`, with full citations in its Sources section.

Each step lands its test before its code.

1. **Foundations.** "Check whether content repeats across sessions" (below, built 2026-10-13), now needed by the notes on LTF-01, LTF-02, LTF-05 and LTF-16. Then LTF-16, so every new item after it passes the content checks. LTF-17 can run alongside.
2. **Small, strongest evidence.** LTF-01, LTF-05, LTF-08, LTF-18 (all built 2026-10-13).
3. **Today and hints.** LTF-06 (after LTF-05), LTF-07, LTF-02, LTF-15 (all built 2026-10-13).
4. **New questions.** LTF-09, LTF-10, LTF-12, LTF-13 (all built 2026-10-13).
5. **Large content work.** LTF-20 (island routes, before LTF-14 so check-up flights can come from the island he chose), LTF-04, LTF-11 (idioms use LTF-04), LTF-03, LTF-14. Built 2026-10-13: LTF-04 (pilot), LTF-11, LTF-03 (N4 first), LTF-14 (all ten stops, the four islands included), and LTF-20, built with the proposed LTF-21 to LTF-24 as its island stories so DW can review them in the app. Waiting for DW: those island stories, and the koala keeper arc (LTF-30 to LTF-35). LTF-25 to LTF-29 come later, if approved.
6. **Guest codes.** LTF-19, a separate track. Approach to confirm; DW 2026-10-13: not now.
7. **Math module.** LTF-39 to LTF-44 (below), from DW's design note: modules as add-ons first, then typed answers, skills and gates, the help ladder, story or plain, and the grown-ups' measures. LTF-39 to LTF-44 are built; LTF-42 as a pilot that stays off until a grown-up turns it on.
8. **Islands of their own.** LTF-45 to LTF-48 (below), from DW's feedback 2026-10-14. Built the same day; the new wording waits for DW's review.
9. **Help and levels.** LTF-49 and LTF-50 (below), from a first look at how his sessions are going, 2026-10-14. Built the same day.
10. **Requests from the learner.** LTF-51 to LTF-53 (below), built 2026-10-17; LTF-64, the save menu, built 2026-10-26.
11. **Research gaps from the 19 October scan.** LTF-54 to LTF-62 (below). LTF-54 and LTF-55 built 2026-10-19, and the first steps of LTF-56, LTF-58 and LTF-60 the same day; the rest proposed, each checked against the code.
12. **Research from the 26 October scan.** LTF-63 (below); its default built 2026-10-26, with the LTF-58 follow-ups. The same day, as trials that can be reverted: test flights (LTF-56) and the feeling-word count (LTF-58). The other findings are notes on LTF-17 and the design plan.

## The math module (LTF-39 to LTF-44)

Added 2026-10-13 from DW's design note (kept local in `docs/math-module.md` with ADR-0003, since it describes the learner). Approach to confirm. Goal: close the gaps under the fraction topics he is working on now, so he does them correctly on his own, still does them weeks later, and wants to come back. Math is an add-on to Learning to Fly, not a separate app: it uses the same island, guide, journey, rules, break button and grown-ups' area, and adds its own skills, answer formats and memory. Out of scope for the first version: long division, timed fact practice, and an adventure story around the problems. DW 2026-10-13: start with LTF-39; dividing fractions by keep, change, flip (the worked examples and error rules follow it); long division later; a new skill opens with choices first. Build order: LTF-39, then LTF-40, LTF-41, LTF-43, LTF-42 and LTF-44; each step lands its test before its code.

## LTF-39 Modules as add-ons

Proposed 2026-10-13. Approach to confirm. ADR-0003 (local, Proposed).

- **What was built (2026-10-13, approved by DW the same day).** A module registry (`apps/web/src/modules.ts`) with reading (content) and Today (function). On his island, "What would you like to do?" groups the module cards in one fixed place; his last choice is marked "Last time" and focused, so one tap starts it (before he has chosen anything, reading is the default). One budget for the day across subjects: a grown-up can set sessions a day (no limit by default); when today's are done, reading says so calmly and Today stays open (`sessionsToday` counts finished sessions from every module). `moduleOf` reads a skill's module from its prefix (`math:FR3`), with today's reading ids as module `reading`; answer, session and placement events may carry `module` (missing means reading). In the cloud copy each module has its own settings document (`settings:<module>`), synced both ways, and `deleteModule` (route `DELETE /api/learners/{id}/modules/{module}`) removes one module's events, notes and settings without touching reading's. Tests: engine (`modules.test.ts`), API store (module settings, module delete; mutation-checked), and an e2e run of the picker and the daily budget, with axe. Left for LTF-41, when math brings a second content module: drawing Home's paths per module, math in the registry and its grown-up switch, module-scoped notes in the app, and a grown-up button for deleting a module's memory.

- **Math as an extension (2026-10-13).** DW: math is a functional extension, so the repo is structured for it. Math is its own workspace package, `modules/math` (`@wayfinder/math`), with its engine (`src/engine/`), screens (`src/web/`), styles (`src/math.css`, with its theme colours) and tests (unit tests beside the engine, e2e in `modules/math/e2e/`). Its kind is `function`. The app knows only its manifest (id, kind, title, icon, memory, whether it runs sessions, when it shows, and its screen, home path, settings panel and preview): `apps/web/src/modules.ts` lists it, and Home, the picker and the grown-ups' area render whatever a manifest brings. The daily budget counts modules that run sessions (reading and math, not Today). A module imports from the app only `apps/web/src/host.ts` (shared buttons, the guide, the event log, module settings, the session finish), so the app can change inside without breaking it. `modules/boundary.test.ts` fails if the core imports a module's insides or a module imports the app past the host (checked by planting one bad import on each side). Nothing changed for him: the same 151 unit and 33 end-to-end tests pass, with only the math ones moved into the package.
- **What it is.** A module registry with two kinds. A content module brings skills with a dependency graph, bank items, worked examples and any new answer formats, and uses the core's session loop and rules (mastery, reviews, gates, the guessing check, the break button), the journey and the grown-ups' area. A function module brings its own activity and screens (Today, the lounge). Each module has a manifest: id, kind, title and icon, enabled by a grown-up, its skills or entry screen, and where its memory lives (none, device or cloud).
- **He sees.** On his island, "Start reading" becomes "What would you like to do?", always in the same place: 2 or 3 large cards (the enabled modules and Today), his last choice highlighted so one tap starts. The journey moves with finished sessions from any module, never with scores. One daily budget across modules, so math never adds a second session on top of reading.
- **Build.** Namespaced skill ids (`math:FR3`), with today's ids read as module `reading` so nothing stored needs migrating; an optional `module` field on events (missing means reading); Home draws its paths from the enabled modules; per-module settings and notes documents in the existing Cosmos `data` container and `/learner` partition (`settings:<module>`, `n:<module>:<id>`), with no new container.
- **Tests first.** Store tests for module-scoped reads, writes and deletes (deleting one module's memory leaves the others); engine test for one daily budget across modules; e2e: the picker's default is highlighted and one tap starts, with axe; every existing test passes with reading as a module.
- **Guards.** 2 to 4 choices at most, a fixed layout, one story world. If the picker slows him down (time to choose is logged), it drops to a single "Carry on" button.
- **Audit 2026-10-28.** Of the work left for LTF-41:
  - Built: Home's paths per module, and math in the registry with its switch.
  - Not built: module-scoped notes, the grown-up button to delete a module's memory (the API route exists, but nothing calls it), and timing the picker. Deleting a whole learner covers the privacy promise, and a module delete would need a way to tell his other devices, so these wait until asked.
  - Notes are stored as `n:<id>` with the module inside, not `n:<module>:<id>`.
  - Module tabs in the grown-ups' area (LTF-44) use a new manifest slot, `Report`.

## LTF-40 Typed math answers

Proposed 2026-10-13. Built 2026-10-13 (the keypad and judging) and 2026-10-28 (the times table).

- **What was built (2026-10-13).** `modules/math/src/engine/math.ts`: exact fraction arithmetic and `judge`, which counts equivalent forms (3/4 and 6/8, 1 1/2 and 3/2, extra zeros) unless the problem asks for simplest form, a mixed number or an improper fraction, and names the usual mistakes: not simplest, not mixed, adding the whole number to the top, dividing without flipping, flipping the first fraction, adding across, cross-multiplying, adding instead of multiplying for an equal fraction, a remainder too big, the neighbouring fact, a common factor that is not the greatest. An unfinished answer is neither right nor wrong. `makeProblem` makes fresh plain problems with new numbers for MF1, MF2, DV1 and FR2 to FR6, so an answer cannot be remembered; FR1 (fractions on a 0 to 1 line) needs pictures and comes with the stories. This is a design choice for DW: plain problems are generated, not written into the bank, while story problems (LTF-42) are written and reviewed. `modules/math/src/web/MathView.tsx`: the keypad (digits, delete, next box, Check; the answer shows its shape: a whole number, a fraction, a mixed number, or a quotient and remainder; an optional whole box is dashed, not a question mark) and a next step for each named mistake. Until math sessions exist (LTF-41), grown-ups can try any skill in the Content library under "Math (preview)". Tests: `math.test.ts` (the equivalence table, every mistake, every skill's problems judged right with varied numbers; mutation-checked) and an e2e run that enters the no-flip mistake, sees its next step, then the right answer, and a quotient with a remainder, with axe.

- **What it is.** Typed answers by default, judged by code. Effortful recall with feedback beats recognition for retention, and typed answers show which error was made, while three choices can be passed by guessing ([Kang, McDermott & Roediger 2007](https://www.gwern.net/docs/spaced-repetition/2007-kang.pdf); [Birenbaum & Tatsuoka 1987](https://conservancy.umn.edu/items/073afebf-7637-41cc-8f93-031780b947ba)).
- **He sees.** An on-screen keypad, not a keyboard: large digit keys, a numerator box over a denominator box, a whole-number box for mixed numbers, "r" for remainders, delete and Check. The answer field always shows the answer's shape, never a blank box. The multiplication chart is one tap away, and using it never counts as help.
- **Build.** Exact fraction arithmetic. Equivalent forms are right (3/4 and 6/8) unless the item asks for simplest form or a mixed number. Wrong answers are matched against coded error rules (whole-number thinking, adding across tops and bottoms, flipping the wrong fraction, not simplifying fully), and the match picks the feedback.
- **Tests first.** Unit tests over an answer-equivalence table (6/8 for 3/4, 1 1/2 for 3/2, extra zeros, simplest-form items), mutation-checked; unit tests for each error rule; e2e: the keypad by tapping alone, with axe.
- **Built 2026-10-28 (the times table).**
  - A "Times table" button on every lesson problem opens a 12 × 12 chart. Facts go to 10 × 10 and division to 12 × 9.
  - Looking at it never counts as help. It is not offered in the check-in, which measures what he knows.
  - Feedback that mentioned "the multiplication chart" now names the button.
  - Tests: e2e (the chart, with axe; the answer's help stays at the Help steps').

## LTF-41 Math skills, gates and a check-in

Proposed 2026-10-13. Built 2026-10-13.

- **What was built (2026-10-13).** `modules/math/src/engine/mathPath.ts`: the dependency graph (FR1 now has problems: the fraction of a bar that is shaded); `deriveMath` with gates (a step opens when what it rests on is mastered or placed, or a grown-up opens it early), placement from the check-in (passing a step places what it rests on too), a placed step confirmed by its first review or taken back, mastery as in reading (80% across two sessions on different days, first-try answers), and a stall rule (a step's last two sessions under 60% send a two-problem re-check to what it rests on; a miss there becomes the focus until one good session restores it); `checkinNext` starts at FR2, moves up while he is right, branches down after a miss, and with a grown-up's start point only confirms those steps. In the app: grown-ups turn math on in Settings (and can tick a start point and open a step early); "Math" then joins "What would you like to do?" and his island shows a math path, with steps that wait shown as coming up. The first math session is a scouting trip: no timer, no score, no right or wrong shown, two misses in a row end it kindly, and it picks up next time. Lessons on the core loop: a re-check if a step stalled, a warm-up review of due steps, a worked example in a teacher's words (dividing by keep, change, flip), three together and five on his own, with the LTF-38 rule (a miss opens the named next step for one more try; a second shows the answer). Sessions finish like reading's, with the island piece and the journey moving. Math answers and sessions carry `module: 'math'` and the new phase `recheck`. Tests: `mathPath.test.ts` (gates, the check-in path up and down, a start point, provisional placement, mastery, the stall re-check; mutation-checked, and one test strengthened after a mutation slipped through) and e2e runs of the scouting trip ending kindly and of a whole lesson to the finish, with axe.

- **What it is.** A dependency graph, to confirm against his worksheets: MF1 multiplication and division facts (chart allowed); MF2 factors and common factors (after MF1); DV1 division with remainders (after MF1); FR1 unit fractions and fractions on a 0 to 1 line; FR2 equivalent fractions (after FR1, MF1); FR3 simplifying fractions (after FR2, MF2); FR4 proper, improper and mixed fractions and converting between them (after FR1, DV1); FR5 multiplying fractions (after FR2, MF1); FR6 dividing fractions (after FR3, FR4, FR5). Mastering what a skill depends on helps weaker students most, and probing that starts low and branches down places an uneven profile well; the best-known prerequisite-graph system did as well as classroom teaching but not better, so the gains still have to come from the teaching ([Fang et al. 2019](https://digitalcommons.memphis.edu/facpubs/7254)).
- **He sees.** A check-in, not a test: the scouting framing, untimed, easy first, no score shown; it stops after two misses in a row and picks up next time. Skills whose dependencies are not yet mastered show as "coming up" with what opens them, like Lantern Peaks, and a grown-up can open one early.
- **Build.** A grown-up can enter a start point (for example from a school assessment), so the check-in confirms those skills with about two typed items each instead of testing everything. It starts one step below the target topic and branches down after a miss. A skill passed in the check-in is `placed` (provisional) and confirmed by its first review. When a later skill stalls (two sessions under 60%), a two-item check on its dependencies routes him to the weakest one.
- **Tests first.** Engine tests for gates, placement, the provisional mark and the stall re-check; e2e: two misses end the check-in kindly, with axe.
- **Audit 2026-10-28.**
  - Fixed: a missed math review never sent a step back to practice, unlike reading. Now, when his last review missed, the step is the focus again until a session of three or more answers at 80% restores it (`deriveMath`, `relearn`).
  - Not fixed, for DW: "mastery as in reading" leaves out reading's transfer item.
  - Check-in sessions log no start or finish, so they do not move the journey or use the day's budget.

## LTF-42 Story or plain numbers

Proposed 2026-10-13. Built 2026-10-28 as a pilot, off until a grown-up turns it on.

- **What it is.** He picks the setting, and every problem can be read as a short story or as plain numbers. Choice raises motivation and perceived competence, most for children and for choices that do not change the instruction ([Patall, Cooper & Robinson 2008](https://selfdeterminationtheory.org/wp-content/uploads/2019/10/2008_PatallCooperRobinson_PsychBulletin.pdf)); starting concrete and fading to symbols is the route to transfer ([Fyfe et al. 2014](https://doi.org/10.1007/s10648-014-9249-3)).
- **He sees.** At the start of a session, 2 to 4 settings drawn from his interests and the island he is on; the setting changes only words and pictures. A story/plain switch on every problem; switching never counts as help. Stories are short (a proposed cap of 40 words), with a picture over each quantity, read-aloud, exact quantities, and no sentence without a quantity. Worked examples fade from story to picture to plain numbers, and every skill ends in plain notation.
- **Build.** Mastery tracks story and plain accuracy separately and needs independent first-try answers in both, so the switch is never a way around word problems. A content check: the quantities in the story equal the item's spec, the word cap holds, and no sentence lacks a quantity.
- **Tests first.** Engine test: mastery needs both views; the content check with its own unit tests; e2e of the switch, with axe.
- **Built 2026-10-28: a pilot, off until a grown-up turns it on, with these decisions made and easy to revert.**
  - **Templates, not fixed problems.** The story view retells each generated problem with its own numbers (`storyFor`), so the math never changes.
  - **Pilot scope.** Equivalent fractions (FR2), multiplying (FR5) and dividing fractions (FR6, the module's goal). The worked example and reviews stay in plain numbers.
  - **Settings.** Three to pick from, his interests first: the bakery, robot club and the beach. One picture per setting, not one over each quantity.
  - **The rules.** At most 40 words. Every sentence but the question has a number, and the story has exactly the problem's numbers. Checked over 360 generated stories.
  - **Opening view.** Each problem opens as the story, and "Show the numbers" switches it. Switching never counts as help; each answer saves its view.
  - **Strictness.** With stories on, a pilot step also needs one independent right answer in each view, on top of the usual mastery rule. This is the lenient end of "needs both views".
  - **Turning it on.** Grown-ups → Settings → Math → "Story problems (a pilot)". The Math tab adds a story column while it is on, and his "What do you think?" card covers it.
  - **To revert.** Turn the switch off; nothing else changes, and saved answers keep their view.
  - **Tests.** Unit (the story rules over three steps, three settings and 40 problems each; mastery needs both views only with stories on, only for pilot steps, and a helped story answer does not count) and e2e (off until on; the setting picker; a story answer and a plain answer, both logged with their view and no help; with axe).

## LTF-43 The math help ladder and a choices-first ramp

Proposed 2026-10-13. DW 2026-10-13: a new skill opens with choices first. Built 2026-10-16.

- **What was built.** `modules/math/src/engine/math.ts`: `choicesFor` gives three choices for any problem, the answer and two wrong ones built from named mistakes, so a wrong pick gets its own next step; the right one moves around. Mistakes are now named on every kind of problem (counting the white parts of a bar, the bottom number as only the parts left, a fraction upside down, leaving out the remainder, dividing only the top, a common multiple for a common factor, keeping the top the same, multiplying only the tops, flipping both fractions). `mathPath.ts`: a new skill starts with choices; typed answers take over once a session with choices reaches 80% (at least two answers), and stay. Only typed answers right first time with no help count toward mastery; choices never do, and a guess faster than reading counts for nothing. In a lesson: one Help button with three steps (three choices, a smaller step from the worked example, then the whole worked example); with choices already showing, Help starts at the smaller step. An answer after any step counts as helped (its step is saved as the hint level), earns the clue's points, and the feedback names the step. A miss still opens the named next step for one more try, and a second shows the answer (LTF-38). The guessing check uses reading time plus time to tap the answer in (`mathMinMs`); as in reading, two fast wrong answers in a row end the session kindly. Each answer records whether it came from the choices or the keypad, for LTF-44's first-session accuracy with and without choices. Not built: a grown-up switching the ramp per skill (the design note's option). Tests: engine (named mistakes, three choices with one right for every skill, the ramp, what counts toward mastery, the guess time; each seen failing first) and e2e (a lesson from choices, Help in both modes with the answers saved as helped, the switch to typed after 80% with choices, the guessing stop; mutation-checked).

- **What it is.** One Help button with three steps: "Show choices" (three options, each wrong one built from a named error), then a clue or a smaller step, then the worked answer. An answer after any step counts as supported, not independent. Typed recall is much harder at first (about 55% first-try against 85% with choices in the study above), so a new skill opens with choices shown for its first session, and typed answers take over once first-try accuracy with choices holds at 80%.
- **Build.** Feedback names the step and what to do next. A wrong answer opens the clue for one more try, as in LTF-38. The guessing check uses reading time plus typing time.
- **Tests first.** Engine tests for the ramp's rule and for supported against independent answers; first-session accuracy is logged with and without choices.
- **Audit 2026-10-28.**
  - What was wrong: a choice tapped after Help in a typed session was logged as `format: 'choices'`. The mastery tally leaves those out, so the miss vanished, and a typed session answered all through Help could switch the step back to choices.
  - What changed: answers now log the session's mode (`keypad` in a typed session), so a helped choice counts as a helped typed answer, which is a miss toward mastery. Answers already saved keep the old reading.
  - Tests: e2e (a choice after Help logs `keypad` with its help).

## LTF-44 What the grown-ups see in math

Proposed 2026-10-13. Built 2026-10-28.

- **What it is.** A Math tab in the grown-ups' area, read from the event log: each skill on the path to dividing fractions, mastered and passing its reviews; first-try accuracy on new problems in story and plain form (80% is a starting point to tune, not a validated threshold); breaks and guesses (the LTF-38 measures); and how often he picks math on his own. Whether the skills show on paper at school has to be checked outside the app.
- **Tests first.** Unit tests for each measure from seeded events; e2e of the tab, with axe.
- **What was built.** A Math tab in the grown-ups' area while math is on, from a new manifest slot (`Report`), with its numbers from `mathReport`:
  - For each step: where he is (coming up, learning with choices, learning, placed by the check-in, mastered, practising again), right first time on his own typed answers (choices, help and guesses left out), answers he needed help with, and reviews passed.
  - For math as a whole: sessions finished and started, their share of all his sessions, breaks, guess stops and guesses set aside.
  - Story against plain waits for LTF-42.
  - Tests: unit (each measure from seeded events; seen failing first) and e2e (the tab after a lesson, with axe).

## Research from the 26 October scan (LTF-63)

Added 2026-10-26. The weekly research scan for 12 to 26 October found six studies and three to watch. Each was checked against the code the same day. Only one needs new work (LTF-63); the rest change notes on existing items or the design plan. Studies are named as the scan cites them and were not re-checked here, except the first, whose news release was read.

Not code, for DW in the design plan:
- Kat Şen & Aydın 2026 (meta-analysis of 20 studies, g = 0.49, 0.37 after correcting for publication bias; only 5 checked carry-over) joins Fletcher-Watson et al. 2014 as a source for R15. The rule does not change. It backs what is built: reviews at 3, 7 and 21 days, and the inference check before the philosophical strand.
- R11 gains two sources: Cong et al. 2026 (preprint, see LTF-17) and Meng & Yang 2026 (EMNLP). Meng & Yang found that fine-tuned models hit a reading level better than prompted ones. The pipeline only checks hand-written content and generates none, so this matters only if generation is ever added: then try a fine-tune before a bigger model (R19 already says so).
- Rule numbers clash. The scan proposes "R17", but the plan already uses R17 to R30. The 19 October scan's proposed R17 to R23 clash in the same way. New rules would start at R31.

Watch only, no entry:
- Clark et al. 2026 reviewed reading comprehension for minimally speaking and non-speaking children (6 studies). It concerns a public version. The plan's rule that every task can be done by tapping already holds, placement included. The listening probe is skipped when the device has no voice.
- Thought bubbles for what a character believes (Tian et al. 2026; the children averaged under 6) could later be a format for narrative step 5, next to LTF-09.
- Social problem-solving packages (Jin et al. 2026, single-case studies, with no data on whether gains carried over or lasted).
- Eye tracking in reading assessment (Peklari & Toki 2026): not ready for classroom use.

## LTF-63 Test each support with him, not by default

Proposed 2026-10-26. Approach to confirm. Evidence as cited by the scan:
- Hinchey 2026: a doctoral thesis with no sample size given and no peer-reviewed paper yet. EEG showed stronger comprehension-linked signals for reading aloud than for pictures. Its own conclusion is that what works for one child may not work for another.
- Svensson et al. 2026: 8 students, text-to-speech. All understood more by listening. The sample had intellectual disability; none were autistic.

- **A caution on the evidence.** In Hinchey's study, "reading aloud" was most likely the child reading out loud himself, not the text read to him. Text-to-speech appears in the release only as a future trial. The app's read-aloud is text-to-speech, and the app never listens to him (the tap-only rule). So only Svensson speaks to the app's read-aloud, and that sample was not autistic. Together the two support testing each support for each child, not making read-aloud the default.
- **Checked against the code.**
  - Already there:
    - Placement measures reading and listening on two different level-2 stories, three questions each.
    - It turns read-aloud on when listening beats reading by 30 points or more, or when word reading is under 75% (`placementSupports`).
    - Placement only ever switches supports on.
    - Every reading answer saves whether pictures and read-aloud were on (math answers do not).
    - "Do pictures and read-aloud help him?" compares the two only within the same skill and level (LTF-56).
  - Missing:
    - Pictures are on by default for every new learner. Placement turns them on again when word reading is low, but never tests them against no pictures.
    - With pictures always on, the "without" column of that comparison stays empty. Practice with one support fewer (LTF-56, GAP-05) is what would fill it.
  - Since 2026-10-26, both are addressed: new learners start with pictures off, and test flights (LTF-56) fill the "without" column.
- **What it is.** Placement adds a short picture probe: a matched level-2 story with pictures on, its questions compared with the reading story's. Both supports start from what placement shows, not from a default. An occasional practice leg with one support switched off (LTF-56) keeps the comparison filling in.
- **Must hold.**
  - Use matched stories, never the same story twice: the second reading is easier, so whichever support came second would look better.
  - Alternate the order between runs.
  - Placement still never switches off a support he or a grown-up chose.
  - Three questions decide nothing alone. The probe is a starting point, and his own record afterwards decides.
- **Decisions.** DW 2026-10-26: new learners start with pictures off. The same day, every fifth leg became a test flight with one support fewer, as a trial (LTF-56).
- **Built 2026-10-26 (the default).**
  - A new learner's first onboarding screen saves pictures off.
  - The comfort step's toggle and placement (when word reading is low) can still switch them on.
  - The app-wide default stays on, so a learner who never saved the setting, him included, keeps what he has.
  - Tests: e2e (the comfort step shows pictures off; mutation-checked).
- **Fixed 2026-10-28.**
  - What was wrong: skipping the scouting trip, or stopping before the word check, passed scores that were never measured (all zero). Placement then switched pictures and read-aloud on as if he had read nothing.
  - What changed: supports now change only after this run's word check.
  - Tests: e2e (a skipped trip leaves both off; seen failing first).
- **Not built.** The placement picture probe. Three questions decide little, and his own record decides once practice runs both ways (LTF-56). Build it only if a starting point is wanted sooner.
- **Size.** S for the probe. The leg with one support fewer is LTF-56's.

## Research gaps from the 19 October scan (LTF-54 to LTF-62)

Added 2026-10-19. A weekly research scan (in the claude.ai project, `claude/backlog-gaps-2026-10-19.md`, items GAP-00a to GAP-22) compared new studies with the design plan; it could not see the code. Each item below was checked against the code the same day: what exists, what is missing, and what it needs. Studies are named as the scan cites them and were not re-checked here; the scan marks several as preliminary or a preprint. DW 2026-10-19: add them all, build GAP-12 and GAP-11 first. Sizes are rough: S is under a day, M a few days, L a week or more.

Not code, for DW in the design plan: the plan's roadmap still shows phase 3 as not started, though phases 1 to 3 and much more are built (GAP-00a); proposed rules R17 to R23 wait for a decision (GAP-00b).

## LTF-54 A lantern for every Today (GAP-12)

Built 2026-10-19.

- **What was built.** Each Today he saves lights one lantern in a set of seven, whatever he told, short or long; a full set says so and starts a new one. He sees the row before he starts and on the card for his grown-up. Lanterns change no points and no skill (`todayLanterns`, engine). Evidence as cited by the scan: Bhana et al. 2023; Yang et al. 2026 (AUTIVERSE): a game reward for completing the recount, never tied to its quality. Tests: engine (the count, a full set, no effect on points or skills; seen failing first) and e2e (lantern 1, a full set of seven, with axe).

## LTF-55 The MORE guide for grown-ups (GAP-11)

Built 2026-10-19.

- **What was built.** Every card for the grown-up (after Today and after a session) carries "How to talk about it (MORE)", one line each: model (tell one short thing about your own day first), offer (one question, then wait five seconds), respond (say back what he told you), expand (add one word or idea). It starts open; a grown-up who closes it once finds it closed from then on, and can open it again. Evidence as cited by the scan: Bhana Lopez et al. 2024 (preliminary); Petersen et al. 2014. Tests: e2e (open at first, stays closed once closed, on both cards; mutation-checked).

## LTF-56 Reading supports as dials (GAP-01 to GAP-07)

Proposed 2026-10-19. Built in part: both supports saved with a with-and-without view (2026-10-19), test flights as a trial (2026-10-26), and the line of supports he used (2026-10-28). Evidence as cited by the scan: Jhilal et al. 2026 (preliminary); Stephens et al. 2026; Lee, Quinn & Jiang 2025.

- **What it is.** Each support (pictures, read-aloud, text cut into short parts, keyword labels) is its own setting, chosen with him, saved on every answer, and now and then tried with one support fewer, so the dial is retuned from his own record.
- **Checked against the code.**
  - Already there: he can switch pictures, read-aloud, text size, spacing, letters and colours himself (⚙️ "How do you like it?"); read-aloud is saved on every answer; points never depend on supports (GAP-04, built: points come only from the first tap, the clue, the shown answer and a guess); check-up flights already run without hints, announced and optional.
  - Missing: a text-segmentation option in the schema and content (GAP-01, new content work); keyword labels do not exist, so the rule that pictures and labels never show together (GAP-02) applies only once they do; choosing supports before a session, at most two (GAP-03); pictures are not saved on each answer, and there is no with-and-without view (GAP-06); practice flights with one support fewer (GAP-05); a "supports I used today" line (GAP-07).
- **Decisions.** How often a practice flight with one support fewer comes (the scan proposes one leg in five), or per skill. Whether segmentation is worth the content work.
- **Size.** L in all; S for a first step: save pictures on each answer and add a with-and-without view like "Does his interest help?".
- **Built 2026-10-19 (the first step).** Every reading answer now saves whether pictures were on, as it already did for read-aloud. The grown-ups' Activity tab has "Do pictures and read-aloud help him?": right first time on his own first-time answers with and without each, counted only in skill-and-level groups where both happened, so a harder text never decides it (`supportEffect`). Tests: engine (like-for-like groups, repeats and guided answers left out; seen failing first) and e2e (the card, with axe).
- **Decision made 2026-10-26, a trial that can be reverted (DW: "try the research's input").** Test flights, as the scan proposed (GAP-05):
  - **What it does.** Every fifth block of sessions runs with one support fewer. A block is as long as a leg on the journey (5 sessions by default), so these are sessions 21 to 25, 46 to 50 and so on.
  - **Which support.** It takes turns among the supports he has on. It never takes away one that is off.
  - **What "off" means.** Pictures off hides the pictures on answers. Read-aloud off stops the automatic reading; the 🔊 buttons stay, so he can still tap to hear.
  - **What he sees.** The plan screen says so before every session in the block ("Test flight: no pictures with the answers for a few flights. Points stay the same."). A button keeps the support on for the rest of that block.
  - **Data.** Each answer saves the support as it really was, so "Do pictures and read-aloud help him?" fills both ways. The grown-ups' card says a trial is running.
  - **Unlike the scan.** The notice comes on the plan screen, not on the route map one leg ahead.
  - **Code.** `RULES.testFlightEvery` and `testFlight` (engine), the plan notice (`Session.tsx`), and `testKept` in settings.
  - **To revert.** Set `RULES.testFlightEvery` to 0, which switches it off everywhere, and drop its engine test. Or revert the commit.
  - **Tests.** Engine: blocks, taking turns, only supports that are on; seen failing first. E2e: the notice with axe, an answer saved with pictures off, and keeping it for the block.
- **Built 2026-10-28 (GAP-07).**
  - His finish screen lists the supports he had on, read from that session's answers ("Helpers you used today: pictures."). It is never a mark against him.
  - Turning the trial off (`RULES.testFlightEvery` set to 0) now also hides the grown-ups' trial note.
  - Tests: e2e (the line after a whole session).

## LTF-57 Today: a photo prompt (GAP-09, GAP-10)

Proposed 2026-10-19. Approach to confirm. Evidence as cited by the scan: Bhana et al. 2023; Yang et al. 2026.

- **What it is.** An optional photo of an object or place from his day, taken by a grown-up, as a cue for telling about it.
- **Checked against the code.** New: the app has no camera or photo code. Notes already follow a retention limit (`applyRetention`), and the cloud copy syncs events, notes and settings, so photos need their own path that never syncs.
- **Must hold.** Kept on this device only: never synced, exported or logged. Objects and places, not people, said on screen. Deleted after 7 days unless a grown-up keeps it (proposal), and added to the plan's privacy table.
- **Decisions.** Grown-up only, or may he photograph his own work? The retention period.
- **Built 2026-10-28: a decision made with the scan's proposals, off until a grown-up turns it on, and easy to revert.**
  - **Choices made.** A grown-up takes the photo, and it is kept for 7 days. Change either here if DW decides otherwise.
  - **Turning it on.** Grown-ups → Today recounts has a "Photo cue" switch, off by default.
  - **What he sees.** With it on, "My day" offers a photo field (a camera on a tablet or phone), saying "A thing or a place from today, not people." The photo stays on screen as a cue while he answers, and it can be deleted.
  - **Storage.** Photos live in their own local table (`photos`). They are never queued for the cloud copy, never in the export, cleared with "Delete from this device", and deleted after 7 days by the retention pass at start-up. His Today saves only `photo: true`, the fact that a photo was there, for a later with-and-without comparison.
  - **"What do you think?"** It has its own card, once he has told about a day with a photo.
  - **To revert.** Turn the switch off; nothing else changes. To remove it, drop the `photos` table use in `Today.tsx` and the switch.
  - **Tests.** E2e (off by default; on, a photo is shown as a cue and logged only as a fact; never in the outbox; one older than 7 days is gone after a reload).
- **Still open for DW.** The plan's privacy table needs a "photo cue" row (the plan is local, so it was not edited here).
- **Size.** M.

## LTF-58 Today: always "after" and a feeling, and counting them (GAP-08, GAP-13)

Proposed 2026-10-19. Built 2026-10-19 and 2026-10-26. Evidence as cited by the scan: Bhana et al. 2023; Goddard et al. 2014.

- **Checked against the code.** Mostly built: the four-panel strip (LTF-06), "what happened after" (LTF-05) and a feeling question; "after" is saved on each Today and shown as a trend (LTF-08). Missing: "after" and the feeling are asked depending on his stage and on what he told, not always; feeling words are not counted. (Both built since: see below.)
- **What it is.** Ask both every time, and count feeling words from a fixed list (no model) for the grown-ups' trend.
- **Built 2026-10-19 (the count).** Each Today saves whether he said how he felt (only the fact, never his words), and the grown-ups' "How his telling is growing" card shows it next to "what happened after" (`recountTrend`). Tests: engine (counted only from Todays that recorded it; seen failing first).
- **Decided 2026-10-26.** DW: always ask the follow-ups.
- **Built 2026-10-26.**
  - "What happened after that?" now follows what he did at every stage, not only from stage 2. It is still not asked when he skipped what he did.
  - "How did you feel?" was already asked at every stage.
  - "Why did you feel that way?" still comes from stage 2, or once he is practising narrative step 5.
  - The four-panel strip, skipped-question counts and the grown-ups' card follow the new rule.
  - Tests: unit (`askable`, `skippedKeys`; seen failing first) and e2e (stage 1 asks "after").
- **Decision made 2026-10-26, a trial that can be reverted (DW: "try the research's input").** Feeling words are now counted, as the scan proposed (GAP-13):
  - **What is counted.** Each Today about his day saves how many different words from the fixed list of feeling tiles (good, happy, proud and so on) appear in what he told, his own typed words included. Whole words only, no model.
  - **Privacy.** Only the count is saved, never the words.
  - **Where it shows.** The grown-ups' "How his telling is growing" card shows it per recount and as an average.
  - **Code.** `feelingWordCount` (`recount.ts`), `feelingWords` on the recount event, and `recountTrend`.
  - **To revert.** Stop logging `feelingWords` in `Today.tsx` and drop the card's column. Saved counts are harmless and can stay. Or revert the commit.
  - **Tests.** Unit: the count, whole words, each word once; engine: the trend; all seen failing first. E2e: the card shows one feeling word.

## LTF-59 "Does it fit?" questions (GAP-14 to GAP-17)

Proposed 2026-10-19. Approach to confirm. Evidence as cited by the scan: Howard et al. 2026 (theory); Tirado & Saldaña 2016; Wang & Poon 2026. Depends on the proposed rule R19.

- **What it is.** His guide offers a guess about the story; he taps "fits" or "doesn't fit", then taps the sentence that shows it. Both steps are scored on their own.
- **Checked against the code.** New. Parts exist to build on: the tap and tap-the-sentence question types, the Lantern Peaks inference check, and the content checks that tag each question's inference level (LTF-16).
- **Must hold.** The guide's guesses are never a trick or a contest, and are worded the same way every time; every guess is checked to be clearly right or clearly wrong before it is used; tapping only.
- **Decisions.** How often the guide's guess is wrong (the scan proposes one in three). Whether these join the Lantern Peaks check.
- **Built 2026-10-28: a pilot, with the scan's proposal and easy to revert.**
  - **The format.** Two existing ones chained, with no new code: a tap ("It fits" or "It does not fit") and then a sentence tap, linked with `after` as LTF-12's message and act pairs are. Item choice already serves the two together.
  - **The wording.** Every guess reads the same way: Your guide thinks: "…" Does that fit the story? Then: "Tap a sentence that shows whether it fits." Any sentence in the evidence counts.
  - **The content.** Six pairs (n5-i213 to n5-i224) on existing Feelings and thoughts stories at levels 2 and 3. Two of the six guesses do not fit (one in three): Leo sad after his solo, and Sam thinking his dad made the noise.
  - **Kept apart.** The Lantern Peaks inference-check stories are never used, and these do not join that check.
  - **Validation.** It now knows two kinds of pair: `act` after `message`, and `fit-show` after `fit`. Planting a pair with no `after`, or one pointing at the wrong item, was caught.
  - **Grown-ups and his card.** The Overview has a "Does it fit?" card with the two steps as separate lines. His "What do you think?" card covers it.
  - **For DW.** Each guess is meant to be clearly right or clearly wrong; that needs a person's read before more are written. The content checks raised no new flags.
  - **To revert.** Hide the twelve items in the Content library, or delete them from `content/bank/N5.json`.
  - **Tests.** Content validation (above) and e2e (the guess and the sentence step in the Content library, with axe; the grown-ups' card).
- **Size.** L in all, mostly content and review; the pilot is done.

## LTF-60 Engagement measured apart from reading (GAP-18, GAP-19)

Proposed 2026-10-19. Built 2026-10-19 (the weekly view) and 2026-10-28 ("Again tomorrow?"). Evidence as cited by the scan: Berenguer et al. 2026 (preliminary); Gao et al. 2025; Wouters et al. 2013.

- **Checked against the code.** Mostly built: steps, pauses, time away, demo skips, breaks, guess stops, "I'm not sure", "What do you think?" votes and unfinished sessions are all saved, and the grown-ups' area already keeps them apart (Skills and Overview for reading, Activity for engagement), with no combined score. Missing: keeping going after a miss and coming back by himself (both can be worked out from what is saved); an "Again tomorrow?" question; a weekly view with the two lines side by side.
- **Built 2026-10-19 (the weekly view).** The grown-ups' Activity tab opens with "Reading and engagement, week by week": right first time on his own turn in reading (guesses set aside) beside sessions finished, days he came, and how often a miss was followed by another answer in the same session. No combined score (`weekly`). Tests: engine (two weeks, own turn only, kept going after a miss; seen failing first) and e2e (the table, with axe).
- **Built 2026-10-28.**
  - After a finished session, his guide asks "Would you like to fly again tomorrow?" with three picture tiles: Yes, Maybe and Not tomorrow. It is never required.
  - The answer is saved as an `again` activity. The weekly table gains a "Wants to come back" column.
  - Tests: engine (counted per week; seen failing first) and e2e (his answer, then the grown-ups' table).
- **Still open.** Whether a return was his own idea (the log cannot tell).
- **Size.** S to M.

## LTF-61 A scene picture while he retells (GAP-20)

Proposed 2026-10-19. Built 2026-10-28 as a pilot, off until a grown-up turns it on. Evidence as cited by the scan: Berenguer et al. 2026 (preliminary).

- **What it is.** An optional picture of the story's scene while he retells it, never while he reads, tried session by session, counting feeling words (with LTF-58).
- **Checked against the code.** New. There is no retell step yet beyond the story map, so this depends on deciding what retelling looks like in the app.
- **Drafted 2026-10-28: a retell step to decide on, so this can be built.**
  - **What exists.** The story-map items (LTF-15's format) already ask for who, where, the problem, what happened and the ending from tiles. But the text stays on screen, so they check finding, not remembering.
  - **Proposal (recommended).** After the last own-turn item of a story session, an optional "Tell it back" step on that session's story:
    - the same story-map tiles, with the text hidden;
    - every other session (A/B by session) shows the story's scene picture (the passage's `picture`), never while he reads;
    - one `retell` event saves which parts he got right and whether the scene was shown, plus the feeling-word count from LTF-58 if he adds a sentence of his own.
    - The grown-ups see retell accuracy with and without the scene, as "Do pictures and read-aloud help him?" does.
  - **Must hold.** Tiles only, skippable, never a score that changes mastery or levels, and the picture never shows while he reads.
  - **Decide.** Build it as above (off until a grown-up turns it on), or keep retell out of the app. Size: M once decided.
- **Built 2026-10-28 as drafted: a pilot, off until a grown-up turns it on, and easy to revert.**
  - **When it comes.** At the end of a story session, before he picks a piece for his island, "Tell it back" asks the story-map question of one of that session's stories, from memory.
  - **What he sees.** No text, no hints, and no right or wrong shown. He can skip it. The story's picture (the passage's `picture`) shows on every other session, never while he reads.
  - **Which question.** The last story in the session that has a story-map question. Worked examples are left out, since he has just watched those filled in.
  - **What is saved.** One `retell` activity: the question, whether the scene was shown, and whether every part was right. A skip saves nothing.
  - **Grown-ups.** The Activity tab's "Telling a story back (a pilot)" card compares with and without the scene (`retellEffect`). It never changes his skills or levels.
  - **Turning it on.** Grown-ups → Settings → "Tell it back (a pilot)". His "What do you think?" card covers it.
  - **Not built.** Counting feeling words in a sentence of his own.
  - **To revert.** Turn the switch off.
  - **Tests.** Engine (`retellEffect`) and e2e (the step after a first story session: no text, the picture shown, skippable, nothing saved on a skip; with axe).
- **Size.** M, after a retell step exists.

## LTF-62 A second reading-level check (GAP-21, GAP-22)

Proposed 2026-10-19. Approach to confirm. Evidence as cited by the scan: Grossman & Chen 2026 (preprint); Day et al. 2025.

- **What it is.** An open-weight model's reading-level score beside the formula, flagging passages where the two disagree by more than one level for review; the formula stays the hard gate. A gold set of passages rated for reading level, checked in CI.
- **Checked against the code.** New. The pipeline uses textstat's Flesch-Kincaid grade only. The gold set from LTF-16 samples every level but is rated for coherence and inference, not reading level, and still waits for DW's ratings.
- **Must hold.** The model score never becomes the gate, and the passages used to tune it are never the ones used to judge it.
- **Built 2026-10-28 (the first step, without a model).**
  - **What it does.** `pipeline/levelcheck.py` gives a second reading-level opinion and flags a passage for review when it is more than one level from the passage's level. It runs in `npm run content:check` as the `second-level` check.
  - **Never the gate.** It is excluded from the exit code by name, so even a recorded agreement cannot make it block. Tested, and a mutation removing that guard was caught.
  - **The stand-in.** Until an open-weight model is chosen, the second opinion is the Spache formula: sentence length and words outside a list of familiar words, so vocabulary rather than syllables. It is built for grades 1 to 3, so it checks levels 1 to 3 only.
  - **Measured.** On 2026-10-28 it agreed within one level on all 332 prose passages at those levels (209 the same, 54 one lower, 69 one higher), so it flags nothing today. It is a quiet guard against a future text whose vocabulary is far from its level.
  - **A model later.** One plugs in as another scorer in `levelcheck.flags`.
  - **Still open.** A gold set rated for reading level (the LTF-16 gold set is rated for coherence and inference), and the choice of model.
  - **Tests.** `pipeline/test_checks.py` (the level mapping; a plain level-1 text passes and a hard one is flagged; levels 4 and 5 are not checked; never the gate).
- **Size.** M; the model and the gold set remain.

## Requests from the learner (LTF-51 to LTF-53, LTF-64)

## LTF-64 A save menu while he reads, and no update mid-flight

Requested 2026-10-26: "a menu that lets me save". He seemed worried that an update had lost some of his progress. Built the same day.

- **What was wrong.** A new version of the app switched in whenever the app was in the background, even in the middle of a session or a Today (`shouldSwitch` allowed hidden or safe, and its test said so). If he left the app mid-flight, for example to ask for help, it could reload onto the new version. His answers were kept, but the flight he was in was lost and did not count toward his journey.
- **What was built.**
  - A new version now waits for the safe moment only: his island's home screen with nothing open, whether or not the app is in the background.
  - A 💾 Save menu sits in the top bar of reading sessions, Today and math sessions. It says every answer is saved the moment he gives it, and holds the same "Save my progress" button as the island (LTF-53). On a phone it is an icon, and screen readers still hear "Save".
  - The step trail in a session now really takes its own row on a phone, as its stylesheet intended. An inline style had been overriding the rule.
- **Tests.** Unit (`shouldSwitch`). E2e: the menu in a reading session and in Today saves to the family copy, with axe. Checked by eye at phone width.
- **Not built.** Picking up an unfinished flight where he left it after a reload, for example if the browser closes the app. Ask if wanted (M).

Added 2026-10-17: three requests from him, passed on by DW, all built the same day.

## LTF-51 A picture he asks for, as a reward

- **DW's choices.** Claude Sonnet 5.5 draws it (Claude makes text, so it draws in SVG, in the island's flat style); he pays for it with flight points, like the gear; he types what to draw, and what he types may go to Anthropic. His name never does.
- **What was built.** "Draw a picture" on his island: a picture costs 50 flight points (about two sessions), spent from what he has earned, so his flight kit never loses a piece. He types up to 100 letters; the family API (`api/src/picture.js`) checks the request, allows three pictures a day per learner (a drawing that fails gives its turn back), and calls Claude Sonnet 5.5 with a kid-safe instruction: a gentle version of anything not right for a young child, no words unless asked, no names. Thinking stays off and effort low, so a drawing comes back within the API's time limit. No refusal fallback, on purpose: when Claude declines, he is asked for another idea and keeps his points. The picture is kept only if it holds no script, event handler, outside link or embed, and shows as an image, so nothing in it can run. Each picture is a `picture` event with what he asked and its cost; the grown-ups' Activity tab lists them with a plain note on what is sent where. The key is the app setting `ANTHROPIC_API_KEY` and never reaches the browser. Tests: points and gear (engine), the request checks, the daily limit, declines and the picture check (API, mutation-checked), and e2e with the drawing faked: no family copy, a decline that costs nothing, a picture that spends 50 points, the gallery and the grown-ups' list, with axe.
- **Audit 2026-10-28.**
  - "Thinking stays off" holds. On Claude Sonnet 5.5, `{ type: 'disabled' }` is refused, and `{ type: 'between_tools' }` is how thinking is turned off (allowed at effort high or below).
  - Fixed: the app sent its date as `2026-11-5`. The API rejects that and uses the UTC date instead, so the three-a-day limit would have run on UTC days from 1 November. `dayKey` now zero-pads.
  - Test: engine (`dayKey`).

## LTF-52 Hot-air balloons in the island's sky

- **What was built.** Three striped hot-air balloons drift across the island's sky with the clouds, each at its own height and pace, in daylight. With motion reduced they stay still, in view.

## LTF-53 "Save my progress"

- **What was built.** A "Save my progress" button on his island. Progress already saves as he goes; the button asks the browser to keep this device's copy, sends it to the family copy straight away when the device is linked, and says plainly where it is saved: "Saved at 5:34 PM, on this device and in your family's copy", or on this device only, and why. Tests: e2e on this device only and in the family copy, with axe.

## LTF-49 "I'm not sure": ask for help

Added 2026-10-14 by DW, after a first look at how his sessions are going: "give him a 'ask Dad/for help' prompt if he feels unsure". A short first-time demo for each question type was offered too; DW: not yet.

- **What was built.** An "I'm not sure" button beside Help on every question in the warm-up, guided practice and his own turn (not in the Peak check or check-ups, which measure). His guide says: "That's OK. Ask Dad to help you with this one." The name is a grown-ups' setting ("Who he asks for help"; "a grown-up" when empty). The "Still with me?" nudge adds "Not sure? Ask Dad for help." An answer after asking counts as helped, like the clue: it earns the clue's points and does not count as independent for mastery. The grown-ups' Activity tab shows how often he said he was not sure, by skill. A "What do you think?" card asks him about it once he has used it. Tests: e2e (the prompt with the name, the answer saved as helped, the grown-ups' count, axe; mutation-checked).

## LTF-50 Text levels that keep him near 80% right

Added and built 2026-10-14, DW's choice.

- **What was built.** Three first-try answers in a row at his level move him up a level; one miss moves him down. The old rule (two right up, two misses down) settles, simulated, where a learner gets about half right, below the 80% the app asks for mastery; the new one settles near 78%. Climbing back to a level he had already reached is no longer announced as a new unlock. Same day, a fix: a session's last answer is logged in the same millisecond as its finish, and the engine sometimes read the finish first and left that answer out of his mastery count; within one millisecond a session now starts first and ends last. Tests: the level rule, the highest level reached, and both orders of the last answer (each seen failing first).
- **Fixed 2026-10-28.**
  - What was wrong: the walk counted every answer on the skill, guided ones and inference checks included. In Together the clue shows by itself after the wait, so a slow, careful right answer counted as a miss and stepped him down.
  - What changed: levels now move only on warm-up reviews and his own turn. His level is worked out again from his history, so it may now sit higher than before.
  - Tests: engine (a guided answer and a check never step him down; seen failing first).

## Islands of their own (LTF-45 to LTF-48)

Added 2026-10-14 by DW: "the different islands are now working, but they have the same named areas and same progress levels." DW chose all four of the proposals below the same day, and that the stones on a visited island's map show the island's own steps. His reading lanterns are his reading skill, so they stay the same everywhere: on the path cards beside the map, and on Home Island. Each path keeps its colour, icon and place, so he always knows which path is which; everything around them changes. Built 2026-10-14. The new wording (island names, new quest steps, keepsakes) is a draft for DW's review.

## LTF-45 Each island names its own parts

- **What was built.** Every visited island has its own names for its three parts (Gull Island: Ferry Dock, Gull Meadow, Lookout Rocks), on its map, in its description for screen readers, and where he chooses a spot to build. The path cards say which part is which while he looks at that island ("Story Woods · Gull Meadow here"). Names sit on the side Home Island has them on (town left, green right, high ground at the back), so they never overlap. Tests: every island has three names of its own, none repeated anywhere.

## LTF-46 Quests with their own shape, on the island's map

- **What was built.** Quests run 3 to 5 steps. Most steps take one finished session; some take two and say why after the first ("The first night was cloudy. Next session, try again."); some are a thing from the island he builds (Gull Island's sailboat, Rail Coast's bus stop, Cloud Hill's weather station, Australia's camp tent), offered first after a session until it is built; some open no place. Each fits one stay on the island (at most five sessions). On a visited island the map shows the quest's numbered stones instead of the reading lanterns: lit when done, a flag on the next one. The place that waits for a lantern stays. Tests: sessions taken in order, a two-session step's progress, build steps, everything done once he sails on, the lantern place (mutation-checked); e2e: a session at Gull Island offers the sailboat first, building it finishes the quest.
- **Fixed 2026-10-28.**
  - What was wrong: "Each fits one stay" was off by one. The session that ends a leg moves him to the next island, so only four sessions counted at the default pace. Fossil Bay's and Reef Island's five-session quests could not finish while he was there; their last step was ticked silently when he sailed on. At pace 3, almost no quest finished.
  - What changed: the finish screen now reports the quest of the island the session started on. The session that ends his stay finishes that quest and says so. At pace 3, the remaining steps finish together as he leaves.
  - Tests: e2e (Reef Island's quest finishes on the session that sails on; seen failing first).

## LTF-47 A keepsake from each island

- **What was built.** Finishing an island's quest brings home its keepsake (a gull feather, a star chart, a train ticket); the finish screen says so, the quest card says what it will be, and Home Island shows a shelf of keepsakes from the islands he has reached, with the ones still to finish. Nothing new is stored: a keepsake follows from his log. Tests: one keepsake per island, each different; e2e: the shelf on Home Island, with axe.
- **Fixed 2026-10-28.** The keepsake line now shows for the island he is leaving (see LTF-46).

## LTF-48 Each island its own shape

- **What was built.** Each visited island has its own land, drawn row by row in `apps/web/src/art.tsx`: Fossil Bay wraps around a bay under layered cliffs, Reef Island rings a lagoon, Rail Coast is a long low strip, Cloud Hill has a runway, Australia has a red rock, with high tops of their own. Home Island keeps its layout and lantern paths. Things he built on an island before it had its own shape stay where they can and otherwise stand on the nearest free spot of the same kind of ground (his log is never rewritten). Tests: every island inside the view, all shapes different, every landing, stone and place on land and apart, and moved pieces (mutation-checked).

## LTF-38 Clicking through to the green check

Added 2026-10-13 by DW. Approach chosen by DW the same day, and built 2026-10-13, first in the queue.

- **What was built.** A wrong tap opens the clue for one more try (it never fades a choice, which would leave only the answer); a second wrong tap shows the answer, explained, with a neutral "Now you have seen how." Only an answer right on the first tap gets the success look and sound; right with the clue gets a neutral "You found it with the clue." Points are saved on each answer (`pointsFor`): 4 right on the first tap, 2 with the clue, 1 off when the answer was shown, none for a fast guess; older answers keep their 2. Gear follows his best total (`flightPeak`), so a piece is never taken back. The +3 bonus for going past his usual stopping point is gone. A first tap faster than the question could be read (`minReadMs`, about 600 words a minute, at least 1.5 seconds) is flagged `rapid`: it earns nothing and never counts toward or against mastery; two fast wrong answers in a row end the session kindly. "I need a break" replaces Stop on every session screen and is honoured at once, with no "Keep going" question, and both kinds of stop go to the lounge (`apps/web/src/Lounge.tsx`): a kite to fly (pointer, tap or arrow keys), his journey, his flight kit, nothing to answer. The grown-ups' Activity tab has a "Guessing and breaks" card (`guessing`: guesses set aside, kind stops, breaks asked for, and the minute guessing usually starts), and Settings can turn the guess check off or end sessions on a success after 8 to 15 minutes. Tests: `packages/engine/src/guessing.test.ts` (points, best total, reading time, set-aside answers, the guessing summary) and e2e runs of the wrong-tap path, a break, and two fast wrong answers into the lounge, with axe. The e2e helper answers instantly, so tests turn the guess check off unless they test it.
- **Audit 2026-10-28.**
  - The grown-ups' card is now called "Guessing, breaks and asking for help" (LTF-49 joined it).
  - An insight still said the app gives a bonus for getting past his usual stopping point. It now points to the break button and to ending on a success.
- **DW's choices.** A wrong tap: the clue, then one more try. Stopping: honoured, and "put him in a lounge with something fun to do". Points: "bonus when answered correct the first time, subtract when it's a third attempt", read as 4 on the first tap and 1 off when the answer had to be shown, replacing the keep-going bonus.
- **Original proposal.** Tapping choices until one turns green is a known pattern ("gaming the system"): when work becomes aversive, clicking through is the fastest way out. In a study of middle schoolers with a maths tutor it was the off-task behaviour most strongly tied to learning less, and rapid guessing on tests grows the longer a session runs. A three-choice item that allows retries always ends in success within three taps, so it rewards finishing, not thinking.

- **What the app does today.** Mastery already counts only answers right on the first tap with no hint (`first.current` in `apps/web/src/ItemView.tsx`). But a wrong tap opens the next hint and he can keep tapping, and any right tap gets the same success sound and look. Flight points are 2 for every answer, right or wrong (`flightPoints` in `packages/engine/src/activity.ts`), so fast guessing earns points too. Every session screen has a Stop button, but its dialog makes "Keep going" the default. Answer times are logged (`ms`), but nothing looks for rapid guessing. And a +3 bonus rewards keeping going past his usual stopping point (`usualStop`), the opposite of ending before fatigue.
- **1. Take away the payoff.** The success look only for answers right on the first tap; after a wrong tap or help, a neutral "Now you have seen how." A wrong tap opens a smaller step or "show me", then a fresh item, rather than the remaining choices. More items where guessing barely works (tapping the sentence, building an answer) rather than picking from three.
- **2. A real way out.** An "I need a break" button on every screen, honoured at once, every time, with no "Keep going" nudge. Teaching a request to replace escape behaviour is an established practice (Functional Communication Training).
- **3. Detect it gently.** With no clock on screen, two or three wrong answers in a row, each faster than the question could be read, end the session kindly ("Good place to stop. Your progress is saved."). That stretch of answers is set aside and counts neither for nor against him.
- **4. End before burnout.** The grown-ups see when guessing tends to start (say minute 9), and sessions can be set to end on a success before then.
- **Guards.** Nothing that feels like punishment: no lockouts, no "slow down" messages, no timers on screen.
- **Research.** [Baker et al. 2004, gaming the system](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p383.pdf); [Lindner, Lüdtke & Nagy 2019, onset of rapid guessing](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.01533/pdf); [Wise & Kong 2005, response time effort](https://doi.org/10.1207/s15324818ame1802_2); [NCAEP 2020 evidence-based practices](https://ncaep.fpg.unc.edu/wp-content/uploads/EBP-Report-2020.pdf); [ASAT on Functional Communication Training](https://asatonline.org/?p=17300).

## LTF-36 A new island at each stop

Added 2026-10-13 from DW's feedback: "as he progresses island, he stays in the same place... if he's progressing to the next island, the scenery should change, and he should have a new series/areas to unlock and progress." Approach chosen by DW the same day: home moves to each island he reaches, with areas that open one by one, things to build that belong there, a small quest, and areas gated on his level that he can come back to later. Built 2026-10-13, with the island text for DW's review in the app.

**Superseded in part (audit 2026-10-28).** LTF-45 to LTF-48 changed what this entry describes:
- Quests run 3 to 5 steps.
- The three lantern paths are drawn on Home Island only.
- Each island has its own land, not Home Island's layout.
- `settle` moves pieces on screen when an island's shape needs it.
- There is no `islandAreas`.
- Ranger Jo now also appears on Gull Island's map and on the way home.

Still true: eight islands, the landings, the lock text and the island switcher.

- **He sees.** When he comes ashore on a new stop, his home screen is that island: its own colours, coastline, features on open ground (boulders on Gull Island, rock layers at Fossil Bay, palms on Reef Island, red rocks in Australia) and a landing (a pier, a bus stop, or the Kookaburra). His three lantern paths come with him, so his progress is the same on every island. Each island has a quest of three steps from its story ("Count the gull nests with Ranger Jo."); each session he finishes there does the next step and opens a place with its landmark and new spots to build, and the session's last screen says what opened. A fourth place waits in mist with a lock until a lantern is lit ("The ranger hut opens when lantern 2 is lit on the Harbor Town path. You can come back for it later."). Buttons above the island take him back to any island he has reached, with everything he built there. The things offered to build lean toward the island's own (seals and boats on Gull Island, fossils and dinosaurs at Fossil Bay, trains and signals on Rail Coast).
- **Build.** `ISLANDS` in `apps/web/src/art.tsx` (Gull Island, Windy Cape, Fossil Bay, Reef Island, Star Point, Rail Coast, Cloud Hill, which is also the take-off, and Australia; Home Island is unchanged), on Home Island's tile layout so the paths stay put. Pieces carry the island they were built on (`island` on the world event; older pieces are Home Island's). `settings.islandsSeen` keeps the session count when he first came ashore, so an island's areas open with the sessions after that; islands he has sailed on from have all their quest places open. `islandAreas`, `islandsReached`, `islandArrival` and the quest card are in `apps/web/src/journey.tsx`.
- **Eval first.** Unit tests (`apps/web/src/islands.test.ts`, mutation-checked): every island has three quest places and one lantern place, all drawn; the paths, places and landing are on every island and the coasts differ; places open one session at a time, all once he sails on, and the last with its lantern; a closed place has no build spots; sessions count from when he came ashore. An e2e test comes ashore on Gull Island, checks the quest and the lock with axe, finishes one more session to open the gull nests, and goes back to Home Island.
- **Guards.** Places open with finished sessions or lanterns, never with scores (R9). A locked place always says what opens it, and nothing he built is ever lost or moved. Home Island looks as it did.
- **For DW to read.** The quest lines, place names and lantern gates in `ISLANDS`. Ranger Jo appears only in a Gull Island check-up text so far.

## LTF-37 A natural reading voice

Added 2026-10-13 from DW's feedback: "the voice is very robotic, monotonic. Not a very good representation of good enunciation, and speech." DW chose a natural Azure voice, then asked to try Edge's natural voice first.

- **Built 2026-10-13 (step 1).** Read-aloud used the device's default voice, which on Windows is an old desktop voice. Now, unless a grown-up picks one, it chooses the most natural voice the device has: Edge's online "Natural" voices (Ava, Andrew, Emma or Brian first), then Apple's Enhanced or Premium voices, then Google's. Offline, it uses a voice on the device. Settings shows which voice that is. Unit tests in `apps/web/src/media.test.ts` (mutation-checked).
- **Fixed 2026-10-28.** Settings named the most natural voice as if the device were online. Offline, it now names the device voice actually used.
- **Step 2, on hold until DW has listened.** Pre-made audio from an Azure neural voice for the bank's text, made when first needed and kept on his device, with SSML for pauses and pace; his name and his own sentences would stay on the device voice. Needs an Azure AI Speech resource (free F0 tier, 0.5 million characters a month); whether HD voices are on the free tier is unconfirmed.

## LTF-20 Island routes that branch to themed islands

Added 2026-10-13. Approved by DW: islands follow his interests, every route reaches Australia, and he picks the route. Size confirmed by DW 2026-10-13: one fork after Gull Island. Four islands are written, and the fork offers the three that best match his interests.

- **What was built (2026-10-13).** The engine walks his chosen route (`journeyRoute`, `forkOptions`, `routePosition`, `pastFork`), with tests. `content/journey.json` has the four islands, with the proposed LTF-21 to LTF-24 text, for DW to review in the app; Gull Island's last postcard line is route-neutral, and the airfield's bus line has a boat version for island routes (`byFrom`). At Gull Island the journey waits for him: "Choose your sea route" shows the three islands that best match his interests, each with its first beat, its topics and read-aloud, and no timer. The map shows his route so far; before he chooses, the offered islands branch off it with dashes. Each island has a scene and a souvenir (ammonite, sea turtle, observatory dome, railway signal). On the way to an island, sessions lean toward its two topics, as a lean rather than a filter. Each fork is checked once per learner: anyone already on the way to Windy Cape when the routes arrived keeps that route, and the grown-ups' Settings says so. Settings shows the route he chose and when. The choice is logged (activity `route`), and "What do you think?" asks about it once. `npm run check` checks that every stop is reachable, every route ends at Australia and all routes have the same length. Tests: `apps/web/src/journey.test.ts` (each fork checked once, Windy Cape kept, the fork offered at Gull Island, the boat line on island routes; mutation-checked) and an e2e run that picks Star Point, with axe. The island text reads at grades 1.4 to 2.4 (Flesch-Kincaid), inside the range of today's stops (1.0 to 3.6), and each island has about twice Windy Cape's words. Check-up texts for the four islands are in (LTF-14). Still open: DW's read of every line.

- **Research.** Islands that follow his interests use R8 ([El Zein et al. 2016](https://meadowscenter.org/library/embedding-perseverative-interest-of-a-child-with-autism-in-text-may-result-in-improved-reading-comprehension-a-pilot-study/); [Solis et al. 2022](https://eric.ed.gov/?id=ED634621)), whose mixed results are why one pick in five still ignores interests. A story world that rewards finished sessions, not scores, is R9 ([Deci et al. 1999](https://pure.ewha.ac.kr/en/publications/a-meta-analytic-review-of-experiments-examining-the-effects-of-ex/); [Sailer & Homner 2020](https://eric.ed.gov/?id=EJ1245270)). R30 ([Gao et al. 2025](https://frontiersin.org/journals/pediatrics/articles/10.3389/fped.2025.1498563/abstract)) keeps the islands a wrapper rather than the teaching. Branching routes and the route choice are our design, not a tested rule.
- **He sees.** The journey map shows forks. At a fork, his guide names each sea route and the island it leads to, for example Fossil Bay (dinosaurs, mining), Reef Island (ocean, animals), Star Point (space, weather) or Rail Coast (transport, maps). He taps one, and the whole route stays visible ahead of time, so nothing is a surprise. Every route ends at Australia; a branch is a different way there, never a dead end.
- **On a themed island.** Sessions on that leg lean toward the island's two interests, through the interest weighting that already exists. Each island has its own art, story beats, a setback with a coping line and a plan choice, a postcard and a souvenir, like the current stops.
- **Grown-ups see.** The route he chose and when, on the journey card in Settings. The journey pace and setbacks settings work as now.
- **Why now.** Every interest has 166 to 359 practice items after the 2026-10-13 tripling, 145 to 261 of them at levels 3 to 5, so each island can draw on its own themes. DW's note on LTF-05 asks for a larger island route list as the corpus grows, and LTF-14 asks for check-ups themed to the island he is on.
- **Build.** `content/journey.json` stops gain `next` (the stops a route can go to) and `topics`. The engine's `journeyPosition` walks the route he chose instead of a single list; his choices are saved like `journeyChoices`, and his place on today's route maps onto the new map, so nothing resets. A fork beat and route choice in `journey.tsx`, island art in `art.tsx`, and the island's topics added to the item ranking in `pickItems` for that leg.
- **Eval first.** Engine tests: every route reaches Australia; finished sessions move him along the route he chose; changing the pace never moves him back; a learner partway along today's route keeps his place. An e2e test picks a route at the fork with an axe check. Content validation checks every stop is reachable and every route ends at Australia.
- **Guards.** At most three routes at a fork, shown with pictures and read aloud. The choice waits for him and has no timer. Interest weighting stays a lean, not a filter: one pick in five still ignores interests, so the interest comparison (R8) stays fair. Items he has seen still come last (see the repeats tracking).
- **Fixed 2026-10-28.**
  - Pace changes: a pace change kept his stop and step, but could show an earlier beat from the new pace's table, so a setback he had got past came back. Each pace anchor now keeps the beat he has reached (`JourneyAnchor.beat`).
  - Pace 7: "One more session" (beat 4) showed with two sessions left. The table is now 0, 1, 1, 2, 3, 3, 4.
  - The Overview names the routes he chose.
  - A flight-path or way-home choice is logged as `path:` or `home:`, so only a sea route counts for its "What do you think?" card.
  - Tests: engine and unit (seen failing first).

## Proposed: branch-out stories (LTF-21 to LTF-29)

Added 2026-10-13, drafted by a story-ideation pass for DW's review. DW approved all of them on 2026-10-13 (LTF-29 is replaced by the koala keeper arc). LTF-21 to LTF-24 are in the app as LTF-20's islands (stop entries, the shared seams, map, scenes, souvenirs and the "What do you think?" line), so they can be reviewed there, with 12 check-up texts each; DW's read stays open. LTF-21 to LTF-24 are a full five-beat arc for each LTF-20 island; LTF-25 to LTF-29 are smaller branch-outs. Audit 2026-10-28: LTF-21 to LTF-24 match the content word for word, though their subtasks are still unticked, and DW's read of them is still open. LTF-25 to LTF-28 are built and LTF-29 was replaced by the keeper arc. Every arc keeps the journey's rules: it moves with finished sessions, the setback is scripted and explained, both plans work, and Captain Ada's invitation to Cloud Hill closes each island's postcard, so the airfield leg still follows. Three seams in today's canon are shared subtasks, done once for all four islands: Gull Island's last postcard line ("The kites are over Windy Cape.") and the airfield's beat 1 ("Bus 9 goes from Windy Cape to Cloud Hill") assume the Windy Cape route, and the map marker in `journey.tsx` picks the bus icon by stop index (`now.stop === 2`) rather than by stop.

## LTF-21 Fossil Bay: the dig under the cliff

Proposed 2026-10-13. Approved by DW 2026-10-13, as built in the app (with the LTF-36 quest lines). Part of LTF-20.

- **Status (2026-10-13).** Built under LTF-20 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene, souvenir and check-ups (12 per island). DW approved it as built on 2026-10-13.

- **Story.** The south sea route goes to Fossil Bay, gray cliffs made of rock layers where Dr. Bell (the fossil expert at the Harbor Town Fossil Museum, already in the bank) is running a dig. The setback is a closed beach: the cliff is wet after a night of rain, so the boat cannot land under it. It suits dinosaurs and mining because the leg is about fossils, rock layers and digging tools, and the postcard ends with a real fossil going into a plaster jacket, as the bank's F2 passage describes.
- **He sees.**
  - Beat 0: "From the hill on Gull Island, you can see gray cliffs to the south. That is Fossil Bay. The south sea route goes there."
  - Beat 1: "A letter came from Dr. Bell, the fossil expert at the museum. It says: We are digging at Fossil Bay this week. Come and help. Bring a hat. It rained hard last night." (smooth: the same letter without the last sentence)
  - Beat 2 (obstacle, `blocked`): "Your boat reached Fossil Bay. But the beach under the cliff is closed. Rocks can fall from a cliff after heavy rain, so Dr. Bell put up a sign." Notice (type `notice`, title "Fossil Bay Beach", icon 🪨): "CLIFF BEACH CLOSED" / "The cliff is wet after the rain." / "Use the pier. The beach opens when the cliff is dry." Cope: "When a beach is closed, we can use the pier instead. The cliff will dry by the afternoon." Ask: "How will you get to the dig?" Plan A "Land at the pier and take the top path" → reply "Good plan. The top path runs along the cliff top to Dr. Bell's tent." → beat 3: "You landed at the pier and walked the top path. From the cliff top, you could see the whole dig below." Plan B "Wait on the boat until the cliff is dry" → reply "Good plan. Dr. Bell says the sun will dry the cliff by 3 PM." → beat 3: "The sun dried the cliff by 3 PM. Dr. Bell took the sign away, and your boat landed on the beach." Talk: "Ask: the beach was closed after rain, so he had to find another way in. What else could he have done?" Smooth: "Your boat reached Fossil Bay. The beach under the cliff is long and gray."
  - Beat 3 (smooth): "You landed at the pier. A path leads along the beach to the dig."
  - Beat 4: "Dr. Bell's tent is at the far end of the beach. You can see people with brushes and small hammers. One more session, and you reach Fossil Bay."
  - Postcard: "Fossil Bay has gray cliffs made of thin layers of rock. The lowest layers are the oldest." / "Dr. Bell shows you an ammonite, the coiled shell of a sea animal from the time of the dinosaurs." / "You brush sand off a bone. Dr. Bell wraps it in a plaster jacket to keep it safe." / "A boat comes into the bay. It is Captain Ada, a pilot." / "She says, \"I have a plane that can fly a long way. It needs a runway and some work. Come with me to Cloud Hill.\""
  - Souvenir: `ammonite`, "Ammonite fossil" (topic `dinosaurs`, stop `fossil`).
- **School goal.** Key details: the notice has three rows, and only one of them (use the pier) decides what to do; the plan choice works only when he finds that row.
- **Subtasks for story incorporation.**
  - [ ] Stop entry in `content/journey.json`: id `fossil`, name, emoji 🦕, `souvenir: "ammonite"`, `topics: ["dinosaurs", "mining"]`, `next: ["airfield"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Gull Island gains `next: ["fossil", "reef", "star", "rail", "cape"]` (LTF-20; Windy Cape marked `legacy`), and its last postcard line "The kites are over Windy Cape." becomes route-neutral, for example "Far out, you can see other islands." (shared with LTF-22 to LTF-24, do once)
  - [ ] The airfield's beat 1 ("Bus 9 goes from Windy Cape to Cloud Hill") gets a per-origin or neutral line, since from a themed island Captain Ada's boat goes to Cloud Hill; LTF-28 proposes the per-origin version. The map marker rule in `journey.tsx` (`now.stop === 2 ? '🚌' : '⛴️'`) must key on the stop id, not the index. (shared, do once)
  - [ ] Journey map: `AT` coordinates for Fossil Bay and the two route curves (Gull to Fossil Bay, Fossil Bay to the airfield) in `apps/web/src/journey.tsx`; a `StopArt` scene (gray layered cliff, a tent, a brush).
  - [ ] Souvenir piece `ammonite` in the pieces list in `apps/web/src/art.tsx` with `stop: 'fossil'`, so `pieceById` resolves it and the postcard offers it.
  - [ ] One "What do you think?" line in `apps/web/src/features.ts` for the fork itself (`island-route`, met when a route choice is saved); shared with LTF-20, not one per island.
  - [ ] LTF-14 check-up texts tagged with stop `fossil`: about 12 reserved items on fossils, rock layers, a quarry notice and a dig timetable.
  - [ ] Checks: `npm run check` (it now also checks that every stop is reachable, every route ends at Australia and all routes have the same length), `npm run content:check` and `pipeline/check.py` on the check-up passages; the beats and postcard are outside the pipeline, so check their reading level by hand (level 1 to 2 band, sentences of 13 words or fewer).
  - [ ] Tests: engine routing (Gull to Fossil Bay to the airfield reaches Australia in the same session count as the Windy Cape route; a pace change never moves him back); an e2e run that picks Fossil Bay at the fork, reaches the obstacle, chooses a plan, reads the postcard and picks the souvenir, with an axe check.
  - [ ] DW reads every line: beats, notice rows, cope, both options and their after lines, talk, smooth texts, postcard and souvenir name.
- **Guards.** "Rocks can fall" is one calm safety sentence, like Windy Cape's fallen rocks, and nobody is on the beach while it is closed. Dr. Bell matches the bank (museum fossil expert, plaster jackets). Fossils are handled only with Dr. Bell and stay with the dig, never kept as treasure, which matches the bank's "do not touch" rule. The facts are simple and true: layers, lowest is oldest, ammonites lived in the time of the dinosaurs. Watch the reading level of "ammonite" and "plaster jacket" (both are explained in the same sentence).

## LTF-22 Reef Island: the boat waits for the tide

Proposed 2026-10-13. Approved by DW 2026-10-13, as built in the app (with the LTF-36 quest lines). Part of LTF-20.

- **Status (2026-10-13).** Built under LTF-20 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene, souvenir and check-ups (12 per island). DW approved it as built on 2026-10-13.

- **Story.** The west sea route goes to Reef Island, a ring of coral around a calm lagoon, with Mari, who drives the reef boat (new, needed for the island). The setback is a late boat: the channel through the reef is deep enough only at high tide, so today's crossing moves to 5 PM. It suits ocean and animals because the wait is spent at tide pools and the postcard is coral, a clownfish and turtle tracks.
- **He sees.**
  - Beat 0: "From the hill on Gull Island, you can see a ring of white waves to the west. That is the reef around Reef Island. The west sea route goes there."
  - Beat 1: "Mari drives the reef boat. She says the boat crosses the reef through a gap called a channel. The water in the channel is deep only at high tide." (smooth: "Mari drives the reef boat. She says the lagoon inside the reef is calm and clear.")
  - Beat 2 (obstacle, `blocked`): "You are at the pier, but the boat is not going yet. The tide is low, and the water in the channel is too shallow for the boat." Notice (type `notice`, title "Reef Boat", icon 🌊): "LOW TIDE: the channel is too shallow." / "Next crossing at high tide: 5 PM." / "Tide pools open until 4 PM." Cope: "The tide comes in twice a day. The water will rise, and the boat will cross." Ask: "What will you do until the tide comes in?" Plan A "Explore the tide pools with Mari" → reply "Good plan. Mari knows where the sea stars hide." → beat 3: "You found a sea star and two crabs in the tide pools. At 5 PM the tide was high, and the boat crossed the channel." Plan B "Help Mari get the boat ready" → reply "Good plan. The boat needs fuel, and the life jackets need counting." → beat 3: "You helped Mari fuel the boat and count the life jackets. At 5 PM the tide was high, and the boat crossed the channel." Talk: "Ask: the boat was late because of the tide. What can we do while we wait for something we cannot change?" Smooth: "You are at the pier. Mari checks the boat, and you count the life jackets."
  - Beat 3 (smooth): "The boat crossed the channel into the lagoon. The water is clear and calm."
  - Beat 4: "Inside the reef, the water is calm and clear. You can see fish under the boat. One more session, and you reach Reef Island."
  - Postcard: "Reef Island sits inside a ring of coral." / "Coral is made by tiny animals called polyps. Their hard skeletons build up into a reef, very slowly." / "Through the glass floor of the boat, you see a clownfish in a sea anemone." / "At night, Mari shows you turtle tracks in the sand. Sea turtles lay their eggs on this beach." / "Captain Ada's boat is tied up at the pier. She says, \"I have a plane that can fly a long way. It needs a runway and some work. Come with me to Cloud Hill.\""
  - Souvenir: `turtle`, "Sea turtle" (topic `ocean`, stop `reef`).
- **School goal.** Staying flexible when plans change: the crossing time moves with the tide, and both plans accept the new time instead of fighting it.
- **Subtasks for story incorporation.**
  - [ ] Stop entry in `content/journey.json`: id `reef`, emoji 🐢, `souvenir: "turtle"`, `topics: ["ocean", "animals"]`, `next: ["airfield"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Shared seams from LTF-21 (Gull's last postcard line, the airfield's beat 1, the map marker rule), done once.
  - [ ] Journey map: `AT` coordinates and route curves; a `StopArt` scene (a ring of white surf, a lagoon, a small boat).
  - [ ] Souvenir piece `turtle` in `apps/web/src/art.tsx` with `stop: 'reef'`.
  - [ ] "What do you think?" line: covered by the shared fork feature in LTF-21.
  - [ ] LTF-14 check-up texts tagged with stop `reef`: about 12 reserved items on coral, tides, a tide-pool checklist and a boat timetable (the bank already has tide-pool notices to match in tone).
  - [ ] Checks as in LTF-21: `npm run check`, `npm run content:check`, `pipeline/check.py` for the check-up passages, and a hand reading-level pass over the beats.
  - [ ] Tests: engine routing for the reef route; an e2e run that picks Reef Island, reaches the tide notice, chooses a plan and reads the postcard, with axe.
  - [ ] DW reads every line.
- **Guards.** Life jackets are counted and nobody swims alone; the turtle beach is visited with Mari and nothing is touched. Coral is "tiny animals called polyps", never a plant or a rock. "Twice a day" is the simple tide fact and holds for most coasts. The obstacle reuses `blocked` (low water blocks the channel), so no type change; if DW wants the card to read "A notice at the harbor" instead of "A sign on the path", add a `late` obstacle kind (three one-line edits: the Beat type, `NOTICE_TITLE`, `OBSTACLE_ICON`). Mari is the only new character.

## LTF-23 Star Point: a cloudy night at the observatory

Proposed 2026-10-13. Approved by DW 2026-10-13, as built in the app (with the LTF-36 quest lines). Part of LTF-20.

- **Status (2026-10-13).** Built under LTF-20 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene, souvenir and check-ups (12 per island). DW approved it as built on 2026-10-13.

- **Story.** The north sea route goes to Star Point, a headland with a white observatory dome and a weather station, run by Dr. Amal (new). The setback is weather: clouds come in from the sea on the first night, so the dome stays shut. It suits space and weather because the wait is spent on a weather balloon launch or a star map, and the clear night brings the Moon, Saturn and the space station.
- **He sees.**
  - Beat 0: "From the hill on Gull Island, you can see a white dome on a point of land to the north. That is the observatory at Star Point. The north sea route goes there."
  - Beat 1: "Dr. Amal works at the observatory. Her message says: Come on a clear night. The telescope can show you the Moon and Saturn. The weather report says clouds may come." (smooth: without the last sentence)
  - Beat 2 (obstacle, `weather`): "Your boat landed at the pier below Star Point. Then thick clouds came in from the sea. A telescope cannot see stars through clouds, so the dome stays shut tonight." Notice (type `notice`, title "Star Point Sky Board", icon ☁️): "Tonight: cloudy. No stars." / "Tomorrow night: clear." / "Weather balloon goes up at 6 AM." Cope: "Clouds move away. The sky will be clear again, and the dome will open." Ask: "What will you do on the cloudy night?" Plan A "Get up early for the weather balloon" → reply "Good plan. The balloon goes up at 6 AM, clouds or no clouds." → beat 3: "At 6 AM you watched the balloon go up. It carries a small box that measures the air and sends the numbers back by radio. That night, the sky was clear." Plan B "Learn the star map inside the dome" → reply "Good plan. Dr. Amal has a big star map on the wall." → beat 3: "You learned five star names on the map. The next night the clouds were gone, and you found all five in the sky." Talk: "Ask: the clouds hid the stars, so the plan changed. What did he do instead?" Smooth: "Your boat landed at the pier below Star Point. The dome is white and round, and the sky is clear."
  - Beat 3 (smooth): "Dr. Amal opens the dome. The telescope points at the Moon."
  - Beat 4: "Tonight is clear. Small lamps light the path up the point. One more session, and you reach Star Point."
  - Postcard: "The observatory at Star Point has a round dome. A slit in the dome opens, and the telescope looks out." / "Through the telescope, the Moon has gray plains and round craters." / "Saturn looks like a small yellow ball with a ring around it." / "Dr. Amal points to a bright dot moving across the sky. It is the space station, which goes around Earth in about 90 minutes." / "Captain Ada climbs the path to the dome. She says, \"I have a plane that can fly a long way. It needs a runway and some work. Come with me to Cloud Hill.\""
  - Souvenir: `dome`, "Observatory dome" (topic `space`, stop `star`).
- **School goal.** Main idea: the Sky Board's rows add up to one idea (no stars tonight, but tomorrow is clear), and a check-up text on what a weather balloon does gives a clean main-idea item.
- **Subtasks for story incorporation.**
  - [ ] Stop entry in `content/journey.json`: id `star`, emoji 🔭, `souvenir: "dome"`, `topics: ["space", "weather"]`, `next: ["airfield"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Shared seams from LTF-21, done once.
  - [ ] Journey map: `AT` coordinates and route curves; a `StopArt` scene (a dome on a headland at dusk, a few stars, a balloon).
  - [ ] Souvenir piece `dome` in `apps/web/src/art.tsx` with `stop: 'star'` (the existing `telescope` piece stays a Lantern Peaks piece).
  - [ ] "What do you think?" line: covered by the shared fork feature.
  - [ ] LTF-14 check-up texts tagged with stop `star`: about 12 reserved items on the Moon's phases, a sky board, a weather balloon and planets (the bank's observatory notices set the tone).
  - [ ] Checks as in LTF-21, plus a hand reading-level pass over the beats.
  - [ ] Tests: engine routing for the star route; an e2e run that picks Star Point, reaches the sky board, chooses a plan and reads the postcard, with axe.
  - [ ] DW reads every line.
- **Guards.** Night-time is lit and with an adult; no dark-and-alone wording. The facts stay simple and true: the Moon's plains and craters, Saturn's ring through a small telescope, the space station's 90-minute orbit, a balloon that carries a small measuring box and sends numbers by radio. Nothing about the balloon bursting. Dr. Amal is the only new character; the Lantern Peaks observatory on Home Island is a different place and is not contradicted.

## LTF-24 Rail Coast: a broken signal

Proposed 2026-10-13. Approved by DW 2026-10-13, as built in the app (with the LTF-36 quest lines). Part of LTF-20.

- **Status (2026-10-13).** Built under LTF-20 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene, souvenir and check-ups (12 per island). DW approved it as built on 2026-10-13.

- **Story.** The east sea route lands at Pier Station on Rail Coast, where the Coast Line train runs beside the sea to Rail Coast station, with Mr. Haddad, the signal operator (new). The setback is a broken part: a signal at Shell Halt is broken, and trains wait until it is fixed, while a bus runs instead. It suits transport and maps because the plan is read off a message and a line map, and the postcard is a signal box and a map room with every island on the wall.
- **He sees.**
  - Beat 0: "From the hill on Gull Island, you can see a long, low island to the east. A train runs along its coast. That is Rail Coast. The east sea route goes there."
  - Beat 1: "Your boat lands at Pier Station. From there, the Coast Line train runs beside the sea to Rail Coast. Mr. Haddad, the signal operator, sent you a map of the line. One signal on the line is very old." (smooth: without the last sentence)
  - Beat 2 (obstacle, `broken`): "You are on the platform at Pier Station, but the train is not moving. A signal at Shell Halt is broken. A signal tells the driver to stop or go, so trains wait until it is fixed." Notice (type `message`, app text, from "Rail Coast Station"): "A signal at Shell Halt is broken." / "Trains wait until it is fixed, at about 3 PM." / "A bus runs from Pier Station to Rail Coast at 2 PM." Cope: "A broken signal gets fixed. Until then, we can take the bus or wait." Ask: "How will you get to Rail Coast?" Plan A "Take the bus at 2 PM" → reply "Good plan. The bus stops right outside the station." → beat 3: "The bus took the coast road. From the window, you saw the train waiting at Shell Halt, and then its signal turned green." Plan B "Wait for the train and follow the map" → reply "Good plan. Mr. Haddad says the signal will be fixed by 3 PM." → beat 3: "You followed the line on the map while you waited. At 3 PM the signal was fixed, and the train came in." Talk: "Ask: the train could not go because a signal was broken. He had two ways to get there. Which would you pick, and why?" Smooth: "You are on the platform at Pier Station. The Coast Line train comes in on time."
  - Beat 3 (smooth): "The train runs right beside the sea. You can see the waves from your seat."
  - Beat 4: "The map shows one more stop before Rail Coast. One more session, and you reach Rail Coast."
  - Postcard: "Rail Coast station has a clock, a signal box and a map room." / "In the signal box, Mr. Haddad pulls a lever, and a signal changes to tell the driver to go." / "In the map room, a big map shows every island. The key tells you what each symbol means." / "You find Home Island, Gull Island and Cloud Hill on the map." / "Captain Ada is waiting on the platform. She says, \"I have a plane that can fly a long way. It needs a runway and some work. Come with me to Cloud Hill.\""
  - Souvenir: `signal`, "Railway signal" (topic `transport`, stop `rail`).
- **School goal.** Key details: the message has a time and a bus stop, and those two details decide the plan; the map key in the postcard is the same skill on a map.
- **Subtasks for story incorporation.**
  - [ ] Stop entry in `content/journey.json`: id `rail`, emoji 🚂, `souvenir: "signal"`, `topics: ["transport", "maps"]`, `next: ["airfield"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Shared seams from LTF-21, done once.
  - [ ] Journey map: `AT` coordinates and route curves; a `StopArt` scene (a train on a sea wall, a signal, a small station).
  - [ ] Souvenir piece `signal` in `apps/web/src/art.tsx` with `stop: 'rail'` (the existing `train` piece stays a Harbor Town piece).
  - [ ] "What do you think?" line: covered by the shared fork feature.
  - [ ] LTF-14 check-up texts tagged with stop `rail`: about 12 reserved items on a line timetable, a map key, a platform notice and a level crossing (the bank's Harbor Town Station texts set the tone).
  - [ ] Checks as in LTF-21, plus a hand reading-level pass over the beats.
  - [ ] Tests: engine routing for the rail route; an e2e run that picks Rail Coast, reaches the message, chooses a plan and reads the postcard, with axe.
  - [ ] DW reads every line.
- **Guards.** "Trains wait until it is fixed" states the safety rule without any danger word. Facts stay simple and true: a signal tells the driver to stop or go; a map key explains the symbols. Mr. Haddad is the only new character; the existing `transport` interest and the `train` piece are not touched. Sam Rivera's love of trains is left out on purpose, so the journey cast stays Captain Ada and the island hosts.

## LTF-25 A second fork at Cloud Hill: two flight paths

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20.

- **What was built (2026-10-13).** The Australia stop has two `paths`: the island way (its own beats, kept for anyone already flying when the paths arrived) and the reef way, with Shell Island's runway closed for rolling after rain. At Take-off the journey waits, as at a sea fork, on a "Choose your flight path" card; the story then follows the chosen path's beats, and both land after the same number of sessions. One change from the proposal, for the story's logic: the Kookaburra lands on Shell Island for fuel and the runway then closes, so he waits on the ground (watching the roller is possible) and takes off at 3 PM. The map shows both paths while he chooses and the reef way's small islands after. The home screen says Captain Ada has two flight paths; the Overview and Settings name the path. `npm run check` checks that a stop with paths keeps exactly one for learners already on the way and that every path has as many beats as the stop. Tests: unit (waiting at Take-off, the reef way's beats, the same landing time, the kept path) and an e2e run that picks the reef way, with axe.

- **Story.** At the airfield, Captain Ada shows two flight paths on her map: the island way (today's Australia leg, with the windy day on a small island) and the reef way, over a chain of small islands. The reef way's setback is a closed airstrip: the runway on Shell Island is being rolled flat after rain, so the Kookaburra waits until 3 PM. Same number of sessions, same landing at Bluegum.
- **He sees.** Beat 0: Captain Ada's map with two paths. Beat 1: "Below you, the small islands look like green dots in a blue sea." Beat 2 (`blocked`, notice "Shell Island Airstrip": "Runway closed until 3 PM." / "A roller is flattening it after the rain." / "Planes may land after 3 PM."), cope "A runway that is being fixed will open again. We land at 3 PM.", ask "What will you do while the roller works?", Plan A "Watch the roller from the fence" → beat 3 "At 3 PM the runway was flat and dry, and the Kookaburra landed for fuel." Plan B "Write a postcard home" → beat 3 "You wrote a postcard. At 3 PM the runway was flat and dry, and the Kookaburra landed for fuel." Beat 4: "The fuel tank is full again. One more session, and you land in Australia." Postcard and souvenir: the existing Australia postcard and koala piece, unchanged.
- **School goal.** Staying flexible when plans change.
- **Subtasks for story incorporation.**
  - [ ] A second Australia-leg beat set in `content/journey.json`, keyed by the chosen path, and `next` on the airfield stop listing both paths.
  - [ ] A fork beat at the airfield in `journey.tsx` reusing the LTF-20 fork card; a second curve on the map from the airfield to Australia.
  - [ ] No new souvenir or stop art; the Australia stop stays one stop.
  - [ ] Checks: the LTF-20 reachability check; a hand reading-level pass.
  - [ ] Tests: engine test that both paths land after the same session count; an e2e run of the airfield fork with axe.
  - [ ] DW reads every line.
- **Guards.** The Kookaburra is Captain Ada's to fly, so the choice is never about the flight itself, only about the wait. Keep this after the four islands have landed, since it doubles the Australia leg's text to review.

## LTF-26 Day trips: a second postcard from a reached island

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20.

**Fixed 2026-10-28.** An island first reached on the way home now gets its day trip and its picture.

- **What was built (2026-10-13).** `daytrip` on Fossil Bay (the old quarry), Reef Island (tide pools), Star Point (the weather station) and Rail Coast (the level crossing), each under 60 words with sentences of 13 words or fewer. A reached island's postcard has a "Day trip" button that opens the page with read-aloud and a way back; it moves nothing. Opening one is logged (activity `daytrip`), and "What do you think?" asks about it once. An e2e test checks the button is on Fossil Bay's postcard and not Gull Island's, with axe.

- **Story.** Once an island is reached, its postcard dialog gains a "Day trip" page: three or four sentences and one fact about a second place on the island (Fossil Bay's old quarry, Reef Island's tide pools, Star Point's weather station, Rail Coast's level crossing). It costs no sessions and moves nothing; it is a way to read more about the island he chose.
- **He sees.** A "Day trip" button under the postcard. For example, Fossil Bay: "The old quarry is a place where rock was cut out of the ground. The rock is limestone. Limestone is made of the shells of tiny sea animals, pressed together over a very long time. Dr. Bell shows you a shell in the quarry wall."
- **School goal.** Main idea: each day-trip text is short enough for "What is this mostly about?" in a check-up.
- **Subtasks for story incorporation.**
  - [ ] `daytrip: string[]` on the stop entries in `content/journey.json` (four texts) and on the `Stop` type.
  - [ ] A second page in `PostcardCard` in `journey.tsx` with read-aloud; no map or art change.
  - [ ] One "What do you think?" line in `features.ts` (`day-trip`, met when a day trip is opened).
  - [ ] A hand reading-level pass; the facts checked by DW.
  - [ ] An e2e check that the button appears only on reached islands, with axe.
  - [ ] DW reads every line.
- **Guards.** Never a reward for scores and never timed; it is simply there once the island is reached. Keep each text under 60 words.

## LTF-27 The way home: back by a different island

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20.

**Fixed 2026-10-28.** Way-home postcards show the picture of the island each one revisits (back-cloud shows Cloud Hill's airfield). Their image is labelled with the stop's own name, not "A picture of undefined". Tests: e2e (a first visit to Fossil Bay on the way home: its picture and day trip; seen failing first).

- **What was built (2026-10-13).** After Opening Day, the sanctuary card offers the way home ("Fly home" or "Stay at the sanctuary"; staying keeps the offer open). Flying home is a second trip with its own legs at the journey's pace: Cloud Hill, then a choice of the islands he skipped on the way out (up to three, best match for his interests first, so a second visit is impossible), then Gull Island and Home Island, where the postcard ends "You are home. Your island has a new piece from every place you visited." While on the way home, his island view follows him (the new island gets its quest and spots to build), the map draws the way home in purple with the new island's marker, and the postcards list includes the trip's stops. A pace change keeps his place. `npm run check` checks the way home has five beats a stop, real places, and all four themed islands to choose from. Tests: unit (the offer, Cloud Hill, only unvisited islands, each leg's arrival, the island view, pace; mutation-checked) and an e2e run from the offer to choosing Fossil Bay, with axe. The text (`home` in `content/journey.json`) was drafted for this build, since the proposal only outlined it: seven legs, each with a new setback (fog at Cloud Hill, the Fossil Bay pier crane, Turtle Beach closed for hatching, the Star Point dome motor, the Rail Coast lift bridge, a flat bike tire on Gull Island, the Home Island ramp under repair). Two facts were corrected before merging: red light bothers turtles less than white light (not "does not bother"), and patch glue dries in minutes. For DW to read: every line, and these additions to the canon: a crane on the Fossil Bay pier, a river lift bridge past Shell Halt, an old pier by the Home Island lighthouse, and Captain Ada sailing back to Cloud Hill from Gull Island rather than going home with him.

- **Story.** After the last koala is met, the sanctuary card offers a flight home with Captain Ada: Cloud Hill, then a fork to one of the islands he did not visit, then Gull Island and Home Island. The return legs reuse each island's host and places with new, shorter beats (a return visit has a different setback from the outward one), so the three unvisited islands' content is reached without a second journey. "Stay with the koalas" is always available, and the koalas stay visitable.
- **He sees.** On the sanctuary card: "Captain Ada says the Kookaburra can fly you home. On the way, you can visit one more island." Then a fork with the islands he has not seen, and four legs home. Postcard at Home Island: "You are home. Your island has a new piece from every place you visited."
- **School goal.** None directly; it reuses the islands' goals.
- **Subtasks for story incorporation.**
  - [ ] Return-leg beats for each island (five beats, one setback) and a Home Island arrival postcard in `content/journey.json`.
  - [ ] Engine: a second route segment after `australia` in `journeyPosition`, saved like the outward choice; nothing resets for a learner at the sanctuary.
  - [ ] Map: the return path drawn in a second color; the sanctuary card gains the offer.
  - [ ] Checks: the LTF-20 reachability check extended to "every return route ends at Home Island"; a hand reading-level pass.
  - [ ] Tests: engine test for the return segment and for the stay-with-koalas case; an e2e run of the home fork with axe.
  - [ ] DW reads every line.
- **Guards.** Decide first whether the journey should have an end (Australia) or keep going; this item only makes sense if DW wants the latter. Island souvenirs from the return trip are the same pieces, so a second visit to the same island must not be possible.

## LTF-28 Letters between islands

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20; also closes the airfield beat 1 seam from LTF-21.

- **What was built (2026-10-13).** The Cloud Hill beat now comes as a letter from the host of the island he sailed from, with the boat time and one fact that links to another island: Dr. Bell on Mari's nautilus shell, Mari on Fossil Bay's limestone, Dr. Amal on the weather balloon's numbers that Mari uses, Mr. Haddad on the station clock's radio time signal from Star Point. Windy Cape keeps Bus 9. A unit test checks each origin's letter. For DW to check: the four facts.

- **Story.** The airfield's beat 1 today says "Bus 9 goes from Windy Cape to Cloud Hill", which is wrong for a sea route. Replace it with a per-origin letter from the island's host that quietly links to another island, so the world feels joined and a later return trip (LTF-27) has a reason. The links are true: Dr. Bell writes that Mari on Reef Island has a nautilus shell, a living animal with a coiled shell like the ammonite's; Mr. Haddad writes that the station clock is set by a radio time signal from the observatory at Star Point; Dr. Amal writes that the weather balloon's numbers go to the weather station on Reef Island too; Mari writes that the turtle beach sand came from the same reef that made Fossil Bay's limestone long ago.
- **He sees.** At the airfield, beat 1 is "A letter came from Dr. Bell. It says: Captain Ada's boat will take you to the shore below Cloud Hill. Mari at Reef Island has a nautilus shell. It is a living animal with a coiled shell, like the ammonite." The Windy Cape origin keeps Bus 9.
- **School goal.** Key details: each letter holds one travel detail (how he gets to Cloud Hill) and one fact.
- **Subtasks for story incorporation.**
  - [ ] A `byFrom` map on the airfield's beat 1 in `content/journey.json` (keys `cape`, `fossil`, `reef`, `star`, `rail`) and a one-line lookup in `shownBeat` in `journey.tsx` using the stop he came from.
  - [ ] Checks: a hand reading-level pass; DW checks the four facts.
  - [ ] Tests: a unit test that `shownBeat` picks the letter for the origin and falls back to the plain text.
  - [ ] DW reads every line.
- **Guards.** "Living animal with a coiled shell like the ammonite's" is literal; avoid "cousin". The nautilus lives in deep water by reefs, so Mari has a shell, not a tank.

## LTF-29 Epilogue at Bluegum: a week with Ranger Tess

Proposed 2026-10-13. Replaced by the koala keeper arc (LTF-30), approved by DW 2026-10-13. Builds on LTF-20. If LTF-30 (the koala keeper arc) is approved, it replaces this item: this week becomes its first stop, LTF-31.

- **Story.** After all eight koalas are met, instead of only "you can visit them any time", one last short leg: a week helping Ranger Tess at the sanctuary. The setback is a broken pump in the tree nursery, with the part coming on Thursday. It gives the journey a quiet ending and one last souvenir for the island.
- **He sees.** Beat 0: "Ranger Tess asks for help this week. The sanctuary is planting new eucalyptus trees." Beat 1: "Koalas eat only some kinds of eucalyptus leaves, so the nursery grows those kinds." Beat 2 (`broken`, message from Ranger Tess: "The nursery pump is broken." / "The new part comes on Thursday." / "Until then, the young trees need water by hand."), cope "When something breaks, we can fix it. It just takes time, and there is a job we can do now.", ask "What will you do until Thursday?", Plan A "Carry water to the young trees" → beat 3 "You carried water every morning. On Thursday the part came, and the pump ran again." Plan B "Help count the joeys for the ranger's chart" → beat 3 "You counted three joeys for the chart. On Thursday the part came, and the pump ran again." Beat 4: "The young trees are green and tall enough to plant. One more session, and planting day comes." Postcard: "On planting day, you dig a hole and set a young eucalyptus tree in it." / "Ranger Tess says it will take years to grow tall." / "One day, a koala will sleep in it." / "Gumnut watches from the next tree." / "He is awake this time." Souvenir: `sapling`, "Eucalyptus sapling" (topic `nature`, stop `australia`).
- **School goal.** Staying flexible when plans change.
- **Subtasks for story incorporation.**
  - [ ] An `epilogue` leg on the Australia stop in `content/journey.json` (five beats, message, cope, choice, talk, smooth, postcard, souvenir), shown after `allMet`.
  - [ ] Engine: `journeyPosition` returns an epilogue step after the koalas; `BeatCard` shows it in place of the sanctuary card.
  - [ ] Souvenir piece `sapling` in `apps/web/src/art.tsx`; no new map stop.
  - [ ] Checks: a hand reading-level pass; `npm run check`.
  - [ ] Tests: an engine test that the epilogue starts only after the last koala and never moves him back; an e2e run through the epilogue with axe.
  - [ ] DW reads every line.
- **Guards.** The eucalyptus fact matches the koala facts already in `journey.json` (Kip: "the right kinds of eucalyptus trees"). Gumnut was asleep in the arrival postcard, so "awake this time" is a deliberate small change, not a contradiction. Joeys are counted on a chart, never handled.

## Proposed: the koala keeper arc (LTF-30 to LTF-35)

Added 2026-10-13, drafted by a story-ideation pass at DW's request ("continue the journey from Australia to becoming a keeper of koalas, so the koalas are taken care of and many people can enjoy them"). Approved by DW 2026-10-13. The arc continues after the eighth koala is met: Ranger Tess asks for help at Bluegum Koala Sanctuary, and five legs follow. It replaces LTF-29 (its week with Ranger Tess becomes the first stop) and comes before LTF-27 (the way home, if still wanted, is offered after Opening Day). It says "koala keeper at the sanctuary", never "zoo keeper", because Bluegum is a sanctuary run by a ranger in today's canon. The vet was drafted as "Dr. Lin"; renamed Dr. Reyes here, since Mrs. Lin already runs the Lighthouse Café.

## LTF-30 Koala keeper arc at Bluegum (overview)

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20. Replaces LTF-29: its week with Ranger Tess becomes the first stop (LTF-31), with its beats and the `sapling` souvenir kept. Comes before LTF-27: if the way home is still wanted, its offer moves from the allMet card to the end of this arc, and "Stay with the koalas" becomes "Stay at the sanctuary". This answers LTF-27's open guard ("decide whether the journey should have an end"): the journey continues at the sanctuary.

**Fixed 2026-10-28.** The arc's postcard pictures are labelled with their own names, not "A picture of undefined". Tests: e2e (seen failing first).

- **What was built (2026-10-13).** `content/journey.json` has the arc under `arc` (about, five stops, done), transcribed word for word from LTF-31 to LTF-35 and checked against this backlog. After the eighth koala, the story is the arc: `journeyNow` gives the arc's next stop, beat and leg step in place of the journey's, at the journey's pace, while he stays at Bluegum (so his island and check-ups stay Australia's). Each arc stop is reached after a leg, with its postcard scene and souvenir (sapling, keeper's scale, vet's bag, viewing path, koala sign); after Opening Day, a closing card says he is a junior koala keeper and nothing more moves. A pace change mid-arc keeps his place (`repace`), and a learner who had met all eight koalas before the arc existed starts it at its first beat (`arcStart`, once). The map has a Bluegum Koala Sanctuary panel with the five stops (the landmass is too small for markers, the fallback this item named), and the postcards list includes reached arc stops. `npm run check` checks the arc is one line of stops with five beats each. "What do you think?" asks about it once (activity `arc`). Tests: unit (Sunny first, then beat 0; each arrival; done; the start for all-met learners; pace changes, mutation-checked; every souvenir drawn) and an e2e run to the Tree Nursery's postcard, with axe. LTF-34's Guards said the postcard introduces Omar as "a visitor", but the approved line did not; DW chose 2026-10-13 to introduce him there ("A visitor, Omar, comes in his wheelchair and sees Matilda in a tree.").

- **Story.** After the eighth koala is met, Ranger Tess asks for help at Bluegum Koala Sanctuary. Five legs follow: planting food trees, learning the keeper's morning round, the vet's check-up day, building a new koala home with a viewing path and signs, and opening day, when a school group and other visitors come. The arc is about caring for the koalas and sharing them with many people; the learner becomes a junior koala keeper at the sanctuary.
- **He sees.** Stops in order: The Tree Nursery (LTF-31), Junior Keeper Day (LTF-32), The Vet Clinic (LTF-33), The New Koala Home (LTF-34), Opening Day (LTF-35). Start: after he meets Sunny, the eighth koala, the sanctuary card shows the allMet line exactly as now. His next finished session shows beat 0 of the first leg ("On the way to The Tree Nursery") in place of the sanctuary card, with the usual leg dots. Sessions: five legs at the journey pace, so 25 sessions at five a leg (15 at three, 35 at seven), after the eight koala sessions. End: the Opening Day postcard and souvenir, then a closing sanctuary card: "You are a junior koala keeper at Bluegum. The koalas and the visitors are glad you came. You can visit them any time." Finished sessions after that move nothing, as today after allMet, until LTF-27 or a later arc.
- **School goal.** All three across the arc: staying flexible when plans change (LTF-31, LTF-33, LTF-35), key details (LTF-32, LTF-35), main idea (LTF-34).
- **Subtasks for story incorporation.** Shared work, done once for the arc:
  - [ ] `content/journey.json`: a new top-level `arc` object: `arc.about`, `arc.stops` (five entries with the same fields as today's stops: `id`, `name`, `emoji`, `souvenir`, `next`, `beats`, `postcard`; the last has no `next`) and `arc.done` (the closing line above). Keep `stops`, `koalas` and `allMet` unchanged. A separate list means `ROUTE_LENGTH`, the LTF-20 fork code and the routes check do not change; appending to `stops` would make every loop over `JOURNEY.stops` arc-aware. Update the top-level `about` line to say the arc follows the koalas.
  - [ ] `packages/schema/routes.mjs` (or `validate.mjs`): an arc chain check: every `arc.stops[i].next` names the following arc stop, the chain is linear, and the last has none. Every arc stop with a `souvenir` must resolve in `pieceById` (an e2e or unit check, since the pieces live in the web app).
  - [ ] Engine, `packages/engine/src/index.ts`: `journeyPosition` stays as it is for the way to Australia. A new `arcPosition(after, koalas, arcStops, legLength, anchor)` runs `journeyPosition` again on the sessions after the koala meetings (`after - koalas`, with stop 0 = Australia), as LTF-27 proposed for a second segment. `journeyNow` in `journey.tsx` returns the koala only while `after < koalas.length`, and the arc stop and beat once `after >= koalas.length`. Keep `arrived: true` throughout, so nothing that reads it (the map bubble, Session.tsx's `koalaMet`) changes meaning.
  - [ ] Anchor: a pace change in the arc must never move him back or ahead. `JourneyAnchor` gains the arc position (for example `arc?: { at, stop, step }`), and the pace-change handler in `apps/web/src/Adult.tsx` saves it the same way it saves the outward position. A learner who already has `after >= 8` when this ships is anchored once on load at the start of the arc, so his next session shows beat 0, like the fork wait: no jump ahead, no reset.
  - [ ] Engine tests: `after = 7` still meets Sunny and `after = 8` is arc stop 0 beat 0; `after = 8 + legLength` arrives at The Tree Nursery; `after = 8 + 5 * legLength` arrives at Opening Day; later sessions stay there with `done: true`; a pace change mid-arc keeps his stop and step; the "already all met" learner starts at beat 0; `routePosition` and `pastFork` are unchanged before Australia.
  - [ ] `apps/web/src/journey.tsx`: `BeatCard` shows the arc beat instead of the sanctuary card once the arc has begun, and the closing card after Opening Day. `reachedStops` and the postcards include reached arc stops. Map: five small markers on the Australian landmass joined by a short path from the Australia marker, keyed by stop id; an arc-aware bubble line ("You are at Bluegum, on the way to The Tree Nursery."); `StopArt` scenes for the five stops. If the landmass is too crowded, a Bluegum inset panel is the fallback.
  - [ ] `apps/web/src/art.tsx`: five souvenir pieces with `stop` set (`sapling`, `scale`, `vetbag`, `viewpath`, `koalasign`).
  - [ ] `apps/web/src/features.ts`: one "What do you think?" line, `keeper-arc`, "The story goes on at the sanctuary. You help Ranger Tess as a junior koala keeper.", met by an activity event logged once when the first arc beat is shown.
  - [ ] Checks: `npm run check` (with the arc chain check), `npm test`, and a hand reading-level pass over every arc line (level 1 to 2 band, sentences of 13 words or fewer); beats and postcards are outside `pipeline/check.py`.
  - [ ] e2e: seed a learner at the sanctuary who has met seven koalas, finish a session and check "On the way to The Tree Nursery"; run to the first setback, choose a plan, read the postcard and pick the sapling; open the map with arc markers; axe check on each screen.
  - [ ] DW reads every line of LTF-31 to LTF-35.
- **Guards.** The learner never holds a koala: Ranger Tess and the vet handle koalas, for care only. No sick, hurt or lost animals; the clinic day is a check-up and Banjo is well throughout. Visitors look from the path, speak softly and never touch or feed a koala. Facts come from the koala facts already in `journey.json` plus a few simple true ones: keepers cut fresh branches every day, weigh koalas on a scale with a branch, rake under the trees, plant food trees, vets check eyes, ears and teeth, and koalas drink more on hot days. "Koala keeper", never "zoo". Captain Ada and the Kookaburra stay in Australia and are not contradicted (LTF-27 needs her there). Every setback is an everyday problem with nobody blamed. No new obstacle kinds: the five setbacks reuse `broken`, `weather` and `blocked`.

## LTF-31 The Tree Nursery: planting food trees

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20 and LTF-30. Replaces LTF-29: its beats, pump setback, postcard and `sapling` souvenir are kept, with one plan option changed (see Guards).

- **Status (2026-10-13).** Built under LTF-30 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene and souvenir; check-up flights at Bluegum use Australia's texts. Still open: DW's read of every line.

- **Story.** Ranger Tess asks for help this week: Bluegum is planting new eucalyptus trees so the koalas always have the right leaves to eat. The setback is the broken nursery pump, with the new part coming on Thursday, so the young trees get water by hand. The postcard is planting day, and the souvenir is a eucalyptus sapling.
- **He sees.**
  - Beat 0: "Ranger Tess asks for your help this week. The sanctuary is planting new eucalyptus trees. Koalas need the right trees to eat."
  - Beat 1: "Koalas eat only some kinds of eucalyptus leaves. So the nursery grows just those kinds. A pump waters the young trees. It is very old." (smooth: without the last sentence)
  - Beat 2 (obstacle, `broken`): "The nursery pump stopped working this morning. Ranger Tess has ordered a new part. Until it comes, the young trees need water by hand." Notice (type `message`, app text, from "Ranger Tess"): "The nursery pump is broken." / "The new part comes on Thursday." / "Until then, the young trees need water by hand." Cope: "When something breaks, we can fix it. It takes time, and there is a job we can do now." Ask: "What will you do until Thursday?" Plan A "Carry water to the young trees" (reply "Good plan. Two cans each morning is enough.") → beat 3: "You carried water every morning. On Thursday the part came, and the pump ran again." Plan B "Cut fresh leaves for the koalas" (reply "Good plan. Keepers cut fresh branches every day.") → beat 3: "You cut fresh branches every day with Ranger Tess. On Thursday the part came, and the pump ran again." Talk: "Ask: the pump broke, and the plan changed. What job did he do instead?" Smooth: "The pump hums, and the young trees are wet and green."
  - Beat 3 (base text, shown if no plan was chosen): "The pump is running again. Ranger Tess checks every young tree." (smooth: "The young trees have grown. Some are as tall as you.")
  - Beat 4: "The young trees are tall enough to plant. One more session, and planting day comes."
  - Postcard: "On planting day, you dig a hole for a young eucalyptus tree." / "Ranger Tess says it will take years to grow tall." / "One day, a koala will sleep in it." / "Gumnut watches from the next tree." / "He is awake this time."
  - Souvenir: `sapling`, "Eucalyptus sapling" (topic `nature`, stop `nursery`).
- **School goal.** Staying flexible when plans change: the pump plan fails, and both plans accept the wait with a useful job.
- **Subtasks for story incorporation.**
  - [ ] Arc stop entry in `content/journey.json`: id `nursery`, name "The Tree Nursery", emoji 🌱, `souvenir: "sapling"`, `next: ["keeper"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Engine: covered by the shared LTF-30 work; this stop is the first arc leg, so the "arc starts at beat 0 after Sunny" test names it.
  - [ ] Map and art: a marker on the landmass and a `StopArt` scene (rows of young trees in pots, a water tank, a pump). Souvenir piece `sapling` in `apps/web/src/art.tsx` with `stop: 'nursery'`.
  - [ ] "What do you think?" line: covered by the shared `keeper-arc` line in LTF-30.
  - [ ] Checks: `npm run check`; a hand reading-level pass (level 1 to 2 band, 13 words or fewer a sentence).
  - [ ] Tests: engine arrival at this stop after `8 + legLength` sessions past Australia; the e2e run in LTF-30 with an axe check.
  - [ ] DW reads every line: beats, message rows, cope, both options and their after lines, talk, smooth texts, postcard and souvenir name.
- **Guards.** The eucalyptus fact matches Kip's ("the right kinds of eucalyptus trees"). Gumnut was asleep in the arrival postcard, so "awake this time" is a deliberate small change (from LTF-29). LTF-29's option "count the joeys for the ranger's chart" is replaced by cutting fresh leaves, a real daily keeper job, so no one counts joeys in pouches. The trees get water by hand the same day, so there is no water-shortage worry. Nobody is blamed for the old pump.

## LTF-32 Junior Keeper Day: the morning round

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20 and LTF-30. Comes after LTF-31 and before LTF-27.

- **Status (2026-10-13).** Built under LTF-30 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene and souvenir; check-up flights at Bluegum use Australia's texts. Still open: DW's read of every line.

- **Story.** Ranger Tess teaches the keeper's morning round from a chart with four jobs: weigh each koala, clean under the trees, fresh leaves, water. The setback is a very hot day: the koalas rest in the shade, so weighing moves to 7 AM the next day, when it is cool. The postcard is the first full round done alone, and the souvenir is a keeper's scale.
- **He sees.**
  - Beat 0: "Ranger Tess has a plan for you. Next week, you learn the keeper's morning round. There are four jobs on the chart."
  - Beat 1: "Job one: weigh each koala. Job two: clean the ground under the trees. Job three: fresh leaves. Job four: water. The weather report says a hot day is coming." (smooth: without the last sentence)
  - Beat 2 (obstacle, `weather`): "Today is very hot. The koalas rest in the shade and hold the cool tree trunks. Ranger Tess moves the weighing to 7 AM tomorrow, when it is cool." Notice (type `notice`, title "Bluegum Keeper Board", icon ☀️): "Hot day. Koalas rest in the shade." / "Weighing moves to 7 AM tomorrow." / "Put out extra water bowls today." Cope: "Hot days pass. The koalas rest to stay cool. We can change the plan too." Ask: "What will you do on the hot day?" Plan A "Put out extra water bowls" (reply "Good plan. Koalas drink more on hot days.") → beat 3: "You put out water bowls in the shade. The next morning was cool. At 7 AM, you weighed every koala." Plan B "Fill in the chart in the shade" (reply "Good plan. The chart has a row for each koala.") → beat 3: "You wrote each koala's name on the chart. The next morning was cool. At 7 AM, you weighed every koala." Talk: "Ask: the hot day changed the keeper's plan. What did they do instead, and when?" Smooth: "Today is warm and calm. The koalas rest in the shade."
  - Beat 3 (base text): "Every koala's weight is on the chart now. Ranger Tess says the numbers look good." (smooth: "You weighed every koala. The numbers are on the chart.")
  - Beat 4: "Wattle's joey is in her pouch, so Wattle weighs a little more. Tomorrow you do the whole round by yourself, with Ranger Tess close by. One more session, and it is Junior Keeper Day."
  - Postcard: "On Junior Keeper Day, you do the morning round." / "You weigh Pip. He climbs onto the branch on the scale." / "You rake under the trees and hang fresh branches." / "Koalas sleep most of the day, so the round is quiet." / "Ranger Tess writes your name on the keeper's chart."
  - Souvenir: `scale`, "Keeper's scale" (topic `animals`, stop `keeper`).
- **School goal.** Key details: the Keeper Board has three rows, and only the 7 AM row decides when weighing happens; the four-job chart is the same skill in a list.
- **Subtasks for story incorporation.**
  - [ ] Arc stop entry in `content/journey.json`: id `keeper`, name "Junior Keeper Day", emoji 📋, `souvenir: "scale"`, `next: ["clinic"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Engine: covered by LTF-30.
  - [ ] Map and art: a marker and a `StopArt` scene (a scale with a branch perch, a rake, a chart on a board). Souvenir piece `scale` with `stop: 'keeper'`.
  - [ ] "What do you think?" line: covered by LTF-30.
  - [ ] Checks: `npm run check`; a hand reading-level pass.
  - [ ] Tests: engine arrival after `8 + 2 * legLength`; an e2e pass through the hot-day notice and a plan, with an axe check.
  - [ ] DW reads every line.
- **Guards.** "Hot day" is stated plainly with no temperature number and no danger word; koalas resting in shade and holding cool trunks is what they do. "Koalas drink more on hot days" sits beside Gumnut's fact that they do not drink much; both are true. The learner weighs Pip by watching him climb onto the branch; Ranger Tess is beside him, and he never lifts a koala. Cleaning is "rake the ground", nothing more. Wattle's joey stays in the pouch and is never handled; the weight note matches Wattle's facts.

## LTF-33 The Vet Clinic: check-up day

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20 and LTF-30. Comes after LTF-32 and before LTF-27.

- **Status (2026-10-13).** Built under LTF-30 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene and souvenir; check-up flights at Bluegum use Australia's texts. Still open: DW's read of every line.

- **Story.** Every koala at Bluegum gets a check-up with Dr. Reyes, the vet (new character). This week it is Banjo's turn, and the learner rides along with Ranger Tess. The setback is a closed road: workers are fixing the main road to town, so they take River Road or Dr. Reyes comes to the sanctuary in her van. The souvenir is a vet's bag.
- **He sees.**
  - Beat 0: "Every koala at Bluegum gets a check-up with the vet. The vet is Dr. Reyes. Her clinic is in town."
  - Beat 1: "This week it is Banjo's turn. Ranger Tess puts fresh leaves in his travel box. The clinic is a short drive away. There are roadworks on the main road this week." (smooth: without the last sentence)
  - Beat 2 (obstacle, `blocked`): "The truck reached the main road, but the road is closed. Workers are fixing the road today. The check-up is at 10 AM." Notice (type `notice`, title "Main Road", icon 🚧): "ROAD CLOSED today." / "Workers are fixing the road." / "Use River Road to town." Cope: "When a road is closed, there is another way. The check-up can still happen today." Ask: "How will Banjo get his check-up?" Plan A "Take River Road with Ranger Tess" (reply "Good plan. River Road is longer, but it is open.") → beat 3: "You took River Road. It was longer, but you reached the clinic by 10 AM. Dr. Reyes was ready." Plan B "Ask Dr. Reyes to come to the sanctuary" (reply "Good plan. Dr. Reyes has a van with all she needs.") → beat 3: "Dr. Reyes came in her van. She did Banjo's check-up under his own tree." Talk: "Ask: the road was closed, so they found another way. Which plan would you pick, and why?" Smooth: "The truck takes the main road to town. Banjo is asleep in his travel box."
  - Beat 3 (base text): "Dr. Reyes checks Banjo's eyes, ears and teeth. Banjo is well." (smooth: "Dr. Reyes is ready for Banjo at 10 AM.")
  - Beat 4: "Dr. Reyes asks you to spend a whole day at the clinic. You will see how a vet works. One more session, and you reach the clinic."
  - Postcard: "At the clinic, Dr. Reyes shows you her tools." / "A small light is for looking in ears and eyes." / "Koalas chew tough leaves, so the vet checks their teeth." / "Keepers and vets work as a team to keep koalas well." / "On Banjo's chart, Dr. Reyes writes: Banjo is well."
  - Souvenir: `vetbag`, "Vet's bag" (topic `animals`, stop `clinic`).
- **School goal.** Staying flexible when plans change: the road is closed, and both plans still give Banjo his check-up that day.
- **Subtasks for story incorporation.**
  - [ ] Arc stop entry in `content/journey.json`: id `clinic`, name "The Vet Clinic", emoji 🩺, `souvenir: "vetbag"`, `next: ["habitat"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Engine: covered by LTF-30.
  - [ ] Map and art: a marker and a `StopArt` scene (a small white clinic, a van, a gum tree). Souvenir piece `vetbag` with `stop: 'clinic'`.
  - [ ] "What do you think?" line: covered by LTF-30.
  - [ ] Checks: `npm run check`; a hand reading-level pass.
  - [ ] Tests: engine arrival after `8 + 3 * legLength`; an e2e pass through the road notice and a plan, with an axe check.
  - [ ] DW reads every line.
- **Guards.** A check-up only: Banjo is well before, during and after, with no illness, injections or "hurt". Dr. Reyes is the only new character (not "Dr. Lin", which would clash with Mrs. Lin of the Lighthouse Café). Ranger Tess carries the travel box, which holds fresh leaves; the learner never holds Banjo. "Workers are fixing the road" states the closure without a danger word, like Windy Cape's fallen rocks. Facts are simple and true: vets check eyes, ears, teeth and weight; koala teeth wear from chewing tough leaves, so vets check them. Beat 4 works for both plans, since the clinic day is a visit to learn, not Banjo's appointment.

## LTF-34 The New Koala Home: a path for everyone

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20 and LTF-30. Comes after LTF-33 and before LTF-27.

- **Status (2026-10-13).** Built under LTF-30 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene and souvenir; check-up flights at Bluegum use Australia's texts. Still open: DW's read of every line.

- **Story.** Bluegum builds a new koala home: more trees, a shade roof, and a viewing path with a ramp so a visitor in a wheelchair can see the koalas too, with signs along it that teach. The setback is a delivery truck that broke down: the boards for the ramp come on Friday, so the signs and the trees come first. The souvenir is the viewing path.
- **He sees.**
  - Beat 0: "Bluegum is building a new koala home. It will have more trees and a shade roof. A viewing path will go around it."
  - Beat 1: "Ranger Tess shows you the plan. The path has a ramp, so a wheelchair can use it. Signs along the path will teach about koalas. The boards for the ramp come by truck." (smooth: without the last sentence)
  - Beat 2 (obstacle, `broken`): "The delivery truck broke down on the highway. The boards for the ramp are still on it. The driver says a new truck brings them on Friday." Notice (type `message`, app text, from "Bluegum Timber"): "Our truck broke down today." / "Your boards are safe on it." / "A new truck brings them on Friday." Cope: "When something breaks, the plan waits a few days. There are other jobs to do first." Ask: "What will you do until Friday?" Plan A "Paint the signs for the path" (reply "Good plan. Each sign says one thing about koalas.") → beat 3: "You painted four signs. On Friday the boards came, and the ramp was built." Plan B "Plant the new trees first" (reply "Good plan. The trees need to go in before the path.") → beat 3: "You planted six trees with Ranger Tess. On Friday the boards came, and the ramp was built." Talk: "Ask: the boards were late, so they did other jobs first. What else could they have done?" Smooth: "The boards for the ramp came today. Ranger Tess counts them."
  - Beat 3 (base text): "The ramp is built. Omar, a visitor, tests it in his wheelchair, and it works well." (smooth: "The ramp is built. The path goes all the way around.")
  - Beat 4: "The signs are up along the path. Each sign tells one thing about koalas. One more session, and the new koala home is ready."
  - Postcard: "The new koala home has tall trees and a shade roof." / "A viewing path with a ramp goes all the way around." / "A visitor, Omar, comes in his wheelchair and sees Matilda in a tree." (DW 2026-10-13: Omar is introduced here, so every learner meets him) / "The signs say: Koalas sleep most of the day. Please speak softly." / "Ranger Tess says, \"Now many people can see the koalas.\""
  - Souvenir: `viewpath`, "Viewing path" (topic `nature`, stop `habitat`).
- **School goal.** Main idea: each sign along the path says one main thing about koalas, so a sign is a main idea in one sentence; plan A has him paint them.
- **Subtasks for story incorporation.**
  - [ ] Arc stop entry in `content/journey.json`: id `habitat`, name "The New Koala Home", emoji 🌳, `souvenir: "viewpath"`, `next: ["opening"]`, five beats with notice, cope, choice, talk and smooth texts, and the postcard.
  - [ ] Engine: covered by LTF-30.
  - [ ] Map and art: a marker and a `StopArt` scene (gum trees, a shade roof, a looping path with a ramp, one sign). Souvenir piece `viewpath` with `stop: 'habitat'`.
  - [ ] "What do you think?" line: covered by LTF-30.
  - [ ] Checks: `npm run check`; a hand reading-level pass.
  - [ ] Tests: engine arrival after `8 + 4 * legLength`; an e2e pass through the truck message and a plan, with an axe check.
  - [ ] DW reads every line.
- **Guards.** "Broke down" is a flat everyday truck problem; nobody is hurt and the boards are safe, which the message says. Omar is a visitor who uses a wheelchair, named and ordinary; the ramp is for him and for everyone, and nobody "helps" him. "Wheelchair" is used as a plain word. The sign line asks visitors to speak softly, and nobody touches a koala. The sign facts match Banjo's (sleep most of the day). Where beat 3's base text was not shown, the postcard introduces Omar as "a visitor".

## LTF-35 Opening Day: visitors come

Proposed 2026-10-13. Approved by DW 2026-10-13. Builds on LTF-20 and LTF-30. Comes after LTF-34; it is the arc's end, and LTF-27's offer (if approved) follows it.

- **Status (2026-10-13).** Built under LTF-30 (see its "What was built"): the text below is in `content/journey.json` as approved, with its scene and souvenir; check-up flights at Bluegum use Australia's texts. Still open: DW's read of every line.

- **Story.** The new koala home opens on Saturday, with a school group of 24 children, Omar and his family, and other visitors; the learner tells the children one koala fact he has practiced. The setback is a changed weather report: rain on Saturday morning, so the welcome talk moves under the big tent or into the shed. The postcard is opening day itself, and the souvenir is a koala sign.
- **He sees.**
  - Beat 0: "The new koala home opens on Saturday. Ranger Tess asks you to help on the day. A school group is coming."
  - Beat 1: "The posters are up in town. The school group has 24 children and two teachers. You will tell them one koala fact. The weather report says rain may come on Saturday." (smooth: without the last sentence)
  - Beat 2 (obstacle, `weather`): "The weather report changed. Rain will come on Saturday morning. The welcome talk was going to be on the grass." Notice (type `notice`, title "Weather Report", icon 🌧️): "Saturday morning: rain." / "Saturday afternoon: sun." / "Bring a raincoat." Cope: "Rain does not stop opening day. We can move the talk to a dry place." Ask: "Where will the welcome talk be?" Plan A "Put up the big tent on the grass" (reply "Good plan. The tent is in the shed, and it is dry inside.") → beat 3: "The tent went up on Friday. On Saturday, the visitors stayed dry under the tent for the talk." Plan B "Move the talk into the big shed" (reply "Good plan. The shed has room for the whole school group.") → beat 3: "You set out chairs in the shed on Friday. On Saturday, the talk was dry and warm inside." Talk: "Ask: rain was coming on opening day. How did they change the plan?" Smooth: "The weather report says Saturday will be sunny. The talk will be on the grass."
  - Beat 3 (base text): "The talk has a dry place now. You practice your koala fact three times." (smooth: "You practice your koala fact three times. Ranger Tess listens.")
  - Beat 4: "Everything is ready: the path, the signs and the chairs. One more session, and it is Opening Day."
  - Postcard: "On Opening Day, the rain stops at noon, and the sun comes out." / "The school group walks the path and reads every sign." / "Omar is back, and he shows a family the ramp." / "You say your fact: koalas sleep most of the day." / "Ranger Tess says, \"You are a junior koala keeper now.\""
  - Closing card after the postcard (`arc.done`): "You are a junior koala keeper at Bluegum. The koalas and the visitors are glad you came. You can visit them any time."
  - Souvenir: `koalasign`, "Koala sign" (topic `animals`, stop `opening`).
- **School goal.** Key details: the weather report's rows hold one time that decides the plan (Saturday morning), and the school group's size (24 children, two teachers) decides the chairs in plan B.
- **Subtasks for story incorporation.**
  - [ ] Arc stop entry in `content/journey.json`: id `opening`, name "Opening Day", emoji 🎉, `souvenir: "koalasign"`, no `next` (the arc's end), five beats with notice, cope, choice, talk and smooth texts, and the postcard; `arc.done` with the closing line.
  - [ ] Engine: covered by LTF-30; this stop is where `done: true` holds for every later session.
  - [ ] `apps/web/src/journey.tsx`: the closing card in `BeatCard` when the arc is done; if LTF-27 is approved, its "fly home" offer sits on this card instead of the allMet card.
  - [ ] Map and art: a marker and a `StopArt` scene (a gate with a banner, people on the path, a tent). Souvenir piece `koalasign` with `stop: 'opening'`.
  - [ ] "What do you think?" line: covered by LTF-30.
  - [ ] Checks: `npm run check`; a hand reading-level pass.
  - [ ] Tests: engine arrival after `8 + 5 * legLength` and that later sessions stay here; an e2e pass through the weather report, a plan, the postcard, the sign and the closing card, with an axe check.
  - [ ] DW reads every line.
- **Guards.** Rain is weather, not a storm; nobody is cold or wet, and the report itself promises afternoon sun. Visitors read the signs and stay on the path; nobody touches or feeds a koala. The school is "a school group" with no name, so no real or canon school is implied. The learner's talk is one sentence he practiced three times, so the social moment is planned and small. "Junior koala keeper", never zoo keeper. The postcard's weather matches the report and works for both plans.

## LTF-19 Guest codes for friends and classmates

Added 2026-10-13. Requested by DW: "a way for me as an operator/parent to send login codes to friends/classmates can try without a microsoft invite." Approach to confirm. DW 2026-10-13: not now.

- **Research.** None needed: this is an access feature, not a teaching one. It follows the plan's privacy rules (Safety, privacy and accessibility), so nothing about a guest child leaves their device.
- **Why not the live site.** Static Web Apps grants a role only after a sign-in with an identity provider. Invitations are capped at 25 on both plans. Assigning roles with a function needs the Standard plan and still needs a sign-in. A code on its own cannot open the family site.
- **Proposed: a guest edition at its own address.** A second Free-plan Static Web App, built from this repo with a guest flag. It has no cloud copy and no `/api`, so it never reaches the family's data, and a guest's progress stays on their own device. A `/guest/` path on the same site is possible, but it would share the family site's origin, storage and service worker, so a separate address is cleaner.
- **Codes.** The grown-ups' area on the family site gains a Guest codes section: a label (for example "Sam's family"), an expiry, and a code to share as a link or a QR code. The family API signs each code with a private key kept in app settings. The guest edition checks the signature and the expiry in the browser with the matching public key.
- **What a guest sees.** An "Enter your code" screen on first open. After that comes the normal set-up: a grown-up sets a nickname, then the child picks a guide and interests and takes the scouting trip.
- **What the gate is and is not.** It keeps the guest edition among people you gave a code to. It is not strong access control: the guest edition's files are public, and someone determined can get past a browser check. That is acceptable because the guest edition holds no personal data and the content is CC BY-SA.
- **Revoking.** Codes expire. Revoking one early means adding its id to a revoked list in the guest build and redeploying. Rotating the key ends every code at once.
- **Privacy.** Nothing about a guest child leaves their device. The family site stores only your label, the expiry and the code id. Codes go to the friend's parent, not to the child. The privacy review planned for gate 2 should cover the guest edition.
- **Alternative with a real lock.** On the Standard plan, a custom sign-in through Microsoft Entra External ID could let a parent sign in with an emailed one-time passcode and no Microsoft account. That locks every file and could give guests a cloud copy. It costs money, collects the parent's email address and is more to run. Not checked end to end.
- **Build.** An edition flag in `apps/web/vite.config.ts`. `apps/web/src/cloud.ts` and the Data tab skip the cloud in the guest edition. A new `apps/web/src/Guest.tsx` code screen. A signing endpoint in `api/src` for the family role, with the key in app settings. A guest `staticwebapp.config.json` with anonymous routes. A second deploy job in `.github/workflows/deploy.yml`.
- **Eval first.** Unit tests: a good code passes, and an expired, tampered or revoked code fails. e2e: with a valid code the guest edition reaches onboarding, without one it stays on the code screen, and the guest build makes no `/api` calls.
- **Failure modes.** A code is forwarded widely: guard with expiry, a label per code, and key rotation. A guest clears their browser and loses progress: the code screen says so. The guest edition drifts from the main app: guard by building both from the same code, differing only by the flag.

## LTF-01 Show the clue straight away on a new skill's first item

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Kim et al. 2025](https://journals.sagepub.com/doi/10.1177/10883576241267963), where time delay was the only significant moderator in technology-aided reading. Plan rule R17.

- **What was built.** As below. A skill counts as new when he has no answers on it yet. The setting is on by default. The Hint wait card counts first-time guided answers only. Tests: `delayEffect` in `activity.test.ts`, and an e2e test with a mocked clock.

- **He sees.** On the first Together item of a skill he has never practised, the clue lights up at once. From the second item on, it waits the usual 8 seconds. Your turn does not change.
- **Grown-ups see.** A switch in Learning settings, and a Hint wait card in Activity once there are 20 answers.
- **Build.** The timed-hint effect in `apps/web/src/ItemView.tsx` takes a zero-delay flag, and `Session.tsx` sets it for the first Together item of a new skill. AnswerEvent gains `delay`. `delayEffect(events)` goes in `packages/engine/src/activity.ts`, and the card in `Adult.tsx`.
- **Eval first.** An engine test runs `delayEffect` on a fixed log. An e2e test checks the clue appears at 0 seconds on item 1 and at 8 seconds on item 2.
- **Guards.** Only the first item, and only while the skill is new. Counts sit next to percentages.
- **DW's note.** "Let's ensure these features are on novel corpus please." Measure it only on items he has not seen: the repeats tracking (step 1) marks first-time answers, and the Hint wait card counts only those.

## LTF-02 A reasoning card for feelings questions

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Wang & Poon 2026](https://link.springer.com/article/10.1007/s10803-025-07148-5) (think-alouds, an organizer and error correction; gains of 40 to 56 percentage points at ages 10 to 11). Plan rule R24, extending R3 and R14.

- **What was built.** New content, not retrofits: 10 N5 passages with 23 items (n5-i174 to n5-i196) and 5 P2 passages with 12 items (p2-i87 to p2-i98), 29 of them with a card. All are inside their reading bands. The second hint shows Clue and What I know. "So" stays a question ("What does that tell you?") until the answer is shown, so the last step of the thinking is his. The N5 worked example fills the card box by box (model steps take `fill`). `packages/schema/reason.mjs` holds the rule, `npm run check` runs it, and `reason.test.ts` tests it. Answers record `card` when he saw one. The single-case record is a card in Activity: his N5 right-first-time on first-time answers, before and after he first saw a card. The content guide has a section on writing reasons. One open item: the content checks show 3 new coherence warnings on these passages, which read as false alarms and are left for DW to review.

- **He sees.** On N5 and P2 items, the second hint is a three-box card: Clue, What I know, So. The N5 worked example in Watch fills in the same card.
- **Build.** Item gains `reason: {clue, know, so}`. New N5 and P2 items are written with reasons. `ItemView.tsx` shows a ReasonCard at hint level 2. The content guide explains how to write a reason.
- **Eval first.** Validation requires a reason on every new N5 and P2 inference-2 item and checks that each clue is a sentence in the passage. The single-case record tracks his N5 first-try accuracy.
- **Guards.** At most 12 words a box, read aloud. The card is a hint and is never scored.
- **DW's note.** "Same corpus as item 1." Write new N5 and P2 items for the card rather than retrofitting ones he has seen, and measure on first-time answers only.

## LTF-03 Who's who: tap "she" to see who it means

Added 2026-10-13. Approved. Built 2026-10-13, N4 first.

- **What was built.** All 54 N4 passages with sentences have `refs` (659 pronouns), drafted and then checked: `npm run check` confirms each points at a pronoun that is there and names someone or something in the passage (`packages/schema/refs.mjs`), and the drafts agree with the referent named by every one of the 31 existing N4 pronoun questions. 23 pronouns were left out: one truly ambiguous, the rest meaning several people that no single phrase names, "it" with nothing to point to, or people in general. Dotted pronouns show a "she = Priya" card when tapped, in N4 guided practice and, outside N4, in level 1 and 2 texts that have refs; never in N4's own practice or warm-up, or the Peak check; after N4 is mastered, or with the setting "On Help only", only after Help. The pronoun a question asks about never gets a dot. The "Who's who help" setting is in Learning settings, and taps are logged (`who-help`). Tappable words are now at least 24px wide (WCAG 2.2 target size), which also helps the older tap-a-word items. Then the level 1 and 2 stories outside N4: 108 passages, 710 refs (38 pronouns left out for the same reasons, and 4 more dropped on review as uncertain). "Names instead of he and she in the easiest texts" (a Learning setting, off by default) shows and reads level 1 texts with names in place of the pronouns their refs know ("Maya took Maya's flute"), telling a possessive "her" from an object "her", never inside quoted speech, and never in N4. When the "Who did it?" stop finds sentence grammar low, the Overview now points to this setting. Unit tests cover the rewriting, and an e2e test turns it on.

Research: [Courteau et al. 2026](https://link.springer.com/article/10.1007/s11145-026-10824-2); [O'Connor & Klein 2004](https://link.springer.com/article/10.1023/B:JADD.0000022603.44077.6b); [Jozwik & O'Quin 2026](https://eric.ed.gov/?id=EJ1512266). Plan rules R5 and R22.

- **He sees.** Dotted pronouns during Together on N4 and in stories at levels 1 and 2. Tapping one shows "she = Priya". Once N4 is mastered, the dots appear only when he presses Help. They never show in N4 Your turn or the Peak check.
- **Grown-ups see.** A "Who's who help" setting (auto, on Help only, off), and "Names instead of he/she at level 1".
- **Build.** Passage gains `refs`. The pipeline drafts refs and a person reviews them. The display goes in `Passage.tsx`, and the settings in `db.ts` and `Adult.tsx`.
- **Eval first.** Validation checks that each ref names someone or something in the passage. An e2e test taps a pronoun. His N4 trend shows whether it helps.
- **Guards.** Off in N4 Your turn and the Peak check. Outside N4, only at levels 1 and 2. Annotate N4 passages first.

## LTF-04 Word help

Added 2026-10-13. Approved. Pilot size confirmed by DW 2026-10-13: about 60 level 3 to 5 passages first, so his taps and the warm-up word results show whether to gloss the rest. Built 2026-10-13.

- **What was built.** 58 passages across F2 to F6 and N1 to N6 (picked by script, levels 3 to 5) have 170 glossed words, each with a plain meaning and a picture, drafted and then checked: every word is in its passage (`packages/schema/glossary.mjs`, in `npm run check`), and every meaning reads easier than its word (`pipeline/check.py`: no word in the meaning longer than the glossed word or two syllables). Underlined words show a card with the meaning and read-aloud; word help is off whenever the text itself is tapped to answer. The warm-up can open with a word for today: a glossed word from one of today's texts, or one he tapped before, with three meanings to choose from. It is logged as activity, never as a skill answer. The Activity tab shows the words he taps most and how the word for today goes. Every meaning still needs DW's review in the Content library. Research: [Intepe et al. 2025](https://eric.ed.gov/?id=EJ1475591); [Kritsotakis & Morfidi 2025](https://journals.sagepub.com/doi/full/10.1177/23969415251371544). Plan rules R23 and R22, putting R1's "teach vocabulary inside lessons" into the app.

- **He sees.** Up to three underlined words in level 3 to 5 texts. Tapping one shows a picture, a plain meaning and a speaker button. Some warm-ups start with a word from today's text.
- **Grown-ups see.** The words he taps most, which come back in later warm-ups.
- **Build.** Passage gains `words: [{word, means, pic}]`. `pipeline/check.py` checks that each meaning reads easier than its word. `Passage.tsx` shows the card, the engine adds a warm-up word item, and a word-help activity event is logged.
- **Eval first.** Every glossed word appears in its passage, and the pipeline check passes.
- **Guards.** Three words a passage at most. A person reviews every meaning.

## LTF-05 Today asks "What happened after?"

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Yang et al. 2026 (AUTIVERSE)](https://arxiv.org/abs/2509.17466), where consequences and feelings mostly came only when asked. Plan rule R20.

- **What was built.** New tiles, not reused ones: 11 for after something hard and 10 for after what he did, in `content/today.json` under `after`. The question order and the sentence builder moved to `apps/web/src/recount.ts`, with unit tests in `recount.test.ts`. RecountEvent records `after`. The journey stops are still open, and LTF-20 covers them.
- **He sees.** After something hard, "What happened after that?" with tiles. It is also asked after "What did you do?", at every stage since LTF-58 (it was from stage 2). His story gains a sentence like "After that, I tried again."
- **Grown-ups see.** The prompt card uses his answer.
- **Build.** An `after` tile list in `content/today.json`, a question and sentence in `Today.tsx`, and RecountEvent records whether "after" was answered.
- **Eval first.** A unit test on the sentence builder, and an e2e recount that includes something hard.
- **Guards.** Skip stays. (Until 2026-10-26, stage 1 asked it only after something hard; see LTF-58.)
- **DW's note.** "Novel content for these changes. Perhaps an expanded island route list as our corpus gets larger." Write new tiles for "after" rather than reusing the "hard" list. Open: add journey stops to `content/journey.json` (ten since LTF-20) as the content bank grows.

## LTF-06 His day as a four-panel strip

Added 2026-10-13. Approved. Built 2026-10-13. Needs LTF-05. Research: [Yang et al. 2026 (AUTIVERSE)](https://arxiv.org/abs/2509.17466); [Lee, Quinn & Jiang 2025](https://link.springer.com/article/10.1007/s10803-025-07014-4). Plan rules R20 and R27.

- **What was built.** Day recounts show one strip per part of the day, in his order: Before (who he was with), What happened (what he did, and anything hard), After, and How I felt. Tapping a box asks only that box's questions again, then comes straight back. Play it aloud lights up each box as it is read. Skipped questions are now counted from his final answers, so a changed answer is not counted twice. RecountEvent records `changed`, which also tells the "What do you think?" card that he has seen the strip. Show recounts keep their sentence list. Still to do: check the plain panels with him, as the guard asks.

- **He sees.** The "Here is what you told me" screen shows four panels: Before, What happened, After and How I felt. Tapping a panel changes it. Play it aloud reads one panel at a time.
- **Build.** A Strip component in `Today.tsx`, with styles from the existing tokens.
- **Eval first.** An e2e test with axe on the built screen. He gives his view through LTF-18.
- **Guards.** Plain panels, checked with him first. A skipped panel shows quietly as "skipped".

## LTF-07 Ideas behind a button as the tiles fade

Added 2026-10-13. Approved. Built 2026-10-13. Research: [McWilliams & Hanson 2025](https://link.springer.com/article/10.1007/s40616-025-00218-w); [Petersen et al. 2014](https://pubs.asha.org/doi/10.1044/2013_LSHSS-12-0099). Plan rule R28, checking R16's "fade slowly".

- **What was built.** Day recounts only; show recounts keep their tiles. Each question shows a starter that his words finish ("In Math, I ...") and a Next button. "No" or "nothing" to the hard question counts as nothing was hard. RecountEvent records `ideas`, one entry per answered question. The step-back rule (`ideasUse` in `activity.ts`): once he has had the button for two weeks, if he has at least three recounts in the last two weeks and opened the ideas on every question in all of them, Today steps back a stage; one answer in his own words keeps it where it is. It moves on again by itself when that stops being true, which can be just old recounts ageing out (a question for DW in the 2026-10-28 audit). A stage set by a grown-up in Settings is never changed. The card is in the Today recounts tab.

- **He sees.** From stage 3, a sentence starter and a big "Show me ideas" button. The tiles appear only if he taps it. Nothing times him.
- **Grown-ups see.** "Answered without ideas: 2 of 5 this week." If he taps Show me ideas on every question for two weeks, Today steps back a stage.
- **Build.** `Today.tsx` hides the tiles behind the button. RecountEvent records whether ideas were used on each question. `activity.ts` gets a summary and the step-back rule, and `Adult.tsx` a card.
- **Eval first.** Engine tests for the summary and the step-back rule, and an e2e run at stage 3.

## LTF-08 How his telling is growing

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Harvey et al. 2025](https://journals.sagepub.com/doi/10.1177/01427237251315253), where length explained most of the gap in narrative structure. Plan rule R28.

- **What was built.** The card leads the Today recounts tab. RecountEvent also gains `after`. Recounts saved before this have no sentence count, so the card leaves them out. The card compares his first five recounts with his last five, or fewer each while he has fewer than ten.

- **Grown-ups see.** A Today card: sentences per recount over time, parts of the day told, the questions he skips most, and how often he adds his own words.
- **Build.** RecountEvent gains `sentences` and `skipped`. `recountTrend(events)` goes in `activity.ts`, and the card in `Adult.tsx`.
- **Eval first.** An engine unit test on a fixed log.
- **Guards.** Length always sits next to the parts he told, never on its own.

## LTF-09 "Knows" or "only thinks"?

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Eilon & Novogrodsky 2025](https://link.springer.com/article/10.1007/s10803-025-06895-9). Plan rule R22.

- **What was built.** 6 new N5 passages and 16 items (n5-i197 to n5-i212), 5 of them sorts (n5-i197, i201, i205, i208, i212; "6" until the 2026-10-28 audit) with two bins and at most four cards. `npm run check` enforces that guard. All 18 false-belief items now also carry `know-think` (there were 18, not 12, after the content tripled). The miss-pattern column in Skills calls it "knows or only thinks", and an engine test covers the report. The N5 brief in the content guide is updated.

- **He sees.** New N5 sort and tap items that set knowing against thinking, for example "Leo knows" and "Leo only thinks".
- **Build.** About 16 new N5 items tagged `know-think`, the 12 false-belief items retagged, and the N5 brief updated.
- **Eval first.** Content validation, the reading-level check, and the error-pattern report showing know-think.
- **Guards.** Two bins and at most four cards.

## LTF-10 "Some", "only" and "all" in signs and steps

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Petit et al. 2026](https://eric.ed.gov/?id=EJ1517530). Plan rule R25.

- **What was built.** 8 new functional passages and 22 items tagged `quantifier`: F2 quiz directions and a rover kit, F4 a pool pass and a trail-mix label, F5 a book sale notice and a club form, F6 a delete-photos prompt and a pond skating notice. All are real signs, labels, forms and steps.

- **He sees.** Functional items where one small word changes what he can do: "Some lanes are closed today", "Answer any two", "Only for ages 12 and up".
- **Build.** About 18 items tagged `quantifier` across F2, F4, F5 and F6.
- **Eval first.** Content validation and the error-pattern report.
- **Guards.** Real-life signs and steps only, never word puzzles.

## LTF-11 Metaphor map

Added 2026-10-13. Approved. Built 2026-10-13.

- **What was built.** Three new story-map kinds (`like`, `share`, `means`). 10 new N6 stories, each with two metaphors: one with the three-box map (10 items, tag `metaphor-map`) and one new, untaught metaphor asked as a plain question and marked as a transfer item (10 items, tag `metaphor-new`). The Activity tab compares the two on first-time answers. The lexical coherence check flags most metaphor sentences, since a metaphor brings in a new picture word; these are expected warnings.

Research: [Skogli-Christensen et al. 2025](https://www.mdpi.com/2076-328X/15/11/1556); [Wei et al. 2025](https://link.springer.com/article/10.1007/s10803-025-07142-x); [Hu et al. 2025](https://eric.ed.gov/?id=EJ1479439). Plan rule R25.

- **He sees.** A three-box map for a metaphor: "Her voice is like…", "What do they share?" and "So her voice was…". Idioms are handled by word help (LTF-04) and come back in review.
- **Build.** Three new story-map slot kinds (`like`, `share`, `means`) in the schema and `ItemView.tsx`, and about 20 N6 metaphor items, some marked as transfer items.
- **Eval first.** Transfer items with untaught metaphors show whether it carries over.
- **Guards.** Start with 20 items, and let his transfer results decide whether to add more.

## LTF-12 Understand the message, then act on it

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Prahl et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12452825), where comprehension rose but replying did not. Plan rule R26.

- **What was built.** 10 new F5 messages, each with a message item (tag `message`) and an act item (tag `act`, with `after` naming its message item): 20 items, two at each level. Act steps pick the reply that matches the plan, or tap what to do in a scene. `pickItems` serves the pair together, the act step right after, and never an act step on its own. A list can run one item over rather than split a pair. `npm run check` checks every pair. The Overview card "Messages: understanding and acting" shows the two lines on first-time answers.

- **He sees.** F5 messages get a second step: pick the reply that matches the plan, or act it out.
- **Grown-ups see.** Two lines for F5: "Understood the message" and "Did the right thing".
- **Build.** About 20 two-step F5 items tagged `act`. `tagAccuracy` already works per tag. Two lines in `Adult.tsx`.
- **Eval first.** Validation pairs each act item with its message item, and a report test runs on a fixed log.
- **Guards.** The second step keeps the same message on screen.
- **Audit 2026-10-28.** "Understood the message" counts every `message`-tagged item: 18, 8 of them with no act step (F2 2, N4 1, F5 5). So its two lines are not measured on matched pairs.

## LTF-13 A "Who did it?" stop in scouting

Added 2026-10-13. Approved. Built 2026-10-13. Research: [O'Leary et al. 2026](https://ifp.nyu.edu/2026/journal-article-abstracts/1471-3802-70094/); [Herrero-Roig et al. 2026](https://link.springer.com/article/10.1007/s11145-026-10864-8). Plan rule R22.

- **What was built.** Three sets of six sentences in `content/placement.json`, each with one active, two passives, a subject relative, an object relative and a pronoun item. `grammarSet` picks the next set, so a second run uses sentences he has not seen. The stop comes after the listening story. "Stop scouting for now" and "Finish later" still work. Starting point has a "Run the Who did it? stop" button that keeps his starting steps and earlier scores, because placement only ever adds mastered steps. Below 75% (4 of 6 or fewer), the Overview suggests names in place of "he" and "she". The setting itself comes with LTF-03.

- **He sees.** A two-minute scouting stop of six one-sentence grammar items, answered by tapping a picture.
- **Grown-ups see.** Sentence grammar under Starting point. If it is low, the app suggests "Names instead of he/she" (LTF-03).
- **Build.** Grammar items in `content/placement.json`, the stop in `Onboarding.tsx`, `grammar` on PlacementEvent, and `placementSupports` can suggest names.
- **Eval first.** An engine test for `placementSupports`, and an e2e run of scouting.
- **Guards.** It can be finished later. Starting point can run this stop on its own.
- **DW's note.** "This needs expanded corpus." Write at least three sets of grammar items, so running scouting again uses sentences he has not seen.

## LTF-14 Check-up flight

Added 2026-10-13. Approved. Needs the repeats tracking. Built 2026-10-13 for the six stops of today's route, then the four LTF-20 islands.

- **What was built.** 120 reserved texts with one question each (`checkup: <stop>`), 12 per stop (home, gull, cape, fossil, reef, star, rail, airfield, takeoff, australia), in the same mix at every stop so check-ups stay comparable: six stories (N1, N2, N3, N5, N6, N6) and six functional texts (F2 to F6 and F3), four each at levels 2, 3 and 4. All pass validation, the reading bands and the content checks. Check-up texts are never served in practice, and `npm run check` keeps their passages apart from practice. `checkupDue` offers one on the Choose screen once he has finished ten sessions since the last; `planCheckup` draws three stories and three functional texts from the stop he is at, ones he has not seen first. Answers have phase `checkup`: they earn flight points but never change his skills or levels. The Overview shows the results over time and warns when his stop has fewer than six unseen texts left. The island stops' check-up texts were added with LTF-21 to LTF-24: fossil, reef, star and rail have 12 each. (Audit 2026-10-28: cu-home-p01, cu-gull-p01, cu-cape-p03 and cu-home-p05 raise new coherence warnings; they are warning-only.)

Research: [Masoumi et al. 2024](https://doi.org/10.47176/mjiri.38.118), where oral story gains did not carry over to reading. Plan rule R21, putting R12 into practice.

- **He sees.** About every ten finished sessions, an optional check-up flight: six new texts, no hints, and no right or wrong shown. It earns flight points like any session.
- **Grown-ups see.** Check-up results over time, kept apart from practice and from Today.
- **Build.** Reserved check-up items that are never used in practice. `planCheckup` in the engine. The Peak check flow in `Session.tsx`, reused. A `checkup` answer phase, and a chart in `Adult.tsx`.
- **Eval first.** Engine tests that check-up items never appear in practice and that each check-up draws from his current stop.
- **Guards.** Optional, calm wording, no score shown to him. The repeats tracker warns before a stop's pool runs out.
- **DW's note.** "ensure this is thematic to the island he is on." Tag reserved items with a journey stop id (home, gull, cape, airfield, takeoff, australia), about 12 per stop, and have `planCheckup` pick from the stop he is at.

## LTF-15 Which question types work for him

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Lee, Quinn & Jiang 2025](https://link.springer.com/article/10.1007/s10803-025-07014-4). Plan rule R27.

- **What was built.** `formatEffect` in `activity.ts` compares right-first-time by question type within one skill at one text level, on his own first-time answers (warm-up and your turn). The card is in the Activity tab, grouped by region. A printable paper story map (`apps/web/public/story-map.html`) follows the school's routine: who, where and when, the problem, three important things, how it ended, then what it was mostly about. It is linked from the grown-up card on the finish screen after story sessions. A new e2e test plays a whole Story Woods session through to the finish, the first test to cover that screen.

- **Grown-ups see.** First-try accuracy by question type in each region, and a "Print a paper story map" button in the grown-up section of the finish screen.
- **Build.** `formatEffect(progress)` in `activity.ts`, a card in `Adult.tsx`, and a printable story-map page.
- **Eval first.** An engine unit test.
- **Guards.** Compare only within the same skill and level.

## LTF-16 Coherence and skill checks for new content

Added 2026-10-13. Approved. Built 2026-10-13, warning only: waiting for DW's gold-set ratings.

- **What was built.** `pipeline/coherence.py`, `pipeline/skillcheck.py` (inference level, school-goal tags, near-duplicates) and `pipeline/content_check.py`, run by `npm run content:check` and in CI. Tests in `pipeline/test_checks.py`. Today's 328 flags are recorded in `pipeline/baseline.json`, so only new problems can ever block.
- **Gold set.** `evals/gold/gold.py pick` chose 30 passages and 60 items (seed 2026; `gold-set.json`). DW rates them blind in `evals/gold/rate.html` (it shows no checker output and no inference labels) and saves `evals/gold/ratings.json`. Then `python evals/gold/gold.py agree` writes `agreement.json`, and each check blocks new problems only once it reaches kappa 0.6 and precision 0.8 on at least 20 rated cases.
- **Tuning, without the gold set.** Near-duplicates: on held-out passages, reworded copies scored 0.48 to 1 and different texts at most 0.14, so the threshold is 0.5. It found one real pair: f5-p24 "Dad's Note About Pixel" rewords f2-p01 "Note on the Fridge". Coherence by shared words is weak on these short texts: the best variant caught 27% of sentences spliced in from other texts and flagged 23% of unchanged passages, so it will most likely stay warning-only; the gold ratings will judge any better checker (for example a model-based one) without re-rating.
- **Flags to review.** 59 items carry `key-detail` on questions that ask for a clue rather than which detail matters most (as the guide defines it), which inflates the key-details school goal. Also 36 problem-solving, 12 plan-change and 11 main-idea tag flags, and 37 inference labels two steps from the checker's reading (mostly sign items marked "stated" where the answer interprets the sign).
- **Audit 2026-10-28.**
  - The baseline's tag flags are key-detail 59, problem-solving 36, plan-change 12 and main-idea 11.
  - A run today gives 347 flags. 19 of them are new coherence flags from LTF-02, LTF-11 and LTF-14 content.
  - Reviewed the same day, sentence by sentence: all 19 are false positives. Each flagged sentence follows naturally from the one before, as a character arriving ("Ben got on at the next stop."), a scene detail, the next line of dialogue, or a metaphor ("The room was a quiet cave."). They were added with `content_check.py --baseline`, so 347 flags are now known and none are new. The six "Does it fit?" pairs (LTF-59) raised none.
  - The gold ratings (`evals/gold/ratings.json`) do not exist yet, so every check still only warns.

Original entry: Research: [Maheshwary et al. 2026](https://aclanthology.org/2026.readi-1.10/); [Ma, Flor & Wang 2025](https://aclanthology.org/2025.bea-1.31/); [Shen et al. 2026](https://aclanthology.org/2026.bea-1.51/). Plan rule R19.

- **Build.** `pipeline/coherence.py` flags sentence pairs that share no people or things. `pipeline/skillcheck.py` checks each item's inference level and tags, and flags near-duplicate passages, so a new passage is not an old one reworded. `content:check` runs all three checks, and CI fails on new problems.
- **Eval first.** DW rates a gold set of 30 passages and 60 items by hand. The checks must agree with those ratings before they can block a merge, and the gold set is never used for tuning.
- **Guards.** Skip short and visual passages, as `check.py` already does.
- **DW's note.** "Let's ensure we are adding tracking for corpus used so he doesnt see the same content as the same user." That is the repeats tracking below, moved to step 1. The near-duplicate check covers the same need across the bank.

## LTF-17 A scoring test set for typed answers

Added 2026-10-13. Approved. Built 2026-10-13, waiting for two people to score it.

- **What was built.** `evals/scoring/scoring.py` chose 30 open questions with a fixed seed (`questions.json`): 10 "how did they feel, and why", 8 "why did...", 6 "what is it mostly about" and 6 "what should they do", at levels 1 to 5, each with what a full answer has. `answers.json` holds 300 invented answers written to sound like a child typing, 10 a question (4 written as right, 3 partly, 3 wrong, 2 of them borderline), with misspellings, copied sentences, the right idea about the wrong character, outside reasons, tangents and "idk". Two people score them blind in `evals/scoring/rate.html`, which never shows the band an answer was written to be, and save their files in `evals/scoring/ratings/`. `scoring.py agree` reports their agreement per band and overall (quadratic weighted kappa) and lists the answers they scored differently; `scoring.py check <scores.json>` judges a scorer, which passes only at 0.80 agreement in every band on the answers both people agree on, and reports separately how it does on the disputed ones. Tests in `pipeline/test_checks.py` (run in CI), mutation-checked. The model bake-off and the fine-tuned encoder come later, once the set is scored. Research: [Henkel et al. 2025](https://aclanthology.org/2025.aimecon-sessions.8/); [Gurin Schleifer et al. 2026](https://aclanthology.org/2026.bea-1.29/). Plan rule R18.

- **Build.** `evals/scoring/`: about 300 invented child-style answers, scored by two people and banded clearly right, partly right or clearly wrong. A pytest report gives agreement per band and on answers the two people scored differently. A fine-tuned small encoder joins the model bake-off.
- **Eval first.** The eval is the deliverable: 0.80 agreement in every band, not just overall.
- **Guards.** Invented answers only, never his real ones.
- **Note 2026-10-26, for the bake-off.** No scorer exists yet, so nothing changes now. When a scorer is tried, "unsure" (which sends a partly right answer to a structured follow-up, R18) should be defined from more than one signal: whether repeated runs agree, and how far the answer sits from clusters of similar answers. The model's own stated confidence was not reliable enough alone (Cong et al. 2026, preprint). Report how well each signal picks out the answers people scored differently.

## LTF-18 "What do you think?" cards

Added 2026-10-13. Approved. Built 2026-10-13. Research: [Johnson et al. 2026](https://journals.sagepub.com/doi/10.1177/13623613261460932). Plan rule R29, putting R13 into practice.

- **What was built.** Five features at first: telling about a show, skipping a demo, the flight kit, the clue at once and "What happened after that?". Step 3 added the thinking card, "Show me ideas" and the four-box strip. Each is asked about after he first uses it, not on the day it ships, so he has something to judge. The card sits on his island under the flight kit, with Read to me. Each new feature needs a line in `features.ts`. Grown-ups see the votes in the Overview tab. The e2e test also checks the card stays gone after a reload and on a second device.

- **He sees.** A one-time card on the island the first time a feature appears: I like it, not sure, I don't like it, then too much, just right, too little.
- **Grown-ups see.** His votes next to each feature.
- **Build.** `apps/web/src/features.ts` lists features with the date each arrived. A NewThing card in `ui.tsx`, an `opinion` activity event, and votes in `Adult.tsx`.
- **Eval first.** An e2e test that the card shows once per feature, on any device.
- **Guards.** At most one card a session, never mid-lesson.

## Check whether content repeats across sessions

Added 2026-10-12. Built 2026-10-13 (step 1 of the build order).

- **What was built.**
  - Every answer is read as first-time or repeat from the learner's shared event log, in time order, so his devices agree even when they sync late (`isRepeat` and `Progress.repeats` in `packages/engine/src/index.ts`). It is derived rather than stored on each answer, because a flag written by one device could be wrong once another device's older answers arrive.
  - `freshness()` in `packages/engine/src/fresh.ts` reports, per skill: his level, questions and texts he has not met yet at his level or easier, repeats this week and overall, and a status (plenty, running low below 10 new at his level or the next, or repeats now). It leaves out worked examples, inference checks, hidden items, check-up texts (fixed in the 2026-10-28 audit; they had been counted) and themes he is not shown, like item choice does.
  - The grown-ups' Activity tab has a Fresh content card, the Overview warns when a skill he is working on runs low, the report shows first-time answers per skill, and the school goals now count first-time answers only.
- **For the next features.** LTF-01, LTF-02, LTF-05 and LTF-16 measure themselves with `isRepeat` (first-time answers only), as DW's notes ask. (Audit 2026-10-28: overstated. LTF-01 and LTF-02 read `progress.repeats`; LTF-05 and LTF-16 have no repeat-based measure; `isRepeat` itself is used only in tests.)
- **Not changed.** Item choice already serves unseen questions first, and mastery still counts every independent answer. Counting only first-time answers toward mastery is a possible next change.

- **Research.** R12: the evidence is thin, so the program measures itself, and that measure is only fair on items he has not seen before ([Singh et al. 2021](https://link.springer.com/article/10.1007/s40489-020-00200-3); [Zhang et al. 2023](https://eric.ed.gov/?id=EJ1361852)).
Check whether the same items and passages come back in later sessions, and how often. Make this part of the reporting component (the grown-ups' area) and the progress tracker.

- **Where it stands.** `pickItems` in `packages/engine/src/index.ts` already serves unseen items first, then the least recently seen, using `Progress.seen`. So repeats should only happen once a skill's pool at that level runs out. Nothing reports when they do.
- **Why it matters.** A right answer on an item the learner has seen before may be memory, not comprehension. Mastery and the gate's "unseen passages" check both assume fresh items.
- **Reporting.** Per skill and level: how many items are left unseen, how many answers this week came from repeats, and when a pool is about to run out.
- **Progress tracker.** Mark each answer in the event log as first-time or repeat, so trends and mastery can be read with that in view.
- **Now step 1 of the build order.** DW's notes on LTF-01, LTF-02, LTF-05 and LTF-16 ask that new features run on content he has not seen. Track it per learner, not per device: `seen` comes from the learner's event log, which the cloud copy already shares across his devices.
