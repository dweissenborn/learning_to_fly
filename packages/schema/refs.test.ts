import { describe, expect, it } from 'vitest';
import { refProblems } from './refs.mjs';

const passage = (refs: object[]) => ({ id: 'n4-p99', sentences: ['Priya built a rover.', 'She put it on the floor, and it rolled to Sam.', 'He laughed.'], refs });

describe('who\'s who references in the content bank (LTF-03)', () => {
  it('accepts references to pronouns that are there, naming someone or something in the passage', () => {
    expect(refProblems(passage([{ s: 1, w: 'She', n: 1, to: 'Priya' }, { s: 1, w: 'it', n: 2, to: 'the rover' }, { s: 2, w: 'He', n: 1, to: 'Sam' }]))).toEqual([]);
    expect(refProblems({ id: 'x', sentences: ['A.'] })).toEqual([]);
  });

  it('finds a missing pronoun, a missing occurrence, a sentence out of range and a referent not in the passage', () => {
    expect(refProblems(passage([{ s: 0, w: 'she', n: 1, to: 'Priya' }]))).toEqual(['ref: no "she" in sentence 0']);
    expect(refProblems(passage([{ s: 1, w: 'it', n: 3, to: 'the rover' }]))).toEqual(['ref: sentence 1 has only 2 "it"']);
    expect(refProblems(passage([{ s: 5, w: 'he', n: 1, to: 'Sam' }]))).toEqual(['ref: sentence 5 is out of range']);
    expect(refProblems(passage([{ s: 2, w: 'He', n: 1, to: 'Leo' }]))).toEqual(['ref: "Leo" is not in the passage']);
  });
});
