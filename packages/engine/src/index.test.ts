import { describe, expect, it } from 'vitest';
import type { Item, LogEvent, Passage, SkillBank, SkillId } from '@wayfinder/schema';
import {
  buildPool, choices, derive, errorPatterns, tagAccuracy, journeyPosition, journeyRoute, forkOptions, routePosition, pastFork, planWord, planCheckup, checkupDue, checkupResults, levelFor, levelPeak, focusSkill, gate, GATE_SKILLS, mulberry32, pickItems, placementStart, placementSupports, grammarSet, planGateCheck, planSession, testFlight, dayKey, BEATS_FOR_LEG,
} from './index';

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 1, 16, 0).getTime(); // 1 Oct 2026, 4 PM local
let n = 0;
const id = () => `e${++n}`;

/** One session with its your-turn answers. `ok` is a list of first-try results; `transfer` marks the last answer as a transfer item. */
function session(ts: number, skill: SkillId, ok: boolean[], o: { transfer?: boolean; warmup?: [SkillId, boolean][]; strand?: string; gatecheck?: boolean[] } = {}): LogEvent[] {
  const sid = id();
  const ev: LogEvent[] = [{ id: id(), ts, type: 'session', session: sid, action: 'start', strand: (o.strand ?? (skill[0] === 'F' ? 'functional' : skill[0] === 'N' ? 'narrative' : 'philosophical')) as never, skill, gatecheck: !!o.gatecheck }];
  let t = ts;
  const answer = (sk: string, phase: 'warmup' | 'yourturn' | 'gatecheck', correct: boolean, transfer = false): LogEvent =>
    ({ id: id(), ts: (t += 1000), type: 'answer', session: sid, item: `${sk}-${id()}`, skill: sk, phase, correct, hint: correct ? 0 : 1, tries: correct ? 1 : 2, ms: 5000, format: 'tap', transfer });
  for (const [sk, c] of o.warmup ?? []) ev.push(answer(sk, 'warmup', c));
  for (const c of o.gatecheck ?? []) ev.push(answer('N5', 'gatecheck', c));
  ok.forEach((c, i) => ev.push(answer(skill, 'yourturn', c, !!o.transfer && i === ok.length - 1)));
  ev.push({ id: id(), ts: t + 1000, type: 'session', session: sid, action: 'finish' });
  return ev;
}
const masterOn = (skill: SkillId, ts: number) => [...session(ts, skill, [true, true, true, true]), ...session(ts + DAY, skill, [true, true, true, true], { transfer: true })];

describe('mastery rule', () => {
  it('needs two sessions on different days', () => {
    expect(derive(session(T0, 'N1', [true, true, true, true], { transfer: true })).skills.N1.status).toBe('learning');
    const sameDay = [...session(T0, 'N1', [true, true, true, true]), ...session(T0 + 3600_000, 'N1', [true, true, true, true], { transfer: true })];
    expect(derive(sameDay).skills.N1.status).toBe('learning');
    expect(derive(masterOn('N1', T0)).skills.N1.status).toBe('mastered');
  });

  it('counts the last answer even when it shares a millisecond with the finish, stored in either order', () => {
    const ev = session(T0, 'N1', [true, true, false, true]);
    const fin = ev.at(-1)!, last = ev.at(-2)!;
    const finishFirst = [...ev.slice(0, -2), { ...fin, ts: last.ts }, last]; // as the app logs them; storage order is by id
    expect(derive(finishFirst).skills.N1.tallies.at(-1)).toMatchObject({ correct: 3, total: 4 });
    expect(derive(finishFirst).sessions[0]).toMatchObject({ finished: true });
  });

  it('needs 80% across the two sessions', () => {
    const ev = [...session(T0, 'N1', [true, false, true, false]), ...session(T0 + DAY, 'N1', [true, true, true, true], { transfer: true })];
    expect(derive(ev).skills.N1.status).toBe('learning'); // 6 of 8 = 75%
    const ok = [...session(T0, 'N1', [true, false, true, true, true]), ...session(T0 + DAY, 'N1', [true, true, true, true], { transfer: true })];
    expect(derive(ok).skills.N1.status).toBe('mastered'); // 8 of 9
  });

  it('needs a correct item in a new format or setting', () => {
    const ev = [...session(T0, 'N1', [true, true, true]), ...session(T0 + DAY, 'N1', [true, true, true])];
    expect(derive(ev).skills.N1.status).toBe('learning');
  });

  it('ignores answers given with hints or in other phases', () => {
    const ev = session(T0, 'N1', [], { warmup: [['N1', true], ['N1', true]] });
    expect(derive(ev).skills.N1.tallies).toHaveLength(0);
  });
});

describe('review dates', () => {
  it('reviews at 3, 7 and 21 days, then counts as lasted', () => {
    let ev = masterOn('F1', T0);
    let s = derive(ev).skills.F1;
    const m = s.masteredAt!;
    expect(s.nextReview).toBe(m + 3 * DAY);
    let t = m + 3 * DAY;
    for (const gap of [7, 21, 21]) {
      ev = [...ev, ...session(t, 'N1', [true], { warmup: [['F1', true]] })];
      s = derive(ev).skills.F1;
      expect(s.status).toBe('mastered');
      expect(s.nextReview! - t).toBeGreaterThanOrEqual(gap * DAY);
      t = s.nextReview!;
    }
    expect(s.reviewStage).toBe(3);
  });

  it('a review is three questions and passes at two right, so one slip on a skill he knows does not send it back (DW 2026-10-28)', () => {
    const at = T0 + 5 * DAY;
    const review = (...right: boolean[]) => derive([...masterOn('F1', T0), ...session(at, 'N1', [true], { warmup: right.map((r) => ['F1', r] as [SkillId, boolean]) })]).skills.F1;
    expect(review(true, false, true)).toMatchObject({ status: 'mastered', reviewStage: 1 });
    expect(review(false, true, false)).toMatchObject({ status: 'learning', relearning: true });
    expect(review(true, true)).toMatchObject({ reviewStage: 1 }); // a session stopped part way judges what he answered
    expect(review(false)).toMatchObject({ relearning: true });
  });

  it('a review only happens when it is due', () => {
    const ev = [...masterOn('F1', T0), ...session(T0 + DAY + 3600_000, 'N1', [true], { warmup: [['F1', false]] })];
    expect(derive(ev).skills.F1.status).toBe('mastered');
  });

  it('a failed review returns the skill to practice; one good session restores it', () => {
    let ev = [...masterOn('F1', T0), ...session(T0 + 5 * DAY, 'N1', [true], { warmup: [['F1', false]] })];
    let s = derive(ev).skills.F1;
    expect(s.status).toBe('learning');
    expect(s.relearning).toBe(true);
    expect(s.everMastered).toBe(true); // the child's view never shows a loss
    ev = [...ev, ...session(T0 + 6 * DAY, 'F1', [true, true, true, false, true])];
    s = derive(ev).skills.F1;
    expect(s.status).toBe('mastered');
    expect(s.reviewStage).toBe(0);
  });
});

describe('journey beats for each pace', () => {
  it('says "one more session" (beat 4) only on the last session of a leg, at every pace', () => {
    for (const [len, table] of Object.entries(BEATS_FOR_LEG)) {
      expect(table).toHaveLength(Number(len));
      table.forEach((beat, step) => { if (beat === 4) expect(step).toBe(Number(len) - 1); });
      expect(table.every((b, i) => i === 0 || b >= table[i - 1])).toBe(true); // the story never goes back within a leg
    }
  });
});

describe('dayKey', () => {
  it('is his local date as YYYY-MM-DD, zero-padded, as the picture API checks it', () => {
    expect(dayKey(new Date(2026, 10, 5, 23, 30).getTime())).toBe('2026-11-05');
    expect(dayKey(new Date(2026, 9, 26, 0, 5).getTime())).toBe('2026-10-26');
  });
});

describe('test flights with one support fewer (LTF-56, a trial)', () => {
  const both = { pictures: true, readAloud: true };
  it('runs every fifth block of sessions with one support fewer, taking turns between the supports', () => {
    expect(testFlight(19, 5, both)).toBeNull();
    expect(testFlight(20, 5, both)).toEqual({ support: 'pictures', block: 4 });
    expect(testFlight(24, 5, both)).toEqual({ support: 'pictures', block: 4 });
    expect(testFlight(25, 5, both)).toBeNull();
    expect(testFlight(45, 5, both)).toEqual({ support: 'readAloud', block: 9 });
    expect(testFlight(12, 3, both)).toEqual({ support: 'pictures', block: 4 }); // blocks follow the leg length
    expect(testFlight(21, 3, both)).toBeNull();
  });
  it('only ever takes away a support that is on', () => {
    expect(testFlight(45, 5, { pictures: true, readAloud: false })).toEqual({ support: 'pictures', block: 9 });
    expect(testFlight(20, 5, { pictures: false, readAloud: false })).toBeNull();
  });
});

describe('placement', () => {
  it('starts at the first missed step', () => {
    expect(placementStart([{ skill: 'F1', correct: true }, { skill: 'F2', correct: true }, { skill: 'F3', correct: false }, { skill: 'F4', correct: false }])).toBe(3);
    expect(placementStart([{ skill: 'N1', correct: false }])).toBe(1);
    expect(placementStart([{ skill: 'N1', correct: true }])).toBe(6);
  });

  it('marks earlier steps mastered, to be confirmed by review', () => {
    const p = derive([{ id: id(), ts: T0, type: 'placement', functional: 3, narrative: 1, word: 1, reading: 1, listening: 1 }]);
    expect(p.skills.F2.status).toBe('mastered');
    expect(p.skills.F2.placed).toBe(true);
    expect(p.skills.F2.nextReview).toBe(T0 + 3 * DAY);
    expect(p.skills.F3.status).toBe('new');
    expect(p.skills.N1.status).toBe('new');
    expect(focusSkill(p, 'functional')).toBe('F3');
  });

  it('a later placement (the "Who did it?" stop run again) never re-masters a skill he is relearning', () => {
    const place = (ts: number): LogEvent => ({ id: id(), ts, type: 'placement', functional: 3, narrative: 1, word: 1, reading: 1, listening: 1 });
    const missed = session(T0 + 3 * DAY, 'F3', [true, true], { warmup: [['F1', false]] }); // F1's first review, missed
    expect(derive([place(T0), ...missed]).skills.F1.relearning).toBe(true);
    const again = derive([place(T0), ...missed, place(T0 + 4 * DAY)]);
    expect(again.skills.F1).toMatchObject({ status: 'learning', relearning: true });
    expect(again.skills.F2.status).toBe('mastered'); // still placed
  });

  it('counts placement answers as seen but never toward mastery', () => {
    const p = derive([{ id: id(), ts: T0, type: 'answer', session: 'placement', item: 'f2-i01', skill: 'F2', phase: 'placement', correct: true, hint: 0, tries: 1, ms: 1, format: 'tap' }]);
    expect(p.seen.has('f2-i01')).toBe(true);
    expect(p.skills.F2.answers).toHaveLength(0);
    expect(p.skills.F2.status).toBe('new');
  });

  it('turns on read-aloud when listening beats reading', () => {
    expect(placementSupports({ word: 0.9, reading: 1 / 3, listening: 1 })).toEqual({ readAloud: true, pictures: false, names: false });
    expect(placementSupports({ word: 0.5, reading: 1, listening: 1 })).toEqual({ readAloud: true, pictures: true, names: false });
    expect(placementSupports({ word: 1, reading: 1, listening: 1 })).toEqual({ readAloud: false, pictures: false, names: false });
  });

  it('runs the next set of grammar sentences each time, so he never sees the same ones twice in a row (LTF-13)', () => {
    const pl = (grammar?: number): LogEvent => ({ id: id(), ts: T0, type: 'placement', functional: 1, narrative: 1, word: 1, reading: 1, listening: 1, ...(grammar === undefined ? {} : { grammar }) });
    expect(grammarSet([], 3)).toBe(0);
    expect(grammarSet([pl(1)], 3)).toBe(1);
    expect(grammarSet([pl(1), pl()], 3)).toBe(1); // a placement without the stop does not count
    expect(grammarSet([pl(1), pl(0.5), pl(1)], 3)).toBe(0);
  });

  it('suggests names instead of he and she when sentence grammar is low, and only once it has been checked (LTF-13)', () => {
    expect(placementSupports({ word: 1, reading: 1, listening: 1, grammar: 4 / 6 }).names).toBe(true);
    expect(placementSupports({ word: 1, reading: 1, listening: 1, grammar: 5 / 6 }).names).toBe(false);
    expect(placementSupports({ word: 1, reading: 1, listening: 1 }).names).toBe(false); // not run yet
  });
});

describe('the philosophical gate', () => {
  // Master every gate skill, then pass three reviews each (the last one at 21 days).
  function lastedEvents() {
    let ev: LogEvent[] = [];
    GATE_SKILLS.forEach((sk, i) => (ev = ev.concat(masterOn(sk, T0 + i * 2 * DAY))));
    let t = T0 + 40 * DAY;
    for (let round = 0; round < 3; round++) {
      for (let k = 0; k < GATE_SKILLS.length; k += 3) ev = ev.concat(session(t + k * 3600_000, 'N6', [true], { warmup: GATE_SKILLS.slice(k, k + 3).map((s) => [s, true] as [SkillId, boolean]) }));
      t += 30 * DAY;
    }
    return { ev, t };
  }

  it('opens only when all four conditions hold, and stays open', () => {
    const { ev, t } = lastedEvents();
    let g = gate(derive(ev));
    expect(g.conditions).toEqual({ narrative: true, functional: true, lasted: true, inference: false });
    expect(g.checkReady).toBe(true);
    expect(g.available).toBe(false);

    const failCheck = [...ev, ...session(t, 'N5', [], { gatecheck: [true, true, true, false, false] })];
    expect(gate(derive(failCheck)).available).toBe(false); // 60%

    const passed = [...ev, ...session(t, 'N5', [], { gatecheck: [true, true, true, true, false] })];
    g = gate(derive(passed));
    expect(g.opened).toBe(true);
    expect(g.available).toBe(true);
  });

  it('"has passed its 21-day review" stays true after a later slip, once the skill is relearned (plan, gate condition 3)', () => {
    const { ev, t } = lastedEvents();
    const due = Math.max(derive(ev).skills.N1.nextReview!, t);
    const slipped = [...ev, ...session(due + DAY, 'F4', [true], { warmup: [['N1', false]] })];
    expect(gate(derive(slipped)).conditions.narrative).toBe(false); // N1 is relearning
    const relearned = [...slipped, ...session(due + 2 * DAY, 'N1', [true, true, true])];
    expect(derive(relearned).skills.N1.status).toBe('mastered');
    expect(gate(derive(relearned)).conditions).toMatchObject({ narrative: true, lasted: true });
  });

  it('rests while an earlier skill slips, and an adult can override', () => {
    const { ev, t } = lastedEvents();
    const opened = [...ev, ...session(t, 'N5', [], { gatecheck: [true, true, true, true, true] })];
    // N1 fails its next review: the strand rests but stays opened.
    const due = Math.max(derive(opened).skills.N1.nextReview!, t);
    const slipped = [...opened, ...session(due + DAY, 'F4', [true], { warmup: [['N1', false]] })];
    const g = gate(derive(slipped));
    expect(g.opened).toBe(true);
    expect(g.resting).toBe(true);
    expect(g.available).toBe(false);
    expect(gate(derive(slipped), 'open').available).toBe(true);
    expect(gate(derive(opened), 'hold').available).toBe(false);
  });

  it('takes at most one session in four', () => {
    const { ev, t } = lastedEvents();
    const opened = [...ev, ...session(t, 'N5', [], { gatecheck: [true, true, true, true, true] })];
    const has = (e: LogEvent[]) => choices(derive(e), gate(derive(e)), t + DAY).some((c) => c.kind === 'strand' && c.strand === 'philosophical');
    expect(has(opened)).toBe(true);
    const afterP = [...opened, ...session(t + DAY, 'P1', [true], { strand: 'philosophical' })];
    expect(has(afterP)).toBe(false);
    const three = [...afterP, ...session(t + 2 * DAY, 'F4', [true]), ...session(t + 3 * DAY, 'F4', [true])];
    expect(has(three)).toBe(false);
    expect(has([...three, ...session(t + 4 * DAY, 'F4', [true])])).toBe(true);
  });
});

describe('item choice', () => {
  const passage = (pid: string, topics: Passage['topics'], themes?: Passage['themes']): Passage => ({
    id: pid, title: pid, kind: 'story', sentences: ['A.'], topics, level: 1, socialLoad: 0, themes,
    credit: { title: pid, author: 'x', source: 'x', licence: 'original', retrieved: '2026-10-12', adapted: false },
  });
  const item = (iid: string, pid: string, extra: Partial<Item> = {}): Item =>
    ({ id: iid, skill: 'N1', passage: pid, format: 'tap', level: 1, prompt: '?', explain: '.', options: ['a', 'b'], answer: 0, ...extra });
  const bank: SkillBank = {
    skill: 'N1',
    passages: [passage('space', ['space']), passage('food', ['food']), passage('sad', ['animals'], ['loss'])],
    items: [
      item('m', 'food'), item('a', 'food'), item('b', 'food', { level: 2 }), item('c', 'space', { level: 2 }), item('d', 'space', { level: 3, transfer: true }),
      item('h', 'sad'), item('x', 'food', { level: 3 }),
    ],
    model: { item: 'm', steps: [{ say: '1' }, { say: '2' }, { say: '3', reveal: true }] },
  };
  const n5: SkillBank = {
    skill: 'N5', passages: [passage('gp', ['school'])],
    items: [item('g', 'gp', { skill: 'N5', gatecheck: true, inference: 1 }), item('n5m', 'gp', { skill: 'N5' })],
    model: { item: 'n5m', steps: [{ say: '1' }, { say: '2' }, { say: '3', reveal: true }] },
  };
  const pool = buildPool([bank, n5]);
  const ctx = (o: Partial<Parameters<typeof pickItems>[0]> = {}) => ({ pool, seen: new Map(), interests: [], allowThemes: false, rng: mulberry32(7), ...o });

  it('never serves the model, gatecheck, hidden or hard-theme items', () => {
    const ids = pickItems(ctx({ hidden: new Set(['x']) }), 'N1', 10).map((i) => i.id);
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(pickItems(ctx({ allowThemes: true }), 'N1', 10).map((i) => i.id)).toContain('h');
    expect(planGateCheck(ctx()).map((i) => i.id)).toEqual(['g']);
  });

  it('prefers unseen items, then the lowest level', () => {
    const seen = new Map([['a', T0]]);
    const ids = pickItems({ ...ctx({ seen }), rng: () => 0.99 }, 'N1', 5).map((i) => i.id);
    expect(ids.at(-1)).toBe('a');
    expect(ids[0]).toBe('b'); // unseen level 2 beats seen level 1
  });

  it('prefers interest topics unless the pick is a deliberate neutral one', () => {
    expect(pickItems({ ...ctx({ interests: ['space'] }), rng: () => 0.99 }, 'N1', 1)[0].passage).toBe('space');
    expect(pickItems({ ...ctx({ interests: ['space'] }), rng: () => 0.01 }, 'N1', 1)[0].passage).toBe('food');
  });

  it('includes a transfer item when asked', () => {
    expect(pickItems(ctx(), 'N1', 2, { transfer: true }).some((i) => i.transfer)).toBe(true);
  });

  it('plans warm-up, model, together and your turn without repeats', () => {
    const plan = planSession(derive([]), ctx(), 'narrative', T0, 4);
    const all = [...plan.warmup, ...plan.together, ...plan.yourturn].map((i) => i.id);
    expect(plan.skill).toBe('N1');
    expect(plan.model?.item.id).toBe('m');
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain('m');
  });

  it('puts due reviews into the warm-up', () => {
    const ev = masterOn('N1', T0);
    const p = derive(ev);
    const plan = planSession(p, ctx(), 'functional', p.skills.N1.nextReview! + 1, 4);
    expect(plan.review).toEqual(['N1']);
    expect(plan.warmup.every((i) => i.skill === 'N1')).toBe(true);
    expect(plan.warmup).toHaveLength(3); // a review is three questions (DW 2026-10-28)
  });
});

describe('the journey', () => {
  it('moves one stop every leg of finished sessions and never moves back', () => {
    expect(journeyPosition(0, 6, 5)).toEqual({ stop: 0, step: 0, beat: 0, arrived: false, after: 0 });
    expect(journeyPosition(4, 6, 5)).toMatchObject({ stop: 0, step: 4, beat: 4 });
    expect(journeyPosition(5, 6, 5)).toMatchObject({ stop: 1, step: 0, beat: 0 });
    expect(journeyPosition(25, 6, 5)).toMatchObject({ stop: 5, arrived: true, after: 0 });
    expect(journeyPosition(31, 6, 5)).toMatchObject({ stop: 5, arrived: true, after: 6 });
  });

  it('shows the obstacle and how it was overcome on short and long legs', () => {
    expect([0, 1, 2].map((n) => journeyPosition(n, 6, 3).beat)).toEqual([0, 2, 3]);
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => journeyPosition(n, 6, 7).beat)).toEqual([0, 1, 1, 2, 3, 3, 4]);
  });

  it('never moves back when an adult changes the pace mid-journey', () => {
    const now = journeyPosition(12, 6, 5); // stop 2, two sessions into the leg
    expect(now).toMatchObject({ stop: 2, step: 2 });
    const anchor = { at: 12, stop: now.stop, step: now.step, after: now.after };
    expect(journeyPosition(12, 6, 7, anchor)).toMatchObject({ stop: 2, step: 2 });
    expect(journeyPosition(17, 6, 7, anchor)).toMatchObject({ stop: 3, step: 0 });
    expect(journeyPosition(13, 6, 3, anchor)).toMatchObject({ stop: 3, step: 0 }); // shorter legs: the step is capped, so it arrives next
    expect(journeyPosition(40, 6, 3, { at: 30, stop: 5, step: 0, after: 4 })).toMatchObject({ arrived: true, after: 14 });
  });
});

describe('island routes that branch (LTF-20)', () => {
  // Home, Gull, then a fork to one of four themed islands (or the old Windy Cape route), rejoining at the airfield.
  const stops = [
    { id: 'home', next: ['gull'] }, { id: 'gull', next: ['fossil', 'reef', 'star', 'rail', 'cape'] },
    { id: 'fossil', topics: ['dinosaurs', 'mining'], next: ['airfield'] }, { id: 'reef', topics: ['ocean', 'animals'], next: ['airfield'] },
    { id: 'star', topics: ['space', 'weather'], next: ['airfield'] }, { id: 'rail', topics: ['transport', 'maps'], next: ['airfield'] },
    { id: 'cape', legacy: true, next: ['airfield'] },
    { id: 'airfield', next: ['takeoff'] }, { id: 'takeoff', next: ['australia'] }, { id: 'australia' },
  ];

  it('every route reaches Australia, with the same number of stops', () => {
    for (const pick of ['fossil', 'reef', 'star', 'rail', 'cape']) {
      const r = journeyRoute(stops, { gull: pick });
      expect(r.ids).toEqual(['home', 'gull', pick, 'airfield', 'takeoff', 'australia']);
      expect(r.forkAt).toBeUndefined();
    }
    expect(journeyRoute(stops, {})).toEqual({ ids: ['home', 'gull'], forkAt: 1 });
  });

  it('offers at most three islands, the ones that best match his interests, and never the old route', () => {
    expect(forkOptions(stops, 'gull', ['space', 'transport', 'maps']).map((s) => s.id)).toEqual(['rail', 'star', 'fossil']);
    expect(forkOptions(stops, 'gull', []).map((s) => s.id)).toEqual(['fossil', 'reef', 'star']);
  });

  it('waits at the fork until he chooses, then moves along the route he chose from there', () => {
    const none = journeyRoute(stops, {});
    expect(routePosition(4, none, 6, 5)).toMatchObject({ stop: 0, step: 4, waiting: false }); // still on the way to Gull
    expect(routePosition(5, none, 6, 5)).toMatchObject({ stop: 1, step: 0, waiting: true });
    expect(routePosition(9, none, 6, 5)).toMatchObject({ stop: 1, step: 0, waiting: true }); // sessions while waiting do not move him
    const chosen = journeyRoute(stops, { gull: 'reef' });
    const anchor = { at: 9, stop: 1, step: 0, after: 0 }; // set when he chooses
    expect(routePosition(9, chosen, 6, 5, anchor)).toMatchObject({ stop: 1, step: 0, waiting: false });
    expect(routePosition(14, chosen, 6, 5, anchor)).toMatchObject({ stop: 2, step: 0 });
    expect(routePosition(29, chosen, 6, 5, anchor)).toMatchObject({ stop: 5, arrived: true });
    // Chosen before he reached Gull: no wait at all.
    expect(routePosition(10, chosen, 6, 5)).toMatchObject({ stop: 2, step: 0, waiting: false });
  });

  it('keeps the place of a learner who was already past Gull Island when the routes arrived', () => {
    expect(pastFork(12, 1, 6, 5)).toBe(true); // stop 2, partway along the old route: he stays on it
    expect(pastFork(6, 1, 6, 5)).toBe(true); // one session into the leg after Gull: its story has begun
    expect(pastFork(5, 1, 6, 5)).toBe(false); // just reached Gull: he gets the fork
    expect(pastFork(3, 1, 6, 5)).toBe(false);
  });
});

describe('a word for today in the warm-up (LTF-04)', () => {
  const pass = (pid: string, sentences: string[], words?: { word: string; means: string; pic: string }[]): Passage => ({
    id: pid, title: pid, kind: 'story', sentences, topics: ['school'], level: 4, socialLoad: 0, ...(words ? { words } : {}),
    credit: { title: pid, author: 'x', source: 'x', licence: 'original', retrieved: '2026-10-13', adapted: false },
  });
  const item = (iid: string, pid: string): Item => ({ id: iid, skill: 'N1', passage: pid, format: 'tap', level: 4, prompt: '?', explain: '.', options: ['a', 'b'], answer: 0 });
  const bank: SkillBank = {
    skill: 'N1',
    passages: [
      pass('pa', ['The race is on Friday.', 'The club calibrates the sensor.'], [{ word: 'calibrates', means: 'checks that a tool measures right', pic: '📏' }]),
      pass('pb', ['A periwinkle sat on the rock at low tide.'], [{ word: 'periwinkle', means: 'a small sea snail', pic: '🐌' }, { word: 'tide', means: 'the rise and fall of the sea', pic: '🌊' }]),
      pass('pc', ['Sam walked home.']),
    ],
    items: [item('ia', 'pa'), item('ib', 'pb'), item('ic', 'pc'), item('im', 'pc')],
    model: { item: 'im', steps: [{ say: '1' }, { say: '2' }, { say: '3', reveal: true }] },
  };
  const pool = buildPool([bank]);
  const ia = pool.items.get('ia')!, ic = pool.items.get('ic')!;

  it('pre-teaches a word from today\'s texts, in its sentence, with two other meanings as wrong options', () => {
    const w = planWord(pool, [ic, ia], [], mulberry32(1))!;
    expect(w.word).toBe('calibrates');
    expect(w.sentence).toBe('The club calibrates the sensor.');
    expect(w.options[w.answer]).toBe('checks that a tool measures right');
    expect(new Set(w.options).size).toBe(3);
  });

  it('brings back a word he tapped before, and has no card when nothing is glossed', () => {
    expect(planWord(pool, [ic], ['periwinkle'], mulberry32(1))?.word).toBe('periwinkle');
    expect(planWord(pool, [ic], [], mulberry32(1))).toBeUndefined();
  });
});

describe('check-up flights (LTF-14)', () => {
  const pass = (pid: string): Passage => ({ id: pid, title: pid, kind: 'story', sentences: ['A.'], topics: ['school'], level: 2, socialLoad: 0,
    credit: { title: pid, author: 'x', source: 'x', licence: 'original', retrieved: '2026-10-13', adapted: false } });
  const item = (iid: string, skill: SkillId, checkup?: string): Item =>
    ({ id: iid, skill, passage: `p-${iid}`, format: 'tap', level: 2, prompt: '?', explain: '.', options: ['a', 'b'], answer: 0, ...(checkup ? { checkup } : {}) });
  const bank = (skill: SkillId, items: Item[]): SkillBank => ({ skill, passages: [...items.map((i) => pass(i.passage)), pass('m')],
    items: [...items, { ...item('model-' + skill, skill), passage: 'm' }], model: { item: 'model-' + skill, steps: [{ say: '1' }, { say: '2' }, { say: '3', reveal: true }] } });
  const n = ['N1', 'N2', 'N3', 'N5', 'N6'] as SkillId[], f = ['F2', 'F3', 'F4', 'F5', 'F6'] as SkillId[];
  const pool = buildPool([
    ...n.map((s) => bank(s, [item(`${s}-a`, s, 'gull'), item(`${s}-b`, s, 'cape'), item(`${s}-practice`, s)])),
    ...f.map((s) => bank(s, [item(`${s}-a`, s, 'gull'), item(`${s}-b`, s, 'cape'), item(`${s}-practice`, s)])),
  ]);
  const ctx = (seen = new Map<string, number>()) => ({ pool, seen, interests: [], allowThemes: false, rng: mulberry32(5) });

  it('never serves a check-up text in practice', () => {
    for (const s of [...n, ...f]) expect(pickItems(ctx(), s, 10).map((i) => i.id)).toEqual([`${s}-practice`]);
  });

  it('draws six texts from the stop he is at, three stories and three functional texts, unseen first', () => {
    const c = planCheckup(ctx(new Map([['N1-a', T0]])), 'gull');
    expect(c).toHaveLength(6);
    expect(c.every((i) => i.checkup === 'gull')).toBe(true);
    expect(c.filter((i) => i.skill[0] === 'N')).toHaveLength(3);
    expect(c.map((i) => i.id)).not.toContain('N1-a'); // seen: four other unseen stories come first
  });

  it('keeps check-up answers out of his skill records, and offers one every ten finished sessions', () => {
    const cu = (t: number, sid: string): LogEvent[] => [
      { id: id(), ts: t, type: 'session', session: sid, action: 'start', strand: 'narrative', checkup: true },
      { id: id(), ts: t + 1, type: 'answer', session: sid, item: 'N1-a', skill: 'N1', phase: 'checkup', correct: true, hint: 0, tries: 1, ms: 1, format: 'tap', level: 2 },
      { id: id(), ts: t + 2, type: 'answer', session: sid, item: 'F2-a', skill: 'F2', phase: 'checkup', correct: false, hint: 0, tries: 1, ms: 1, format: 'tap', level: 2 },
      { id: id(), ts: t + 3, type: 'session', session: sid, action: 'finish' },
    ];
    const nine = Array.from({ length: 9 }, (_, k) => session(T0 + k * DAY, 'N1', [true])).flat();
    expect(checkupDue(derive(nine))).toBe(false);
    const ten = [...nine, ...session(T0 + 9 * DAY, 'N1', [true])];
    expect(checkupDue(derive(ten))).toBe(true);
    const after = [...ten, ...cu(T0 + 10 * DAY, 'c1')];
    const p = derive(after);
    expect(checkupDue(p)).toBe(false); // just had one
    expect(p.skills.N1.answers.some((a) => a.phase === 'checkup')).toBe(false);
    expect(p.seen.has('N1-a')).toBe(true);
    expect(checkupResults(after)).toEqual([{ ts: T0 + 10 * DAY, correct: 1, total: 2 }]);
  });
});

describe('pacing for a learner who locks skills in quickly', () => {
  const passage = (pid: string, level: number): Passage => ({
    id: pid, title: pid, kind: 'story', sentences: ['A.'], topics: ['school'], level, socialLoad: 0,
    credit: { title: pid, author: 'x', source: 'x', licence: 'original', retrieved: '2026-10-12', adapted: false },
  });
  const levels = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5];
  const bank: SkillBank = {
    skill: 'N1',
    passages: [1, 2, 3, 4, 5].map((l) => passage('p' + l, l)),
    items: [
      { id: 'm', skill: 'N1', passage: 'p1', format: 'tap', level: 1, prompt: '?', explain: '.', options: ['a', 'b'], answer: 0 },
      ...levels.map((l, k) => ({ id: `i${k}`, skill: 'N1' as SkillId, passage: 'p' + l, format: 'tap' as const, level: l, prompt: '?', explain: '.', options: ['a', 'b'], answer: 0, transfer: k % 3 === 0 })),
    ],
    model: { item: 'm', steps: [{ say: '1' }, { say: '2' }, { say: '3', reveal: true }] },
  };
  const pool = buildPool([bank]);
  const ctx = () => ({ pool, seen: new Map<string, number>(), interests: [], allowThemes: false, rng: mulberry32(3) });
  /** One session of your-turn answers, each [level, right first time, transfer]. */
  function run(ts: number, answers: [number, boolean, boolean?][]): LogEvent[] {
    const sid = id();
    let t = ts;
    return [
      { id: id(), ts, type: 'session', session: sid, action: 'start', strand: 'narrative', skill: 'N1' },
      ...answers.map(([level, correct, transfer]): LogEvent => ({ id: id(), ts: (t += 1000), type: 'answer', session: sid, item: `x${id()}`, skill: 'N1', phase: 'yourturn', correct, hint: correct ? 0 : 1, tries: 1, ms: 1, format: 'tap', level, transfer: !!transfer })),
      { id: id(), ts: t + 1000, type: 'session', session: sid, action: 'finish' },
    ];
  }

  it('climbs a level after three right in a row, and steps down after a miss, so he stays near 80% right (DW 2026-10-14)', () => {
    const at = (ev: LogEvent[]) => levelFor(derive(ev).skills.N1, pool);
    const right = (level: number, n = 3): [number, boolean][] => Array.from({ length: n }, () => [level, true]);
    expect(at([])).toBe(1);
    expect(at(run(T0, right(1, 2)))).toBe(1);
    expect(at(run(T0, right(1)))).toBe(2);
    expect(at(run(T0, [...right(1), ...right(2), ...right(3), ...right(4)]))).toBe(5);
    expect(at(run(T0, [...right(1), [2, false]]))).toBe(1);
    expect(at(run(T0, [...right(1), [2, true], [2, false], [2, true], [2, true]]))).toBe(1); // a miss breaks the run
    expect(at(run(T0, [...right(1), [1, false], [1, false]]))).toBe(2); // misses on easier texts do not count
    // The highest level he has reached stays, so climbing back to it is not a new unlock.
    const bounce = derive(run(T0, [...right(1), ...right(2), [3, false], ...right(2)])).skills.N1;
    expect([levelFor(bounce, pool), levelPeak(bounce, pool)]).toEqual([3, 3]);
    expect(levelPeak(derive(run(T0, [...right(1), ...right(2), [3, false]])).skills.N1, pool)).toBe(3);
  });

  it('moves only on his own answers: a guided answer after the clue showed by itself, or an inference check, never steps him down', () => {
    const ans = (sid: string, ts: number, phase: string, correct: boolean): LogEvent =>
      ({ id: id(), ts, type: 'answer', session: sid, item: `x${id()}`, skill: 'N1', phase: phase as never, correct, hint: correct ? 0 : 1, tries: 1, ms: 1, format: 'tap', level: 2 });
    const climbed = run(T0, [[1, true], [1, true], [1, true]]); // level 2
    const guided = [ans('g', T0 + DAY, 'together', false), ans('g', T0 + DAY + 1, 'gatecheck', false)];
    expect(levelFor(derive([...climbed, ...guided]).skills.N1, pool)).toBe(2);
    expect(levelFor(derive([...climbed, ans('w', T0 + DAY, 'warmup', false)]).skills.N1, pool)).toBe(1); // a review is his own answer
  });

  it('never serves a harder level than he has reached, and serves his own level first', () => {
    const picked = pickItems(ctx(), 'N1', 4, { level: 3 });
    expect(Math.max(...picked.map((i) => i.level))).toBe(3);
    expect(picked[0].level).toBe(3);
    expect(pickItems(ctx(), 'N1', 20, { level: 2 }).every((i) => i.level <= 2)).toBe(true);
  });

  it('fast-tracks mastery after one flawless session that reaches level 3 with a new format', () => {
    const strong = run(T0, [[3, true], [3, true], [3, true], [3, true, true]]);
    expect(derive(strong).skills.N1.status).toBe('mastered');
    expect(derive(strong, { fastTrack: false }).skills.N1.status).toBe('learning');
    expect(derive(run(T0, [[2, true], [2, true], [2, true], [2, true, true]])).skills.N1.status).toBe('learning');
    expect(derive(run(T0, [[3, true], [3, true], [3, false], [3, true, true]])).skills.N1.status).toBe('learning');
  });

  it('knows when a skill is new to him, for the clue at once on its first guided item (LTF-01)', () => {
    expect(planSession(derive([]), ctx(), 'narrative', T0, 4).newSkill).toBe(true);
    expect(planSession(derive(run(T0, [[1, false]])), ctx(), 'narrative', T0 + DAY, 4).newSkill).toBe(false);
  });

  it('skips the worked example once he has solved one, and guided practice once he is independent', () => {
    const fresh = planSession(derive([]), ctx(), 'narrative', T0, 4);
    expect(fresh.skipWatch).toBe(false);
    expect(fresh.model).toBeDefined();
    expect(fresh.together.length).toBeGreaterThan(0);

    const solvedOne = derive(run(T0, [[1, false], [1, true]]));
    const p1 = planSession(solvedOne, ctx(), 'narrative', T0 + DAY, 4);
    expect(p1.skipWatch).toBe(true);
    expect(p1.model).toBeUndefined();

    // Solving the skill's scouting question counts too: a learner who scouted well is not shown the demo.
    const scouted = derive([{ id: id(), ts: T0, type: 'answer', session: 'placement', item: 'i0', skill: 'N1', phase: 'placement', correct: true, hint: 0, tries: 1, ms: 1, format: 'tap' }]);
    expect(planSession(scouted, ctx(), 'narrative', T0 + DAY, 4).skipWatch).toBe(true);
    const missedScout = derive([{ id: id(), ts: T0, type: 'answer', session: 'placement', item: 'i0', skill: 'N1', phase: 'placement', correct: false, hint: 0, tries: 1, ms: 1, format: 'tap' }]);
    expect(planSession(missedScout, ctx(), 'narrative', T0 + DAY, 4).skipWatch).toBe(false);

    const independent = derive(run(T0, [[1, true], [1, true], [1, true], [2, true], [2, true], [2, true], [3, true]]));
    const p2 = planSession(independent, ctx(), 'narrative', T0 + DAY, 4);
    expect(p2.skipTogether).toBe(true);
    expect(p2.together).toHaveLength(0);
    expect(p2.yourturn).toHaveLength(6); // two more of his own instead
    expect(p2.yourturn.every((i) => i.level <= p2.level)).toBe(true);
  });
});

describe('the miss-pattern report (LTF-09, LTF-10, LTF-12)', () => {
  it('names a new question kind once he misses it at least twice, and at least half the time', () => {
    const items = new Map([
      ['k1', { tags: ['know-think'] }], ['k2', { tags: ['know-think', 'false-belief'] }], ['k3', { tags: ['know-think'] }],
      ['q1', { tags: ['quantifier'] }], ['q2', { tags: ['quantifier'] }], ['a1', { tags: ['act'] }],
    ]);
    const a = (item: string, correct: boolean) => ({ id: id(), ts: T0, type: 'answer', session: 's', item, skill: 'N5', phase: 'yourturn', correct, hint: 0, tries: 1, ms: 1, format: 'tap' });
    const s = { answers: [a('k1', false), a('k2', false), a('k3', true), a('q1', false), a('q2', true), a('a1', false)] };
    const pats = errorPatterns(s as never, { items } as never);
    expect(pats.map((p) => p.tag)).toEqual(['know-think']); // one miss each on quantifier, act and false-belief is not a pattern yet
    expect(pats[0]).toMatchObject({ tag: 'know-think', missed: 2, total: 3 });
  });
});

describe('understand the message, then act on it (LTF-12)', () => {
  const passage = (pid: string): Passage => ({ id: pid, title: pid, kind: 'message', sentences: ['A message.'], topics: ['friends'], level: 2, socialLoad: 0,
    credit: { title: pid, author: 'a', source: 's', licence: 'original', retrieved: '2026-10-13', adapted: false } });
  const item = (iid: string, pid: string, extra: Partial<Item> = {}): Item =>
    ({ id: iid, skill: 'F5', passage: pid, format: 'tap', level: 2, prompt: '?', explain: '.', options: ['a', 'b'], answer: 0, ...extra });
  const bank: SkillBank = {
    skill: 'F5', passages: [passage('m1'), passage('m2'), passage('other')],
    items: [
      item('read1', 'm1', { tags: ['message'] }), item('act1', 'm1', { tags: ['act'], after: 'read1' }),
      item('read2', 'm2', { tags: ['message'] }), item('act2', 'm2', { tags: ['act'], after: 'read2' }),
      item('o1', 'other'), item('o2', 'other'), item('model', 'other'),
    ],
    model: { item: 'model', steps: [{ say: '1' }, { say: '2' }, { say: '3', reveal: true }] },
  };
  const pool = buildPool([bank]);
  const ctx = (rng: () => number, o: Partial<Parameters<typeof pickItems>[0]> = {}) => ({ pool, seen: new Map(), interests: [], allowThemes: false, rng, ...o });

  it('serves each act step right after its message step, and never on its own', () => {
    for (let seed = 1; seed <= 40; seed++) for (const count of [1, 2, 3, 4, 6]) {
      const ids = pickItems(ctx(mulberry32(seed)), 'F5', count).map((i) => i.id);
      for (const [read, act] of [['read1', 'act1'], ['read2', 'act2']]) {
        if (ids.includes(act)) expect(ids[ids.indexOf(act) - 1], `seed ${seed}, ${ids}`).toBe(read);
        if (ids.includes(read)) expect(ids[ids.indexOf(read) + 1], `seed ${seed}, ${ids}`).toBe(act); // the second step always follows
      }
      expect(ids.length, `seed ${seed}, ${ids}`).toBeLessThanOrEqual(count + 1); // at most one over, never a split pair
    }
    // Even when the message step is hidden, its act step is not served alone.
    const ids = pickItems(ctx(mulberry32(3), { hidden: new Set(['read1', 'read2']) }), 'F5', 6).map((i) => i.id);
    expect(ids).not.toContain('act1');
    expect(ids).not.toContain('act2');
  });

  it('reports "understood the message" and "did the right thing" as two lines, on first-time answers', () => {
    const a = (item: string, correct: boolean): LogEvent => ({ id: id(), ts: T0 + n * 1000, type: 'answer', session: 's', item, skill: 'F5', phase: 'yourturn', correct, hint: 0, tries: 1, ms: 1, format: 'tap' });
    const p = derive([a('read1', true), a('act1', false), a('read2', true), a('act2', true), a('act1', true)]); // the second act1 is a repeat
    expect(tagAccuracy(p, pool, 'message', { firstTimeOnly: true })).toEqual({ correct: 2, total: 2 });
    expect(tagAccuracy(p, pool, 'act', { firstTimeOnly: true })).toEqual({ correct: 1, total: 2 });
  });
});
