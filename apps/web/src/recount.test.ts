import { describe, expect, it } from 'vitest';
import { askable, buildAsks, buildDaySentences, type Part } from './recount';

const math = { id: 'math', name: 'Math', emoji: '➗', what: ['did fractions'], ask: ['What kind of problems did you do in math?'] };

describe('telling about his day (LTF-05)', () => {
  it('adds what happened after something hard, and after what he did', () => {
    const p: Part = { lesson: math, what: 'did fractions', afterDone: 'we shared our work', feeling: 'proud', hard: 'I got stuck', afterHard: 'I asked for help' };
    expect(buildDaySentences([p], { order: [], weekend: false })).toEqual([
      'In Math, I did fractions.', 'After that, we shared our work.', 'I felt proud.', 'Something hard: I got stuck.', 'After that, I asked for help.',
    ]);
  });

  it('says nothing about after when nothing was hard', () => {
    const s = buildDaySentences([{ lesson: math, what: 'did fractions', hard: 'nothing was hard' }], { order: [], weekend: false });
    expect(s).toEqual(['In Math, I did fractions.']);
  });

  it('asks "after" only after something hard at stage 1, and also after what he did from stage 2', () => {
    const hard: Part = { lesson: math, what: 'did fractions', hard: 'I got stuck' };
    const fine: Part = { lesson: math, what: 'did fractions', hard: 'nothing was hard' };
    expect(askable('afterHard', hard, { stage: 1, why: false })).toBe(true);
    expect(askable('afterHard', fine, { stage: 1, why: false })).toBe(false);
    expect(askable('afterHard', { lesson: math }, { stage: 1, why: false })).toBe(false); // skipped the hard question
    expect(askable('afterDone', hard, { stage: 1, why: false })).toBe(false);
    expect(askable('afterDone', hard, { stage: 2, why: false })).toBe(true);
    expect(askable('afterDone', { lesson: math }, { stage: 2, why: false })).toBe(false); // nothing to come after
  });

  it('turns his answers into specific questions for the grown-up', () => {
    const asks = buildAsks([{ lesson: math, what: 'did fractions', hard: 'I got stuck', afterHard: 'I asked for help' }]);
    expect(asks).toContain('You said: I got stuck. After that, I asked for help. How did that go?');
  });
});
