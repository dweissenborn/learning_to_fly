// LTF-41: the math skills' dependency graph, gates that show as "coming up", a check-in that places him, mastery, and a
// re-check of what a skill depends on when it stalls.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@wayfinder/schema';
import { checkinNext, deriveMath, MATH_GRAPH } from './mathPath';

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
