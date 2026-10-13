import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@wayfinder/schema';
import { GEAR, flightPoints, gearState, insights, sessionActivity, usualStop } from './activity';

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
  it('rewards effort, first tries, finished sessions and the push-through bonus', () => {
    const ev = [...session(T0, [['warmup', true], ['warmup', false]], 'finish')];
    expect(flightPoints(ev)).toBe(2 + 1 + 3);
    expect(flightPoints([...ev, { id: id(), ts: T0, type: 'activity', session: 's', kind: 'boost', points: 3 }])).toBe(9);
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
