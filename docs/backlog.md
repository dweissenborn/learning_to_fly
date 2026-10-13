# Backlog

Notes on work still to do. Newest first.

## Build order for the research features

Added 2026-10-13. All 18 proposals from the research review (LTF-01 to LTF-18) were approved. Guest codes (LTF-19) were added at DW's request. The mockups and the full case for each are on the review page in claude.ai. The research is in the project doc `claude/reading-research/2026-10-12.md`.

Each step lands its test before its code.

1. **Foundations.** "Check whether content repeats across sessions" (below), now needed by the notes on LTF-01, LTF-02, LTF-05 and LTF-16. Then LTF-16, so every new item after it passes the content checks. LTF-17 can run alongside.
2. **Small, strongest evidence.** LTF-01, LTF-05, LTF-08, LTF-18.
3. **Today and hints.** LTF-06 (after LTF-05), LTF-07, LTF-02, LTF-15.
4. **New questions.** LTF-09, LTF-10, LTF-12, LTF-13.
5. **Large content work.** LTF-04, LTF-11 (idioms use LTF-04), LTF-03, LTF-14.
6. **Guest codes.** LTF-19, a separate track. Approach to confirm.

## LTF-19 Guest codes for friends and classmates

Added 2026-10-13. Requested by DW: "a way for me as an operator/parent to send login codes to friends/classmates can try without a microsoft invite." Approach to confirm.

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

Added 2026-10-13. Approved. Research: Kim et al. 2025, where time delay was the only significant moderator in technology-aided reading. Proposed R17.

- **He sees.** On the first Together item of a skill he has never practised, the clue lights up at once. From the second item on, it waits the usual 8 seconds. Your turn does not change.
- **Grown-ups see.** A switch in Learning settings, and a Hint wait card in Activity once there are 20 answers.
- **Build.** The timed-hint effect in `apps/web/src/ItemView.tsx` takes a zero-delay flag, and `Session.tsx` sets it for the first Together item of a new skill. AnswerEvent gains `delay`. `delayEffect(events)` goes in `packages/engine/src/activity.ts`, and the card in `Adult.tsx`.
- **Eval first.** An engine test runs `delayEffect` on a fixed log. An e2e test checks the clue appears at 0 seconds on item 1 and at 8 seconds on item 2.
- **Guards.** Only the first item, and only while the skill is new. Counts sit next to percentages.
- **DW's note.** "Let's ensure these features are on novel corpus please." Measure it only on items he has not seen: the repeats tracking (step 1) marks first-time answers, and the Hint wait card counts only those.

## LTF-02 A reasoning card for feelings questions

Added 2026-10-13. Approved. Research: Wang & Poon 2026 (think-alouds, an organizer and error correction; gains of 40 to 56 percentage points at ages 10 to 11). Extends R3 and R14.

- **He sees.** On N5 and P2 items, the second hint is a three-box card: Clue, What I know, So. The N5 worked example in Watch fills in the same card.
- **Build.** Item gains `reason: {clue, know, so}`. New N5 and P2 items are written with reasons. `ItemView.tsx` shows a ReasonCard at hint level 2. The content guide explains how to write a reason.
- **Eval first.** Validation requires a reason on every new N5 and P2 inference-2 item and checks that each clue is a sentence in the passage. The single-case record tracks his N5 first-try accuracy.
- **Guards.** At most 12 words a box, read aloud. The card is a hint and is never scored.
- **DW's note.** "Same corpus as item 1." Write new N5 and P2 items for the card rather than retrofitting ones he has seen, and measure on first-time answers only.

## LTF-03 Who's who: tap "she" to see who it means

Added 2026-10-13. Approved. Research: Courteau et al. 2026; O'Connor & Klein 2004; Jozwik & O'Quin 2026. Extends R5, part of proposed R22.

- **He sees.** Dotted pronouns during Together on N4 and in stories at levels 1 and 2. Tapping one shows "she = Priya". Once N4 is mastered, the dots appear only when he presses Help. They never show in N4 Your turn or the Peak check.
- **Grown-ups see.** A "Who's who help" setting (auto, on Help only, off), and "Names instead of he/she at level 1".
- **Build.** Passage gains `refs`. The pipeline drafts refs and a person reviews them. The display goes in `Passage.tsx`, and the settings in `db.ts` and `Adult.tsx`.
- **Eval first.** Validation checks that each ref names someone or something in the passage. An e2e test taps a pronoun. His N4 trend shows whether it helps.
- **Guards.** Off in N4 Your turn and the Peak check. Outside N4, only at levels 1 and 2. Annotate N4 passages first.

## LTF-04 Word help

Added 2026-10-13. Approved. Research: Intepe et al. 2025; Kritsotakis & Morfidi 2025. Puts R1's "teach vocabulary inside lessons" into the app.

- **He sees.** Up to three underlined words in level 3 to 5 texts. Tapping one shows a picture, a plain meaning and a speaker button. Some warm-ups start with a word from today's text.
- **Grown-ups see.** The words he taps most, which come back in later warm-ups.
- **Build.** Passage gains `words: [{word, means, pic}]`. `pipeline/check.py` checks that each meaning reads easier than its word. `Passage.tsx` shows the card, the engine adds a warm-up word item, and a word-help activity event is logged.
- **Eval first.** Every glossed word appears in its passage, and the pipeline check passes.
- **Guards.** Three words a passage at most. A person reviews every meaning.

## LTF-05 Today asks "What happened after?"

Added 2026-10-13. Approved. Research: Yang et al. 2026 (AUTIVERSE), where consequences and feelings mostly came only when asked. Proposed R20.

- **He sees.** After something hard, "What happened after that?" with tiles. From stage 2 it is also asked after "What did you do?". His story gains a sentence like "After that, I tried again."
- **Grown-ups see.** The prompt card uses his answer.
- **Build.** An `after` tile list in `content/today.json`, a question and sentence in `Today.tsx`, and RecountEvent records whether "after" was answered.
- **Eval first.** A unit test on the sentence builder, and an e2e recount that includes something hard.
- **Guards.** At stage 1, asked only after something hard. Skip stays.
- **DW's note.** "Novel content for these changes. Perhaps an expanded island route list as our corpus gets larger." Write new tiles for "after" rather than reusing the "hard" list. Open: add journey stops to `content/journey.json` (six today) as the content bank grows.

## LTF-06 His day as a four-panel strip

Added 2026-10-13. Approved. Needs LTF-05. Research: AUTIVERSE 2026; Lee, Quinn & Jiang 2025.

- **He sees.** The "Here is what you told me" screen shows four panels: Before, What happened, After and How I felt. Tapping a panel changes it. Play it aloud reads one panel at a time.
- **Build.** A Strip component in `Today.tsx`, with styles from the existing tokens.
- **Eval first.** An e2e test with axe on the built screen. He gives his view through LTF-18.
- **Guards.** Plain panels, checked with him first. A skipped panel shows quietly as "skipped".

## LTF-07 Ideas behind a button as the tiles fade

Added 2026-10-13. Approved. Research: McWilliams & Hanson 2025; Petersen et al. 2014. Checks R16's "fade slowly".

- **He sees.** From stage 3, a sentence starter and a big "Show me ideas" button. The tiles appear only if he taps it. Nothing times him.
- **Grown-ups see.** "Answered without ideas: 2 of 5 this week." If he taps Show me ideas on every question for two weeks, Today steps back a stage.
- **Build.** `Today.tsx` hides the tiles behind the button. RecountEvent records whether ideas were used on each question. `activity.ts` gets a summary and the step-back rule, and `Adult.tsx` a card.
- **Eval first.** Engine tests for the summary and the step-back rule, and an e2e run at stage 3.

## LTF-08 How his telling is growing

Added 2026-10-13. Approved. Research: Harvey et al. 2025, where length explained most of the gap in narrative structure.

- **Grown-ups see.** A Today card: sentences per recount over time, parts of the day told, the questions he skips most, and how often he adds his own words.
- **Build.** RecountEvent gains `sentences` and `skipped`. `recountTrend(events)` goes in `activity.ts`, and the card in `Adult.tsx`.
- **Eval first.** An engine unit test on a fixed log.
- **Guards.** Length always sits next to the parts he told, never on its own.

## LTF-09 "Knows" or "only thinks"?

Added 2026-10-13. Approved. Research: Eilon & Novogrodsky 2025. Part of proposed R22.

- **He sees.** New N5 sort and tap items that set knowing against thinking, for example "Leo knows" and "Leo only thinks".
- **Build.** About 16 new N5 items tagged `know-think`, the 12 false-belief items retagged, and the N5 brief updated.
- **Eval first.** Content validation, the reading-level check, and the error-pattern report showing know-think.
- **Guards.** Two bins and at most four cards.

## LTF-10 "Some", "only" and "all" in signs and steps

Added 2026-10-13. Approved. Research: Petit et al. 2026.

- **He sees.** Functional items where one small word changes what he can do: "Some lanes are closed today", "Answer any two", "Only for ages 12 and up".
- **Build.** About 18 items tagged `quantifier` across F2, F4, F5 and F6.
- **Eval first.** Content validation and the error-pattern report.
- **Guards.** Real-life signs and steps only, never word puzzles.

## LTF-11 Metaphor map

Added 2026-10-13. Approved. Research: Skogli-Christensen et al. 2025; Wei et al. 2025; Hu et al. 2025.

- **He sees.** A three-box map for a metaphor: "Her voice is like…", "What do they share?" and "So her voice was…". Idioms are handled by word help (LTF-04) and come back in review.
- **Build.** Three new story-map slot kinds (`like`, `share`, `means`) in the schema and `ItemView.tsx`, and about 20 N6 metaphor items, some marked as transfer items.
- **Eval first.** Transfer items with untaught metaphors show whether it carries over.
- **Guards.** Start with 20 items, and let his transfer results decide whether to add more.

## LTF-12 Understand the message, then act on it

Added 2026-10-13. Approved. Research: Prahl et al. 2025, where comprehension rose but replying did not.

- **He sees.** F5 messages get a second step: pick the reply that matches the plan, or act it out.
- **Grown-ups see.** Two lines for F5: "Understood the message" and "Did the right thing".
- **Build.** About 20 two-step F5 items tagged `act`. `tagAccuracy` already works per tag. Two lines in `Adult.tsx`.
- **Eval first.** Validation pairs each act item with its message item, and a report test runs on a fixed log.
- **Guards.** The second step keeps the same message on screen.

## LTF-13 A "Who did it?" stop in scouting

Added 2026-10-13. Approved. Research: O'Leary et al. 2026; Herrero-Roig et al. 2026. Part of proposed R22.

- **He sees.** A two-minute scouting stop of six one-sentence grammar items, answered by tapping a picture.
- **Grown-ups see.** Sentence grammar under Starting point. If it is low, the app suggests "Names instead of he/she" (LTF-03).
- **Build.** Grammar items in `content/placement.json`, the stop in `Onboarding.tsx`, `grammar` on PlacementEvent, and `placementSupports` can suggest names.
- **Eval first.** An engine test for `placementSupports`, and an e2e run of scouting.
- **Guards.** It can be finished later. Starting point can run this stop on its own.
- **DW's note.** "This needs expanded corpus." Write at least three sets of grammar items, so running scouting again uses sentences he has not seen.

## LTF-14 Check-up flight

Added 2026-10-13. Approved. Needs the repeats tracking. Research: Masoumi et al. 2024, where oral story gains did not carry over to reading. Puts R12 into practice, proposed R21.

- **He sees.** About every ten finished sessions, an optional check-up flight: six new texts, no hints, and no right or wrong shown. It earns flight points like any session.
- **Grown-ups see.** Check-up results over time, kept apart from practice and from Today.
- **Build.** Reserved check-up items that are never used in practice. `planCheckup` in the engine. The Peak check flow in `Session.tsx`, reused. A `checkup` answer phase, and a chart in `Adult.tsx`.
- **Eval first.** Engine tests that check-up items never appear in practice and that each check-up draws from his current stop.
- **Guards.** Optional, calm wording, no score shown to him. The repeats tracker warns before a stop's pool runs out.
- **DW's note.** "ensure this is thematic to the island he is on." Tag reserved items with a journey stop id (home, gull, cape, airfield, takeoff, australia), about 12 per stop, and have `planCheckup` pick from the stop he is at.

## LTF-15 Which question types work for him

Added 2026-10-13. Approved. Research: Lee, Quinn & Jiang 2025.

- **Grown-ups see.** First-try accuracy by question type in each region, and a "Print a paper story map" button in the grown-up section of the finish screen.
- **Build.** `formatEffect(progress)` in `activity.ts`, a card in `Adult.tsx`, and a printable story-map page.
- **Eval first.** An engine unit test.
- **Guards.** Compare only within the same skill and level.

## LTF-16 Coherence and skill checks for new content

Added 2026-10-13. Approved. Research: Maheshwary et al. 2026; Ma, Flor & Wang 2025. Proposed R19.

- **Build.** `pipeline/coherence.py` flags sentence pairs that share no people or things. `pipeline/skillcheck.py` checks each item's inference level and tags, and flags near-duplicate passages, so a new passage is not an old one reworded. `content:check` runs all three checks, and CI fails on new problems.
- **Eval first.** DW rates a gold set of 30 passages and 60 items by hand. The checks must agree with those ratings before they can block a merge, and the gold set is never used for tuning.
- **Guards.** Skip short and visual passages, as `check.py` already does.
- **DW's note.** "Let's ensure we are adding tracking for corpus used so he doesnt see the same content as the same user." That is the repeats tracking below, moved to step 1. The near-duplicate check covers the same need across the bank.

## LTF-17 A scoring test set for typed answers

Added 2026-10-13. Approved. Research: Henkel et al. 2025; Gurin Schleifer et al. 2026. Proposed R18.

- **Build.** `evals/scoring/`: about 300 invented child-style answers, scored by two people and banded clearly right, partly right or clearly wrong. A pytest report gives agreement per band and on answers the two people scored differently. A fine-tuned small encoder joins the model bake-off.
- **Eval first.** The eval is the deliverable: 0.80 agreement in every band, not just overall.
- **Guards.** Invented answers only, never his real ones.

## LTF-18 "What do you think?" cards

Added 2026-10-13. Approved. Research: Johnson et al. 2026. Puts R13 into practice.

- **He sees.** A one-time card on the island the first time a feature appears: I like it, not sure, I don't like it, then too much, just right, too little.
- **Grown-ups see.** His votes next to each feature.
- **Build.** `apps/web/src/features.ts` lists features with the date each arrived. A NewThing card in `ui.tsx`, an `opinion` activity event, and votes in `Adult.tsx`.
- **Eval first.** An e2e test that the card shows once per feature, on any device.
- **Guards.** At most one card a session, never mid-lesson.

## Check whether content repeats across sessions

Added 2026-10-12.

Check whether the same items and passages come back in later sessions, and how often. Make this part of the reporting component (the grown-ups' area) and the progress tracker.

- **Where it stands.** `pickItems` in `packages/engine/src/index.ts` already serves unseen items first, then the least recently seen, using `Progress.seen`. So repeats should only happen once a skill's pool at that level runs out. Nothing reports when they do.
- **Why it matters.** A right answer on an item the learner has seen before may be memory, not comprehension. Mastery and the gate's "unseen passages" check both assume fresh items.
- **Reporting.** Per skill and level: how many items are left unseen, how many answers this week came from repeats, and when a pool is about to run out.
- **Progress tracker.** Mark each answer in the event log as first-time or repeat, so trends and mastery can be read with that in view.
- **Now step 1 of the build order.** DW's notes on LTF-01, LTF-02, LTF-05 and LTF-16 ask that new features run on content he has not seen. Track it per learner, not per device: `seen` comes from the learner's event log, which the cloud copy already shares across his devices.
