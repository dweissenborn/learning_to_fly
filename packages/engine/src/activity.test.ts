import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@wayfinder/schema';
import { GEAR, PICTURE_COST, retellEffect, delayEffect, flightPeak, flightPoints, pictureBalance, supportEffect, todayLanterns, weekly, recountTrend, ideasUse, formatEffect, reasonRecord, gearState, insights, sessionActivity, usualStop } from './activity';
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

describe('Today lanterns (LTF-54)', () => {
  const told = (parts: number, k = 0) => ({ id: id(), ts: T0 + k, type: 'recount', stage: 1, parts, topic: 'day' }) as LogEvent;
  it('each Today he saves lights one lantern in a set of seven, however much he told', () => {
    expect(todayLanterns([])).toEqual({ lit: 0, sets: 0 });
    expect(todayLanterns([told(1), told(4), told(1)])).toEqual({ lit: 3, sets: 0 }); // a short one counts the same
    expect(todayLanterns(Array.from({ length: 7 }, (_, k) => told(1, k)))).toEqual({ lit: 0, sets: 1 }); // a full set, then a new one
    expect(todayLanterns(Array.from({ length: 9 }, (_, k) => told(2, k)))).toEqual({ lit: 2, sets: 1 });
  });
  it('lanterns are only a reward: they change no points and no skill', () => {
    const ev = [...session(T0, [['warmup', true]], 'finish'), told(1)];
    expect(flightPoints(ev)).toBe(flightPoints(ev.slice(0, -1)));
    expect(derive(ev).skills).toEqual(derive(ev.slice(0, -1)).skills);
  });
});

describe('pictures for flight points (LTF-51)', () => {
  it('a picture spends points he has earned, never his gear, and waits until he has enough', () => {
    const earned = session(T0, Array.from({ length: 20 }, () => ['warmup', true] as [string, boolean]), 'finish'); // 20 × 2 + 3
    expect(pictureBalance(earned)).toBe(43);
    expect(pictureBalance(earned)).toBeLessThan(PICTURE_COST);
    const more = [...earned, ...session(T0 + 60 * MIN, [['warmup', true], ['warmup', true], ['warmup', true], ['warmup', true]], 'finish')]; // 43 + 11
    expect(pictureBalance(more)).toBe(54);
    const drawn = [...more, { id: id(), ts: T0 + 120 * MIN, type: 'picture', ask: 'a dragon', svg: '<svg/>', cost: PICTURE_COST } as LogEvent];
    expect(pictureBalance(drawn)).toBe(54 - PICTURE_COST);
    expect(flightPoints(drawn)).toBe(54); // the kit counts what he earned
    expect(gearState(flightPoints(drawn), flightPeak(drawn)).owned).toEqual(gearState(54, 54).owned);
  });
});

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
  const recount = (day: number, sentences: number, parts: number, o: { skipped?: string[]; typed?: boolean; after?: boolean; feeling?: boolean; feelingWords?: number } = {}): LogEvent =>
    ({ id: id(), ts: T0 + day * 86_400_000, type: 'recount', stage: 1, parts, sentences, skipped: o.skipped ?? [], typed: !!o.typed, after: !!o.after, topic: 'day', ...(o.feeling !== undefined ? { feeling: o.feeling } : {}), ...(o.feelingWords !== undefined ? { feelingWords: o.feelingWords } : {}) });
  it('tracks sentences next to parts told, the questions he skips most, and how often he adds his own words', () => {
    const ev = [recount(0, 3, 1, { skipped: ['why', 'hard'] }), recount(1, 4, 1, { skipped: ['why'], feeling: false }), recount(2, 6, 2, { typed: true, after: true, feeling: true }), recount(3, 8, 3, { typed: true, feeling: true, feelingWords: 3 })];
    const t = recountTrend(ev);
    expect(t.recounts.map((r) => [r.sentences, r.parts])).toEqual([[3, 1], [4, 1], [6, 2], [8, 3]]);
    expect(t.skippedMost).toEqual([['why', 2], ['hard', 1]]);
    expect(t.ownWords).toEqual({ count: 2, of: 4 });
    expect(t.after).toEqual({ count: 1, of: 4 });
    expect(t.feeling).toEqual({ count: 2, of: 3 }); // LTF-58: only Todays saved since it was recorded count
    expect(t.feelingWords).toEqual({ total: 3, of: 1 }); // LTF-58: feeling words, from the Todays that counted them
    expect(t.recounts.map((r) => r.feelingWords)).toEqual([undefined, undefined, undefined, 3]);
    expect(t.early).toMatchObject({ sentences: 3.5, parts: 1 });
    expect(t.recent).toMatchObject({ sentences: 7, parts: 2.5 });
  });
  it('leaves out recounts saved before sentences were counted', () => {
    expect(recountTrend([{ id: 'old', ts: T0, type: 'recount', stage: 1, parts: 1 } as LogEvent]).recounts).toEqual([]);
  });
});

describe('ideas behind a button (LTF-07)', () => {
  const D = 86_400_000, now = 1_800_000_000_000;
  const rec = (daysAgo: number, ideas: boolean[]) => ({ id: `i${daysAgo}-${ideas.join()}`, ts: now - daysAgo * D, type: 'recount', stage: 3, parts: 3, topic: 'day', ideas }) as LogEvent;
  const all = [true, true, true];

  it('counts the questions he answered without ideas this week', () => {
    expect(ideasUse([rec(10, [false, false]), rec(3, [true, false, false]), rec(1, [true, true])], now).week).toEqual({ without: 2, of: 5 });
    expect(ideasUse([], now).week).toEqual({ without: 0, of: 0 });
  });

  it('steps back a stage after two weeks of ideas on every question, and not before', () => {
    expect(ideasUse([rec(15, all), rec(9, all), rec(4, all), rec(1, all)], now).stepBack).toBe(true);
    expect(ideasUse([rec(9, all), rec(4, all), rec(1, all)], now).stepBack).toBe(false); // not two weeks with the button yet
    expect(ideasUse([rec(15, all), rec(9, all), rec(4, [true, false]), rec(1, all)], now).stepBack).toBe(false); // one answer of his own
    expect(ideasUse([rec(20, all), rec(1, all)], now).stepBack).toBe(false); // too few recounts to judge
  });
});

describe('which question types work for him (LTF-15)', () => {
  const ans = (item: string, skill: string, level: number, format: string, correct: boolean, phase = 'yourturn'): LogEvent =>
    ({ id: id(), ts: T0 + n * 1000, type: 'answer', session: 's', item, skill: skill as never, phase: phase as never, correct, hint: 0, tries: 1, ms: 9000, format, level });
  it('compares formats only within the same skill and level, on his own first-time answers', () => {
    const ev = [
      ans('o1', 'N2', 2, 'order', true), ans('o2', 'N2', 2, 'order', false), ans('o3', 'N2', 2, 'order', true, 'warmup'),
      ans('t1', 'N2', 2, 'tap', true), ans('t2', 'N2', 2, 'tap', true),
      ans('t1', 'N2', 2, 'tap', false), // a repeat: left out
      ans('h1', 'N2', 2, 'highlight', false, 'together'), // guided: left out
      ans('t3', 'N2', 3, 'tap', true), ans('t4', 'N2', 3, 'tap', true), // one format at this level: nothing to compare
      ans('s1', 'F4', 2, 'sort', false), ans('t5', 'F4', 2, 'tap', true),
    ];
    expect(formatEffect(derive(ev))).toEqual([
      { skill: 'F4', level: 2, formats: [{ format: 'sort', correct: 0, total: 1 }, { format: 'tap', correct: 1, total: 1 }] },
      { skill: 'N2', level: 2, formats: [{ format: 'order', correct: 2, total: 3 }, { format: 'tap', correct: 2, total: 2 }] },
    ]);
  });
});

describe('reading and engagement, week by week (LTF-60)', () => {
  it('keeps reading and engagement as separate lines, per week, with no combined score', () => {
    const mon = Date.UTC(2026, 9, 12, 16); // a Monday
    const a = session(mon, [['yourturn', true], ['yourturn', false], ['yourturn', true]], 'finish'); // a miss, then he kept going
    const b = session(mon + 86_400_000, [['yourturn', false]], 'stop'); // a miss, then he stopped
    const c = session(mon + 7 * 86_400_000, [['warmup', false], ['yourturn', true]], 'finish'); // next week: a warm-up miss, then he kept going; warm-ups are not his own turn
    const again = (ts: number, like: string): LogEvent => ({ id: id(), ts, type: 'activity', session: 's', kind: 'again', like } as LogEvent);
    const rows = weekly([...a, ...b, ...c, again(mon + 1000, 'like'), again(mon + 86_400_000 + 1000, 'unsure')]);
    expect(rows).toEqual([
      { week: '2026-10-12', reading: { correct: 2, total: 4 }, started: 2, finished: 1, days: 2, keptGoing: { count: 1, of: 2 }, again: { yes: 1, of: 2 } },
      { week: '2026-10-19', reading: { correct: 1, total: 1 }, started: 1, finished: 1, days: 1, keptGoing: { count: 1, of: 1 }, again: { yes: 0, of: 0 } },
    ]);
    expect(Object.keys(rows[0])).not.toContain('score');
  });
});

describe('do pictures and read-aloud help him? (LTF-56)', () => {
  const ans = (item: string, skill: string, level: number, on: boolean, correct: boolean, phase = 'yourturn'): LogEvent =>
    ({ id: id(), ts: T0 + n * 1000, type: 'answer', session: 's', item, skill: skill as never, phase: phase as never, correct, hint: 0, tries: 1, ms: 9000, format: 'tap', level, pictures: on, readAloud: !on });
  it('compares with and without a support only where both happened at the same skill and level', () => {
    const ev = [
      ans('a1', 'N2', 2, true, true), ans('a2', 'N2', 2, true, true), ans('a3', 'N2', 2, false, false), ans('a4', 'N2', 2, false, true, 'warmup'),
      ans('a1', 'N2', 2, false, false), // a repeat: left out
      ans('a5', 'N2', 2, true, false, 'together'), // guided: left out
      ans('b1', 'N3', 3, true, true), ans('b2', 'N3', 3, true, true), // never without pictures here: nothing to compare
    ];
    expect(supportEffect(derive(ev), 'pictures')).toEqual({ with: { correct: 2, total: 2 }, without: { correct: 1, total: 2 }, groups: 1 });
    expect(supportEffect(derive(ev), 'readAloud')).toEqual({ with: { correct: 1, total: 2 }, without: { correct: 2, total: 2 }, groups: 1 });
    expect(supportEffect(derive([]), 'pictures')).toEqual({ with: { correct: 0, total: 0 }, without: { correct: 0, total: 0 }, groups: 0 });
  });
});

describe('the reasoning card, as a single-case record (LTF-02)', () => {
  const ans = (item: string, phase: string, correct: boolean, hint = 0): LogEvent =>
    ({ id: id(), ts: T0 + n * 1000, type: 'answer', session: 's', item, skill: 'N5', phase: phase as never, correct, hint, tries: 1, ms: 9000, format: 'tap', ...(item === 'r1' && hint >= 2 ? { card: true } : {}) });
  it('compares his N5 right-first-time before and after he first saw a card, on first-time answers of his own', () => {
    const ev = [
      ans('a', 'yourturn', false), ans('b', 'warmup', true), ans('c', 'together', false), // before; guided practice is left out
      ans('r1', 'together', false, 2), // he sees the card for the first time here
      ans('d', 'yourturn', true), ans('r2', 'yourturn', true), ans('e', 'yourturn', false), ans('d', 'warmup', false), // the repeat of 'd' is left out
    ];
    const r = reasonRecord(derive(ev));
    expect(r.before).toEqual({ correct: 1, total: 2 });
    expect(r.after).toEqual({ correct: 2, total: 3 });
    expect(r.since).toBe(ev[3].ts);
    expect(reasonRecord(derive(ev.slice(0, 3))).since).toBeUndefined();
  });
});

describe('telling the story back, with and without the scene (LTF-61, a pilot)', () => {
  it('counts right retells with the scene shown and without, apart', () => {
    const r = (scene: boolean, correct: boolean): LogEvent => ({ id: id(), ts: T0, type: 'activity', session: 's', kind: 'retell', item: 'n1-i00', scene, correct } as LogEvent);
    expect(retellEffect([r(true, true), r(true, false), r(false, true), r(true, true)])).toEqual({ scene: { correct: 2, total: 3 }, noScene: { correct: 1, total: 1 } });
    expect(retellEffect([])).toEqual({ scene: { correct: 0, total: 0 }, noScene: { correct: 0, total: 0 } });
  });
});
