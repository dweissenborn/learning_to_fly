// LTF-40: typed math answers, judged by exact arithmetic. Equivalent forms count unless the problem asks for one form,
// and the usual wrong answers are recognised by name, so the feedback can say what happened.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@wayfinder/engine';
import { judge, makeProblem, MATH_SKILLS, type MathProblem } from './math';

const p = (o: Partial<MathProblem> & Pick<MathProblem, 'op'>): MathProblem => ({ skill: 'math:FR3', a: [6, 8], b: [1, 1], form: 'any', shape: 'fraction', prompt: '', ...o });

describe('judging typed answers (LTF-40)', () => {
  it('counts equivalent forms as right when any form will do', () => {
    const q = p({ op: 'mul', a: [3, 4], b: [1, 1] }); // 3/4
    expect(judge(q, { num: '3', den: '4' }).right).toBe(true);
    expect(judge(q, { num: '6', den: '8' }).right).toBe(true);
    expect(judge(q, { num: '03', den: '04' }).right).toBe(true); // extra zeros
    expect(judge(q, { num: '4', den: '3' }).right).toBe(false);
  });
  it('mixed numbers and improper fractions are the same number', () => {
    const q = p({ op: 'mul', a: [3, 2], b: [1, 1] }); // 3/2
    expect(judge(q, { whole: '1', num: '1', den: '2' }).right).toBe(true);
    expect(judge(q, { num: '3', den: '2' }).right).toBe(true);
    expect(judge(p({ op: 'mul', a: [4, 2], b: [1, 1] }), { whole: '2' }).right).toBe(true); // a whole number
  });
  it('asks for simplest form only when the problem says so, and names the miss', () => {
    const q = p({ op: 'simplify', a: [6, 8], form: 'simplest' });
    expect(judge(q, { num: '3', den: '4' }).right).toBe(true);
    expect(judge(q, { num: '6', den: '8' })).toEqual({ right: false, error: 'not-simplest' });
    expect(judge(p({ op: 'simplify', a: [12, 16], form: 'simplest' }), { num: '6', den: '8' })).toEqual({ right: false, error: 'not-simplest' });
  });
  it('a mixed number when the problem asks for one, an improper fraction when it asks for that', () => {
    const toMixed = p({ op: 'tomixed', a: [11, 4], form: 'mixed', shape: 'mixed' });
    expect(judge(toMixed, { whole: '2', num: '3', den: '4' }).right).toBe(true);
    expect(judge(toMixed, { num: '11', den: '4' })).toEqual({ right: false, error: 'not-mixed' });
    const toImproper = p({ op: 'toimproper', a: [11, 4], form: 'improper' }); // 2 3/4
    expect(judge(toImproper, { num: '11', den: '4' }).right).toBe(true);
    expect(judge(toImproper, { num: '5', den: '4' })).toEqual({ right: false, error: 'added-whole' }); // (2 + 3)/4
  });
  it('dividing fractions by keep, change, flip, and the two usual slips', () => {
    const q = p({ op: 'div', a: [2, 3], b: [3, 4] }); // 2/3 ÷ 3/4 = 8/9
    expect(judge(q, { num: '8', den: '9' }).right).toBe(true);
    expect(judge(q, { num: '6', den: '12' })).toEqual({ right: false, error: 'no-flip' }); // multiplied instead
    expect(judge(q, { num: '9', den: '8' })).toEqual({ right: false, error: 'flipped-first' }); // flipped the first fraction
  });
  it('multiplying fractions: across the top and across the bottom', () => {
    const q = p({ op: 'mul', a: [2, 3], b: [4, 5] }); // 8/15
    expect(judge(q, { num: '8', den: '15' }).right).toBe(true);
    expect(judge(q, { num: '6', den: '8' })).toEqual({ right: false, error: 'added-across' });
    expect(judge(q, { num: '10', den: '12' })).toEqual({ right: false, error: 'cross-multiplied' });
  });
  it('equivalent fractions: multiplying, not adding', () => {
    const q = p({ op: 'equiv', a: [2, 3], b: [12, 1] }); // 2/3 = ?/12
    expect(judge(q, { num: '8', den: '12' }).right).toBe(true);
    expect(judge(q, { num: '11', den: '12' })).toEqual({ right: false, error: 'added-not-multiplied' });
  });
  it('division with a remainder: the remainder is smaller than the divisor', () => {
    const q = p({ op: 'divrem', a: [17, 1], b: [5, 1], shape: 'remainder' });
    expect(judge(q, { whole: '3', rem: '2' }).right).toBe(true);
    expect(judge(q, { whole: '2', rem: '7' })).toEqual({ right: false, error: 'remainder-too-big' });
  });
  it('facts and factors', () => {
    const fact = p({ op: 'fact', a: [7, 1], b: [8, 1], shape: 'whole' });
    expect(judge(fact, { whole: '56' }).right).toBe(true);
    expect(judge(fact, { whole: '49' })).toEqual({ right: false, error: 'neighbour-fact' }); // 7 × 7
    const gcf = p({ op: 'gcf', a: [12, 1], b: [18, 1], shape: 'whole' });
    expect(judge(gcf, { whole: '6' }).right).toBe(true);
    expect(judge(gcf, { whole: '3' })).toEqual({ right: false, error: 'not-greatest' });
  });
  it('an unfinished answer is neither right nor wrong', () => {
    const q = p({ op: 'mul', a: [2, 3], b: [4, 5] });
    expect(judge(q, { num: '8' })).toEqual({ right: false, incomplete: true });
    expect(judge(q, { num: '8', den: '0' })).toEqual({ right: false, incomplete: true });
  });
});

describe('fresh plain problems (LTF-40)', () => {
  it('every skill makes problems whose own answer is judged right, with new numbers each time', () => {
    const rng = mulberry32(42);
    for (const skill of MATH_SKILLS) {
      const seen = new Set<string>();
      for (let k = 0; k < 40; k++) {
        const q = makeProblem(skill, rng);
        expect(q.skill).toBe(skill);
        expect(judge(q, q.answer!).right, `${skill}: ${q.prompt}`).toBe(true);
        seen.add(q.prompt + JSON.stringify(q.bar ?? {})); // FR1 varies its picture, not its words
      }
      expect(seen.size, skill).toBeGreaterThan(10);
    }
  });
});
