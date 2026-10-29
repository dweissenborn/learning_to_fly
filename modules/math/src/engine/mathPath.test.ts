// LTF-41: the math skills' dependency graph, gates that show as "coming up", a check-in that places him, mastery, and a
// re-check of what a skill depends on when it stalls.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@wayfinder/schema';
import { checkinNext, deriveMath, MATH_GRAPH, mathReport } from './mathPath';

let n = 0;
const DAY = 86_400_000, T0 = new Date('2026-10-01T16:00:00').getTime();
/** A math answer: first try right or not, in a phase, on a day. */
const ans = (skill: string, correct: boolean, phase = 'yourturn', day = 0, session = `s${day}`, extra: object = {}) =>
  ({ id: `a${n++}`, ts: T0 + day * DAY + n, type: 'answer', session, item: `gen-${n}`, skill: `math:${skill}`, phase, correct, hint: 0, tries: 1, ms: 9000, format: 'keypad', module: 'math', ...extra }) as unknown as LogEvent;
const chose = (skill: string, day: number, ...right: boolean[]) => right.map((r) => ans(skill, r, 'yourturn', day, `c${day}`, { format: 'choices' }));
const probe = (skill: string, ...right: boolean[]) => right.map((r) => ans(skill, r, 'placement', 0, 'checkin'));

describe('the math path (LTF-41)', () => {
  it('a skill opens when what it depends on is mastered or placed, or a grown-up opens it early', () => {
    expect(MATH_GRAPH['math:FR6']).toEqual(['math:FR3', 'math:FR4', 'math:FR5']);
    const m = deriveMath([], {});
    expect(m.skills['math:MF1'].open).toBe(true);
    expect(m.skills['math:FR3'].open).toBe(false); // coming up
    expect(deriveMath([], { opened: ['math:FR3'] }).skills['math:FR3'].open).toBe(true);
  });

  it('the check-in starts one step below the target, moves up while he is right, and branches down after a miss', () => {
    expect(checkinNext([], {})).toBe('math:FR2');
    const up = deriveMath(probe('FR2', true, true), {});
    expect(up.skills['math:FR2'].placed && up.skills['math:FR1'].placed && up.skills['math:MF1'].placed).toBe(true); // passing implies what it rests on
    expect(up.checkin.next).toBe('math:MF2');
    const down = deriveMath(probe('FR2', true, false), {});
    expect(down.skills['math:FR2'].placed).toBe(false);
    expect(down.checkin.next).toBe('math:MF1'); // what FR2 rests on
    expect(deriveMath([...probe('FR2', true, false), ...probe('MF1', true, true)], {}).checkin.next).toBe('math:FR1'); // still below the miss, not up to MF2
  });

  it('a grown-up start point means the check-in only confirms those skills', () => {
    const known = ['math:MF1', 'math:FR2'];
    expect(deriveMath([], { known }).checkin.next).toBe('math:MF1');
    const m = deriveMath([...probe('MF1', true, true), ...probe('FR2', true, true)], { known });
    expect(m.checkin.done).toBe(true);
  });

  it('placed is provisional: a missed first review takes it back', () => {
    const placed = probe('MF1', true, true);
    expect(deriveMath(placed, {}).skills['math:MF1'].placed).toBe(true);
    expect(deriveMath([...placed, ans('MF1', true, 'warmup', 5)], {}).skills['math:MF1'].placed).toBe(true);
    expect(deriveMath([...placed, ans('MF1', false, 'warmup', 5)], {}).skills['math:MF1'].placed).toBe(false);
    expect(deriveMath([...placed, ...[false, true, true].map((r) => ans('MF1', r, 'warmup', 5, 'r5'))], {}).skills['math:MF1'].placed).toBe(true); // two of three, the first one missed
  });

  it('mastery: 80% or better across two sessions on different days, on answers right first time', () => {
    const one = [true, true, true, true, false].map((r) => ans('MF1', r, 'yourturn', 1));
    expect(deriveMath(one, {}).skills['math:MF1'].mastered).toBe(false); // one day is not enough
    const two = [...one, ...[true, true, true, true, true].map((r) => ans('MF1', r, 'yourturn', 2))];
    expect(deriveMath(two, {}).skills['math:MF1'].mastered).toBe(true);
    expect(deriveMath(two, {}).focus).toBe('math:MF2');
  });

  it('a new skill starts with three choices, and typed answers take over once he gets 80% with choices (LTF-43)', () => {
    expect(deriveMath([], {}).skills['math:MF1'].choices).toBe(true);
    const weak = chose('MF1', 1, true, false, true, false);
    expect(deriveMath(weak, {}).skills['math:MF1'].choices).toBe(true); // 50%: choices again next time
    const strong = [...weak, ...chose('MF1', 2, true, true, true, true, false)];
    expect(deriveMath(strong, {}).skills['math:MF1'].choices).toBe(false); // 80%: typed from now on
    expect(deriveMath(chose('MF1', 1, true), {}).skills['math:MF1'].choices).toBe(true); // one answer is too few to judge
    expect(deriveMath([ans('MF1', false, 'yourturn', 1)], {}).skills['math:MF1'].choices).toBe(false); // once typed, typed stays
  });

  it('only typed answers right first time count toward mastery: never choices, help or guesses (LTF-43)', () => {
    const allRight = (day: number, extra: object) => [true, true, true, true].map((r) => ans('MF1', r, 'yourturn', day, `s${day}`, extra));
    expect(deriveMath([...allRight(1, { format: 'choices' }), ...allRight(2, { format: 'choices' })], {}).skills['math:MF1'].mastered).toBe(false);
    const typed = [...allRight(1, {}), ...allRight(2, {})];
    expect(deriveMath(typed, {}).skills['math:MF1'].mastered).toBe(true);
    // A helped answer is a miss for mastery, even if it was marked right; a guess is set aside and counts for nothing.
    const helped = [true, false, false].map((r) => ans('MF1', true, 'yourturn', 2, 's2', { hint: r ? 0 : 2 }));
    expect(deriveMath([...allRight(1, {}), ...helped], {}).skills['math:MF1'].mastered).toBe(false);
    const guesses = [false, false, false].map((r) => ans('MF1', r, 'yourturn', 2, 's2', { rapid: true }));
    expect(deriveMath([...typed, ...guesses], {}).skills['math:MF1'].mastered).toBe(true);
    expect(deriveMath([...typed, ...guesses], {}).skills['math:MF1'].sessions.at(-1)).toMatchObject({ correct: 4, total: 4 });
  });

  it('with story problems on, a pilot step also needs an independent right answer in each view (LTF-42)', () => {
    const base = [...probe('FR1', true, true), ...probe('MF1', true, true)]; // FR2 is open
    const plain = [1, 2].flatMap((d) => [true, true, true, true, true].map((r) => ans('FR2', r, 'yourturn', d)));
    expect(deriveMath([...base, ...plain], {}).skills['math:FR2'].mastered).toBe(true); // stories off: as before
    expect(deriveMath([...base, ...plain], { stories: true }).skills['math:FR2'].mastered).toBe(false); // no story answer yet
    const told = [...base, ...plain, ans('FR2', true, 'yourturn', 3, 's3', { view: 'story' })];
    expect(deriveMath(told, { stories: true }).skills['math:FR2'].mastered).toBe(true);
    expect(deriveMath([...base, ...plain, ans('FR2', true, 'yourturn', 3, 's3', { view: 'story', hint: 1 })], { stories: true }).skills['math:FR2'].mastered).toBe(false); // helped
    const mf = [1, 2].flatMap((d) => [true, true, true, true, true].map((r) => ans('MF2', r, 'yourturn', d)));
    expect(deriveMath([...base, ...mf], { stories: true }).skills['math:MF2'].mastered).toBe(true); // outside the pilot
  });

  it('a missed review sends a mastered skill back to practice until a session at 80% restores it, as in reading', () => {
    const two = [1, 2].flatMap((d) => [true, true, true, true, true].map((r) => ans('MF1', r, 'yourturn', d)));
    const missed = [...two, ans('MF1', false, 'warmup', 5)];
    expect(deriveMath(missed, {}).skills['math:MF1'].relearn).toBe(true);
    expect(deriveMath(missed, {}).focus).toBe('math:MF1');
    expect(deriveMath([...two, ans('MF1', true, 'warmup', 5)], {}).skills['math:MF1'].relearn).toBe(false);
    // A review is three problems and passes at two right, as in reading (DW 2026-10-28).
    expect(deriveMath([...two, ...[true, true, false].map((r) => ans('MF1', r, 'warmup', 5, 'r5'))], {}).skills['math:MF1'].relearn).toBe(false); // two of three, the last one missed
    expect(deriveMath([...two, ...[false, false, true].map((r) => ans('MF1', r, 'warmup', 5, 'r5'))], {}).skills['math:MF1'].relearn).toBe(true); // one of three, the last one right
    const restored = [...missed, ...[true, true, true].map((r) => ans('MF1', r, 'yourturn', 6))];
    expect(deriveMath(restored, {}).skills['math:MF1'].relearn).toBe(false);
    expect(deriveMath(restored, {}).focus).toBe('math:MF2');
  });

  it('when a skill stalls, what it depends on is checked again, and a miss there becomes the focus', () => {
    const base = [...probe('FR2', true, true), ...probe('MF2', true, true)]; // FR3 is open
    const stalled = [...base, ...[false, false, true].map((r) => ans('FR3', r, 'yourturn', 1)), ...[false, true, false].map((r) => ans('FR3', r, 'yourturn', 2))];
    const m = deriveMath(stalled, {});
    expect(m.recheck).toEqual(['math:FR2', 'math:MF2']);
    const after = deriveMath([...stalled, ans('FR2', true, 'recheck', 3), ans('FR2', true, 'recheck', 3), ans('MF2', true, 'recheck', 3), ans('MF2', false, 'recheck', 3)], {});
    expect(after.recheck).toEqual([]);
    expect(after.focus).toBe('math:MF2');
  });
});

describe('what the grown-ups see in math (LTF-44)', () => {
  const ses = (session: string, action: string, extra: object = {}) => ({ id: `e${n++}`, ts: T0 + n, type: 'session', session, action, module: 'math', ...extra }) as unknown as LogEvent;
  const read = (session: string, action: string) => ({ id: `e${n++}`, ts: T0 + n, type: 'session', session, action, strand: 'functional', skill: 'F1' }) as unknown as LogEvent;
  it('reports each step, his own typed answers, help, reviews, breaks, guesses and how often he chose math', () => {
    const ev = [
      ses('s1', 'start'), ...[true, true, true, true, true].map((r) => ans('MF1', r, 'yourturn', 1)), ses('s1', 'finish'),
      ses('s2', 'start'), ...[true, true, true, true, false].map((r) => ans('MF1', r, 'yourturn', 2)), ans('MF1', false, 'yourturn', 2, 's2', { hint: 1 }), ses('s2', 'finish'),
      ans('MF1', true, 'warmup', 5), ans('MF1', false, 'warmup', 12),
      ...chose('MF2', 6, true, false), ans('MF2', false, 'yourturn', 6, 'c6', { rapid: true }),
      ses('s3', 'start'), ses('s3', 'stop', { reason: 'break' }), ses('s4', 'start'), ses('s4', 'stop', { reason: 'rapid' }),
      read('r1', 'start'), read('r1', 'finish'),
    ];
    const r = mathReport(ev, {});
    expect(r.rows.find((x) => x.skill === 'math:MF1')).toMatchObject({ status: 'practising again', typed: { correct: 9, total: 11 }, helped: 1, reviews: { passed: 1, total: 2 } });
    expect(r.rows.find((x) => x.skill === 'math:MF2')).toMatchObject({ status: 'learning, with choices', typed: { correct: 0, total: 0 }, helped: 0 });
    expect(r.rows.find((x) => x.skill === 'math:FR6')!.status).toBe('coming up');
    expect(r).toMatchObject({ started: 4, finished: 2, breaks: 1, guessStops: 1, guesses: 1, ofAllSessions: 5 });
  });
});
