import { describe, expect, it } from 'vitest';
import type { Item, LogEvent, Passage, SkillBank, SkillId } from '@wayfinder/schema';
import {
  buildPool, choices, derive, journeyPosition, levelFor, focusSkill, gate, GATE_SKILLS, mulberry32, pickItems, placementStart, placementSupports, planGateCheck, planSession,
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

  it('counts placement answers as seen but never toward mastery', () => {
    const p = derive([{ id: id(), ts: T0, type: 'answer', session: 'placement', item: 'f2-i01', skill: 'F2', phase: 'placement', correct: true, hint: 0, tries: 1, ms: 1, format: 'tap' }]);
    expect(p.seen.has('f2-i01')).toBe(true);
    expect(p.skills.F2.answers).toHaveLength(0);
    expect(p.skills.F2.status).toBe('new');
  });

  it('turns on read-aloud when listening beats reading', () => {
    expect(placementSupports({ word: 0.9, reading: 1 / 3, listening: 1 })).toEqual({ readAloud: true, pictures: false });
    expect(placementSupports({ word: 0.5, reading: 1, listening: 1 })).toEqual({ readAloud: true, pictures: true });
    expect(placementSupports({ word: 1, reading: 1, listening: 1 })).toEqual({ readAloud: false, pictures: false });
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
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => journeyPosition(n, 6, 7).beat)).toEqual([0, 1, 1, 2, 3, 4, 4]);
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

  it('climbs a level after two right in a row, and steps down after two misses', () => {
    const at = (ev: LogEvent[]) => levelFor(derive(ev).skills.N1, pool);
    expect(at([])).toBe(1);
    expect(at(run(T0, [[1, true], [1, true]]))).toBe(2);
    expect(at(run(T0, [[1, true], [1, true], [2, true], [2, true], [3, true], [3, true], [4, true], [4, true]]))).toBe(5);
    expect(at(run(T0, [[1, true], [1, true], [2, false], [2, false]]))).toBe(1);
    expect(at(run(T0, [[1, true], [1, true], [1, false], [1, false]]))).toBe(2); // misses on easier texts do not count
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

  it('skips the worked example once he has solved one, and guided practice once he is independent', () => {
    const fresh = planSession(derive([]), ctx(), 'narrative', T0, 4);
    expect(fresh.skipWatch).toBe(false);
    expect(fresh.model).toBeDefined();
    expect(fresh.together.length).toBeGreaterThan(0);

    const solvedOne = derive(run(T0, [[1, false], [1, true]]));
    const p1 = planSession(solvedOne, ctx(), 'narrative', T0 + DAY, 4);
    expect(p1.skipWatch).toBe(true);
    expect(p1.model).toBeUndefined();

    const independent = derive(run(T0, [[1, true], [1, true], [2, true], [2, false], [3, true]]));
    const p2 = planSession(independent, ctx(), 'narrative', T0 + DAY, 4);
    expect(p2.skipTogether).toBe(true);
    expect(p2.together).toHaveLength(0);
    expect(p2.yourturn).toHaveLength(6); // two more of his own instead
    expect(p2.yourturn.every((i) => i.level <= p2.level)).toBe(true);
  });
});
