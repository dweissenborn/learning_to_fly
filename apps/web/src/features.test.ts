import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@wayfinder/schema';
import { FEATURES, nextFeature, opinions } from './features';

let n = 0;
const ev = (e: object) => ({ id: `f${++n}`, ts: 1_800_000_000_000 + n, ...e }) as LogEvent;
const showRecount = ev({ type: 'recount', stage: 1, parts: 1, topic: 'show' });
const vote = (feature: string, like: string, amount?: string) => ev({ type: 'activity', session: 'home', kind: 'opinion', feature, like, ...(amount ? { amount } : {}) });

describe('"What do you think?" cards (LTF-18)', () => {
  it('lists each feature once, with the date it arrived', () => {
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    expect(FEATURES.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.arrived))).toBe(true);
  });

  it('asks about a feature only after he has met it, and only until he has answered', () => {
    expect(nextFeature([])).toBeUndefined();
    expect(nextFeature([showRecount])?.id).toBe('show-recount');
    expect(nextFeature([showRecount, vote('show-recount', 'like', 'just-right')])).toBeUndefined();
  });

  it('keeps his latest answer per feature, for the grown-ups', () => {
    const o = opinions([vote('show-recount', 'unsure'), vote('show-recount', 'like', 'too-little')]);
    expect(o.get('show-recount')).toMatchObject({ like: 'like', amount: 'too-little' });
  });
});
