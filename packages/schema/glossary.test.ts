import { describe, expect, it } from 'vitest';
import { glossProblems } from './glossary.mjs';

const passage = (o: object = {}) => ({ id: 'n1-p99', level: 4, sentences: ['The robotics club calibrates the sensor before each race.', 'It takes ten minutes.'], ...o });
const gloss = (word: string, means = 'checks that a tool measures the right amount') => ({ word, means, pic: '📏' });

describe('word help in the content bank (LTF-04)', () => {
  it('accepts up to three words that appear in a level 3 to 5 passage, with a short meaning', () => {
    expect(glossProblems(passage({ words: [gloss('calibrates'), gloss('sensor', 'a part that notices light, heat or movement')] }))).toEqual([]);
    expect(glossProblems(passage())).toEqual([]);
  });

  it('finds a word that is not in the passage, as a whole word', () => {
    expect(glossProblems(passage({ words: [gloss('measures', 'finds out how big something is')] }))).toEqual(['word "measures" is not in the passage']);
    expect(glossProblems(passage({ words: [gloss('calibrate')] }))).toEqual(['word "calibrate" is not in the passage']);
  });

  it('keeps word help to harder texts, three words, short meanings that do not use the word', () => {
    expect(glossProblems(passage({ level: 2, words: [gloss('calibrates')] }))).toEqual(['word help is for level 3 to 5 texts']);
    expect(glossProblems(passage({ words: ['calibrates', 'sensor', 'robotics', 'minutes'].map((w) => gloss(w)) }))).toContain('at most three words a passage');
    expect(glossProblems(passage({ words: [gloss('calibrates', 'the act of calibration on a tool')] }))).toEqual(['meaning of "calibrates" uses the word itself']);
    expect(glossProblems(passage({ words: [gloss('calibrates', 'one two three four five six seven eight nine ten eleven twelve thirteen')] }))).toEqual(['meaning of "calibrates" has more than 12 words']);
    expect(glossProblems(passage({ words: [gloss('sensor', 'a part'), gloss('sensor', 'a part')] }))).toEqual(['word "sensor" is glossed twice']);
  });
});
