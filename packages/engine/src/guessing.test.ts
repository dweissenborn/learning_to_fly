// LTF-38: clicking through to the green check. Points reward thinking, fast guesses are set aside, and gear is never lost.
import { describe, expect, it } from 'vitest';
import type { Item, LogEvent } from '@wayfinder/schema';
import { derive, flightPeak, flightPoints, gearState, GEAR, guessing, minReadMs, pointsFor } from './index';

let n = 0;
const ev = (e: Record<string, unknown>) => ({ id: `e${n++}`, ts: 1_700_000_000_000 + n * 60_000, ...e }) as unknown as LogEvent;
const answer = (o: Record<string, unknown> = {}) => ev({ type: 'answer', session: 's1', item: `n1-i0${n}`, skill: 'N1', phase: 'yourturn', correct: true, hint: 0, tries: 1, ms: 9000, format: 'tap', ...o });

describe('points for thinking (LTF-38)', () => {
  it('four for right on the first tap, two with the clue, one off when the answer was shown, none for a fast guess', () => {
    expect(pointsFor({ correct: true })).toBe(4);
    expect(pointsFor({ correct: false })).toBe(2);
    expect(pointsFor({ correct: false, shown: true })).toBe(-1);
    expect(pointsFor({ correct: true, rapid: true })).toBe(0);
  });
  it('adds the points saved on each answer; older answers keep their two', () => {
    expect(flightPoints([answer({ points: 4 }), answer({ points: -1 }), answer()])).toBe(5);
  });
  it('gear follows his best total, so points that come off never take a piece away', () => {
    const at = GEAR[0].at;
    const es = [answer({ points: at }), answer({ points: -1 })];
    expect(flightPoints(es)).toBe(at - 1);
    expect(flightPeak(es)).toBe(at);
    const g = gearState(flightPoints(es), flightPeak(es));
    expect(g.owned.map((p) => p.id)).toEqual([GEAR[0].id]);
    expect(g.next).toBe(GEAR[1]);
    expect(g.toNext).toBe(GEAR[1].at - (at - 1));
    expect(g.frac).toBeGreaterThanOrEqual(0);
  });
});

describe('fast guesses (LTF-38)', () => {
  it('reading time grows with the words in the question and its choices, never under a second and a half', () => {
    const short = { prompt: 'Who?', options: ['A', 'B', 'C'] } as unknown as Item;
    const long = { prompt: 'Why did Ben show the photo of the big footprint to every kid on the bus?', options: ['He was excited about the big footprint.', 'He wanted to sell it.', 'He was lost.'] } as unknown as Item;
    expect(minReadMs(short)).toBe(1500);
    expect(minReadMs(long)).toBeGreaterThan(2500);
  });
  it('a fast guess never counts toward or against mastery', () => {
    const open = ev({ type: 'session', session: 's1', action: 'start', strand: 'narrative', skill: 'N1' });
    const p = derive([open, answer({ correct: false, rapid: true, points: 0 }), answer({ correct: true })]);
    expect(p.skills.N1.answers.length).toBe(1);
    expect(p.skills.N1.answers[0].correct).toBe(true);
  });
});

describe('when guessing starts, for the grown-ups (LTF-38)', () => {
  it('counts set-aside answers, breaks and kind stops, and the minute guessing usually begins', () => {
    const t0 = 1_800_000_000_000;
    const at = (min: number, e: Record<string, unknown>) => ({ id: `g${n++}`, ts: t0 + min * 60_000, ...e }) as unknown as LogEvent;
    const es = [
      at(0, { type: 'session', session: 'a', action: 'start' }), at(3, { type: 'answer', session: 'a', item: 'x1', skill: 'N1', phase: 'yourturn', correct: true, hint: 0, tries: 1, ms: 9000, format: 'tap' }),
      at(9, { type: 'answer', session: 'a', item: 'x2', skill: 'N1', phase: 'yourturn', correct: false, hint: 0, tries: 2, ms: 900, format: 'tap', rapid: true }),
      at(9.5, { type: 'session', session: 'a', action: 'stop', reason: 'rapid' }),
      at(60, { type: 'session', session: 'b', action: 'start' }), at(71, { type: 'answer', session: 'b', item: 'x3', skill: 'N1', phase: 'yourturn', correct: false, hint: 0, tries: 2, ms: 800, format: 'tap', rapid: true }),
      at(72, { type: 'session', session: 'b', action: 'stop', reason: 'break' }),
    ];
    expect(guessing(es)).toEqual({ setAside: 2, rapidStops: 1, breaks: 1, startMinute: 10 });
  });
  it('says nothing about a start minute without set-aside answers', () => {
    expect(guessing([]).startMinute).toBeUndefined();
  });
});
