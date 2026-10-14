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
  { id: 'thinking-card', name: 'The thinking card', say: 'On some feelings questions, a hint card shows the clue and what people know.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'answer' && !!e.card) },
  { id: 'ideas-button', name: '"Show me ideas"', say: 'When you tell about your day, the ideas wait behind a button so you can try your own words first.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'recount' && !!e.ideas?.length) },
  { id: 'new-islands', name: 'A new island at each stop', say: 'Each place on your journey is an island to explore, with places that open as you read.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'world' && !!e.island && e.island !== 'home') },
  { id: 'island-route', name: 'Choosing your sea route', say: 'At Gull Island, you chose which island to sail to on the way to Australia.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'activity' && e.kind === 'route') },
  { id: 'checkup', name: 'The check-up flight', say: 'Every so often, you can choose six new texts with no hints, to see how your reading is growing.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'answer' && e.phase === 'checkup') },
  { id: 'whos-who', name: "Who's who", say: 'You can tap a dotted "he", "she" or "they" to see who it means.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'activity' && e.kind === 'who-help') },
  { id: 'word-help', name: 'Word help', say: 'In some stories, you can tap an underlined word to see what it means.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'activity' && e.kind === 'word-help') },
  { id: 'day-strip', name: 'Your day in four boxes', say: 'When you tell about your day, it shows as four boxes, and you can tap one to change it.', arrived: '2026-10-13',
    met: (es) => es.some((e) => e.type === 'recount' && e.changed !== undefined) },
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
