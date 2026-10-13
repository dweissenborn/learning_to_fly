// "What do you think?" cards (LTF-18): the new things he meets, and his vote on each. Votes are activity events,
// so "already asked" follows him to every device.
import type { LogEvent } from '@wayfinder/schema';
import { flightPoints, gearState } from '@wayfinder/engine';

export type Like = 'like' | 'unsure' | 'dislike';
export type Amount = 'too-much' | 'just-right' | 'too-little';
export const LIKE: [Like, string, string][] = [['like', '👍', 'I like it'], ['unsure', '🤔', 'Not sure'], ['dislike', '👎', "I don't like it"]];
export const AMOUNT: [Amount, string][] = [['too-much', 'Too much'], ['just-right', 'Just right'], ['too-little', 'Too little']];

export interface Feature { id: string; name: string; say: string; arrived: string; met: (events: readonly LogEvent[]) => boolean }
export const FEATURES: Feature[] = [
  { id: 'show-recount', name: 'Telling about a show', say: 'You can tell about a show or video you watched.', arrived: '2026-10-12',
    met: (es) => es.some((e) => e.type === 'recount' && e.topic === 'show') },
  { id: 'skip-demo', name: 'Skipping a demo', say: 'You can skip a demo when you already know how.', arrived: '2026-10-12',
    met: (es) => es.some((e) => e.type === 'activity' && e.kind === 'skip-demo') },
  { id: 'flight-kit', name: 'The flight kit', say: 'Your guide earns flight gear for the trip to Australia.', arrived: '2026-10-12',
    met: (es) => gearState(flightPoints(es)).owned.length > 0 },
  { id: 'clue-first', name: 'A clue straight away', say: 'On a new skill, the first clue comes straight away.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'answer' && e.delay === 0) },
  { id: 'after-that', name: '"What happened after that?"', say: 'When you tell about your day, I ask what happened after.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'recount' && !!e.after) },
];

/** His latest vote on each feature. */
export function opinions(events: readonly LogEvent[]) {
  const out = new Map<string, { like: Like; amount?: Amount; ts: number }>();
  for (const e of events) if (e.type === 'activity' && e.kind === 'opinion' && e.feature && e.like) out.set(e.feature, { like: e.like, amount: e.amount, ts: e.ts });
  return out;
}

/** The first feature he has met but not voted on yet. */
export function nextFeature(events: readonly LogEvent[]) {
  const voted = opinions(events);
  return FEATURES.find((f) => !voted.has(f.id) && f.met(events));
}
