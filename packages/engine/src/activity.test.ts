import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@wayfinder/schema';
import { GEAR, delayEffect, flightPoints, recountTrend, gearState, insights, sessionActivity, usualStop } from './activity';
import { derive } from './index';

let n = 0;
const id = () => `e${++n}`;
const T0 = Date.UTC(2026, 9, 12, 16);
const MIN = 60_000;

/** A session: start, then [phase, correct] answers a minute apart, then how it ended. */
function session(t: number, answers: [string, boolean][], end: 'finish' | 'stop' | 'left', steps: string[] = []): LogEvent[] {
  const s = id();
  const ev: LogEvent[] = [{ id: id(), ts: t, type: 'session', session: s, action: 'start', strand: 'narrative', skill: 'N6' }];
  steps.forEach((step, i) => ev.push({ id: id(), ts: t + i * 10_000 + 1, type: 'activity', session: s, kind: 'step', step: step as never }));
  answers.forEach(([phase, correct], i) => ev.push({ id: id(), ts: t + (i + 1) * MIN, type: 'answer', session: s, item: `i${i}`, skill: 'N6', phase: phase as never, correct, hint: 0, tries: 1, ms: 20_000, format: 'tap' }));
  if (end !== 'left') ev.push({ id: id(), ts: t + (answers.length + 2) * MIN, type: 'session', session: s, action: end });
  return ev;
}

describe('flight kit', () => {
  it('rewards effort, not scores: every answer, finished sessions and the push-through bonus', () => {
    const ev = [...session(T0, [['warmup', true], ['warmup', false]], 'finish')];
    expect(flightPoints(ev)).toBe(2 + 2 + 3); // a wrong answer earns the same as a right one
    expect(flightPoints([...ev, { id: id(), ts: T0, type: 'activity', session: 's', kind: 'boost', points: 3 }])).toBe(10);
  });
  it('unlocks pieces in order and says how far the next one is', () => {
    expect(gearState(0)).toMatchObject({ owned: [], next: { id: 'cap' }, toNext: 4 });
    expect(gearState(47).owned.map((g) => g.id)).toEqual(['cap', 'scarf', 'goggles', 'compass']);
    expect(gearState(47)).toMatchObject({ next: { id: 'backpack' }, toNext: 23 });
    expect(gearState(10_000)).toMatchObject({ owned: GEAR, next: undefined, frac: 1 });
    expect(GEAR.every((g, i) => i === 0 || g.at > GEAR[i - 1].at)).toBe(true);
  });
});

describe('how sessions go', () => {
  it('summarises each session: outcome, last step, time per step, idle and away', () => {
    const ev = session(T0, [['warmup', true]], 'stop', ['warmup', 'watch']);
    const sid = (ev[0] as { session: string }).session;
    ev.push({ id: id(), ts: T0 + 30_000, type: 'activity', session: sid, kind: 'idle', step: 'watch' },
      { id: id(), ts: T0 + 90_000, type: 'activity', session: sid, kind: 'back', from: 'idle', ms: 105_000 },
      { id: id(), ts: T0 + 95_000, type: 'activity', session: sid, kind: 'skip-demo', step: 'watch' });
    const [s] = sessionActivity(ev);
    expect(s).toMatchObject({ outcome: 'stopped', lastStep: 'watch', idle: 1, idleMs: 105_000, answers: 1, firstTry: 1, skippedDemo: true });
    expect(s.steps.map((x) => x.step)).toEqual(['warmup', 'watch']);
    expect(s.steps[0].ms).toBe(10_000);
  });

  it('reads sessions from before step logging: two warm-ups then nothing means he reached the demo', () => {
    const [s] = sessionActivity(session(T0, [['warmup', true], ['warmup', true]], 'left'));
    expect(s).toMatchObject({ outcome: 'left', lastStep: 'watch' });
    const [done] = sessionActivity(session(T0, [['warmup', true], ['yourturn', true]], 'finish'));
    expect(done.lastStep).toBe('finish');
  });

  it('finds the usual stopping point and says so, but stays quiet with too little data', () => {
    const three = [0, 1, 2].flatMap((k) => session(T0 + k * 60 * MIN, [['warmup', true], ['warmup', true]], k === 0 ? 'stop' : 'left'));
    expect(usualStop(three)).toBe('watch');
    const tips = insights(three);
    expect(tips[0]).toMatchObject({ tone: 'act', title: 'Sessions often end at the demo (Watch)' });
    expect(tips.some((t) => t.title === 'Most sessions end early')).toBe(true);
    expect(insights(three.slice(0, 4))[0].title).toBe('Not enough sessions yet');
    const mixed = [...session(T0, [['warmup', true]], 'stop', ['warmup']), ...session(T0 + MIN * 90, [['together', true]], 'stop', ['together'])];
    expect(usualStop(mixed)).toBeUndefined();
  });

  it('spots a section that takes him much longer', () => {
    const quick = (t: number) => session(t, [['yourturn', true], ['yourturn', true], ['yourturn', true], ['yourturn', true]], 'finish');
    const ev = [...quick(T0), ...quick(T0 + 60 * MIN), ...quick(T0 + 120 * MIN)];
    const sid = (ev[0] as { session: string }).session;
    for (let i = 0; i < 4; i++) ev.push({ id: id(), ts: T0 + i, type: 'answer', session: sid, item: `slow${i}`, skill: 'F3', phase: 'yourturn', correct: true, hint: 0, tries: 1, ms: 60_000, format: 'tap' });
    const tips = insights(ev, (s) => (s === 'F3' ? 'Menus and timetables' : s));
    expect(tips.find((t) => t.title === 'Menus and timetables takes him longer')).toMatchObject({ tone: 'act' });
    expect(tips.some((t) => t.title === 'He finishes most sessions')).toBe(true);
  });
});

describe('hint wait (LTF-01)', () => {
  const together = (item: string, correct: boolean, delay?: number): LogEvent =>
    ({ id: id(), ts: T0 + n * 1000, type: 'answer', session: 's', item, skill: 'F1', phase: 'together', correct, hint: correct ? 0 : 1, tries: 1, ms: 9000, format: 'tap', ...(delay === undefined ? {} : { delay }) });
  it('compares right-first-time with the clue at once against after the wait, on first-time answers only', () => {
    const ev = [together('a', true, 0), together('b', false, 0), together('c', true, 8), together('d', true, 8), together('e', false, 8), together('a', true, 0), together('f', true)];
    const e = delayEffect(ev, derive(ev));
    expect(e.atOnce).toEqual({ correct: 1, total: 2 }); // the repeat of 'a' is left out
    expect(e.afterWait).toEqual({ correct: 2, total: 3 }); // 'f' has no recorded wait
    expect(e.total).toBe(5);
  });
});

describe('how his telling is growing (LTF-08)', () => {
  const recount = (day: number, sentences: number, parts: number, o: { skipped?: string[]; typed?: boolean; after?: boolean } = {}): LogEvent =>
    ({ id: id(), ts: T0 + day * 86_400_000, type: 'recount', stage: 1, parts, sentences, skipped: o.skipped ?? [], typed: !!o.typed, after: !!o.after, topic: 'day' });
  it('tracks sentences next to parts told, the questions he skips most, and how often he adds his own words', () => {
    const ev = [recount(0, 3, 1, { skipped: ['why', 'hard'] }), recount(1, 4, 1, { skipped: ['why'] }), recount(2, 6, 2, { typed: true, after: true }), recount(3, 8, 3, { typed: true })];
    const t = recountTrend(ev);
    expect(t.recounts.map((r) => [r.sentences, r.parts])).toEqual([[3, 1], [4, 1], [6, 2], [8, 3]]);
    expect(t.skippedMost).toEqual([['why', 2], ['hard', 1]]);
    expect(t.ownWords).toEqual({ count: 2, of: 4 });
    expect(t.after).toEqual({ count: 1, of: 4 });
    expect(t.early).toMatchObject({ sentences: 3.5, parts: 1 });
    expect(t.recent).toMatchObject({ sentences: 7, parts: 2.5 });
  });
  it('leaves out recounts saved before sentences were counted', () => {
    expect(recountTrend([{ id: 'old', ts: T0, type: 'recount', stage: 1, parts: 1 } as LogEvent]).recounts).toEqual([]);
  });
});
