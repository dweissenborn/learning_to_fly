import { describe, expect, it } from 'vitest';
import type { LogEvent, Passage, SkillBank } from '@wayfinder/schema';
import { buildPool, derive, isRepeat, tagAccuracy } from './index';
import { FRESH_LOW, freshness } from './fresh';

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 1, 16, 0).getTime();
let n = 0;
const id = () => `r${++n}`;
const answer = (ts: number, item: string, o: { phase?: string; correct?: boolean; skill?: string; session?: string } = {}): LogEvent =>
  ({ id: id(), ts, type: 'answer', session: o.session ?? 's', item, skill: o.skill ?? 'N1', phase: (o.phase ?? 'yourturn') as never, correct: o.correct ?? true, hint: 0, tries: 1, ms: 5000, format: 'tap' });

/** N1 with two level 1 texts (three questions each), one level 2 text, a worked example, a gatecheck item and a themed text. */
const passage = (pid: string, level: number, themes?: string[]): Passage => ({
  id: pid, title: pid, kind: 'story', sentences: ['A.'], topics: ['school'], level, socialLoad: 0, ...(themes ? { themes } : {}),
  credit: { title: pid, author: 'x', source: 'x', licence: 'original', retrieved: '2026-10-13', adapted: false },
} as Passage);
const item = (iid: string, pid: string, level: number, extra: object = {}) =>
  ({ id: iid, skill: 'N1' as const, passage: pid, format: 'tap' as const, level, prompt: '?', explain: '.', options: ['a', 'b'], answer: 0, ...extra });
const bank: SkillBank = {
  skill: 'N1',
  passages: [passage('pa', 1), passage('pb', 1), passage('pc', 2), passage('px', 1, ['loss'])],
  items: [
    item('m', 'pa', 1),
    item('a1', 'pa', 1, { tags: ['main-idea'] }), item('a2', 'pa', 1), item('a3', 'pa', 1),
    item('b1', 'pb', 1), item('b2', 'pb', 1), item('b3', 'pb', 1),
    item('c1', 'pc', 2), item('c2', 'pc', 2),
    item('g1', 'pb', 1, { gatecheck: true }),
    item('k1', 'pb', 1, { checkup: 'home' }), // a check-up question: item choice never serves it in practice
    item('x1', 'px', 1),
  ],
  model: { item: 'm', steps: [{ say: '1' }, { say: '2' }, { say: '3', reveal: true }] },
};
const pool = buildPool([bank]);

describe('repeats', () => {
  it('marks an answer as a repeat when he answered the same question before, in any phase', () => {
    const first = answer(T0, 'a1', { phase: 'placement' });
    const again = answer(T0 + DAY, 'a1', { phase: 'warmup' });
    const other = answer(T0 + DAY, 'a2');
    const p = derive([first, again, other]);
    expect([isRepeat(p, first), isRepeat(p, again), isRepeat(p, other)]).toEqual([false, true, false]);
  });

  it('reads the merged history in time order, so two devices that sync late still agree', () => {
    const early = answer(T0, 'b1'), late = answer(T0 + DAY, 'b1');
    const p = derive([late, early]); // the later answer arrived first
    expect(isRepeat(p, early)).toBe(false);
    expect(isRepeat(p, late)).toBe(true);
  });

  it('lets the school goals count first-time answers only', () => {
    const p = derive([answer(T0, 'a1', { correct: false }), answer(T0 + DAY, 'a1', { correct: true })]);
    expect(tagAccuracy(p, pool, 'main-idea')).toEqual({ correct: 1, total: 2 });
    expect(tagAccuracy(p, pool, 'main-idea', { firstTimeOnly: true })).toEqual({ correct: 0, total: 1 });
  });
});

describe('fresh content report', () => {
  const now = T0 + 10 * DAY;
  const row = (events: LogEvent[], o: { hidden?: Set<string>; allowThemes?: boolean } = {}) =>
    freshness(derive(events), pool, { now, ...o }).find((r) => r.skill === 'N1')!;

  it('counts questions and texts he has not met yet, up to his level, and leaves out demos, checks, check-ups, hidden and themed items', () => {
    const r = row([]);
    expect(r).toMatchObject({ level: 1, total: 6, unseen: 6, texts: 2, unseenTexts: 2 }); // a1-a3, b1-b3; not m, g1, k1, x1, or the level 2 text
    expect(row([], { allowThemes: true })).toMatchObject({ total: 7, texts: 3 });
    expect(row([], { hidden: new Set(['a3']) })).toMatchObject({ total: 5, unseen: 5 });
  });

  it('treats a text as met once any of its questions was answered, and counts this week\'s repeats', () => {
    // One wrong answer each side of a right one keeps him at level 1, so the counts stay on level 1 texts.
    const r = row([answer(now - 20 * DAY, 'a1', { correct: false }), answer(now - DAY, 'a1'), answer(now - DAY, 'b2', { correct: false })]);
    expect(r).toMatchObject({ unseen: 4, unseenTexts: 0, answersWeek: 2, repeatsWeek: 1, repeatsAll: 1, answersAll: 3 });
  });

  it('says when the pool is running low, and when he can only get repeats', () => {
    expect(FRESH_LOW).toBeGreaterThan(8);
    expect(row([]).status).toBe('low'); // 8 new questions at levels 1 and 2 in this tiny bank
    // Misses keep him at level 1, where every question has now been answered once.
    const all = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((i, k) => answer(T0 + k, i, { correct: false }));
    expect(row(all)).toMatchObject({ unseen: 0, status: 'repeating' });
  });
});
