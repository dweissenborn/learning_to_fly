import { describe, expect, it } from 'vitest';
import { askable, buildAsks, buildDaySentences, buildStrip, ownAnswer, skippedKeys, starter, type Part } from './recount';

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

describe('his day as a four-panel strip (LTF-06)', () => {
  const o = { stage: 1, why: false };
  it('lays a part of his day out as Before, What happened, After and How I felt', () => {
    const p: Part = { lesson: math, who: 'my class', what: 'did fractions', hard: 'I got stuck', afterHard: 'I asked for help', feeling: 'proud' };
    expect(buildStrip(p, { weekend: false }).map((x) => [x.label, x.text])).toEqual([
      ['Before', 'In Math, I was with my class.'],
      ['What happened', 'I did fractions. Something hard: I got stuck.'],
      ['After', 'After that, I asked for help.'],
      ['How I felt', 'I felt proud.'],
    ]);
  });

  it('leaves a panel empty when he skipped it, and changing a panel asks only its own questions', () => {
    const strip = buildStrip({ lesson: math, what: 'did fractions', hard: 'nothing was hard' }, { weekend: false });
    expect(strip.map((x) => x.text)).toEqual([undefined, 'I did fractions.', undefined, undefined]);
    expect(strip.map((x) => x.keys)).toEqual([['who'], ['what', 'hard'], ['afterDone', 'afterHard'], ['feeling', 'why']]);
  });

  it('counts skipped questions from his final answers, so changing one later is not counted twice', () => {
    expect(skippedKeys([{ lesson: math, what: 'did fractions', hard: 'I got stuck' }], o)).toEqual(['who', 'feeling', 'afterHard']);
    expect(skippedKeys([{ lesson: math, who: 'a friend', what: 'did fractions', feeling: 'calm', hard: 'nothing was hard' }], o)).toEqual([]);
  });
});

describe('his own words after a sentence starter (LTF-07)', () => {
  it('starts the sentence his answer finishes', () => {
    expect(starter('what', { lesson: math }, { weekend: false })).toBe('In Math, I');
    expect(starter('why', { lesson: math, feeling: 'proud' }, { weekend: false })).toBe('I felt proud because');
    const p: Part = { lesson: math, who: ownAnswer('who', 'my cousin.'), feeling: ownAnswer('feeling', 'happy') };
    expect(buildStrip(p, { weekend: false }).map((x) => x.text)).toEqual(['In Math, I was with my cousin.', undefined, undefined, 'I felt happy.']);
  });

  it('reads "no" to the hard question as nothing was hard', () => {
    expect(ownAnswer('hard', 'No')).toBe('nothing was hard');
    expect(ownAnswer('hard', 'nothing really!')).toBe('nothing was hard');
    expect(ownAnswer('hard', 'the fire drill was loud')).toBe('the fire drill was loud');
    expect(ownAnswer('hard', 'nobody sat with me')).toBe('nobody sat with me');
  });
});
