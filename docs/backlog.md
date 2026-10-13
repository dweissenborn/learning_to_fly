# Backlog

Notes on work still to do. Newest first.

## Check whether content repeats across sessions

Added 2026-10-12.

Check whether the same items and passages come back in later sessions, and how often. Make this part of the reporting component (the grown-ups' area) and the progress tracker.

- **Where it stands.** `pickItems` in `packages/engine/src/index.ts` already serves unseen items first, then the least recently seen, using `Progress.seen`. So repeats should only happen once a skill's pool at that level runs out. Nothing reports when they do.
- **Why it matters.** A right answer on an item the learner has seen before may be memory, not comprehension. Mastery and the gate's "unseen passages" check both assume fresh items.
- **Reporting.** Per skill and level: how many items are left unseen, how many answers this week came from repeats, and when a pool is about to run out.
- **Progress tracker.** Mark each answer in the event log as first-time or repeat, so trends and mastery can be read with that in view.
