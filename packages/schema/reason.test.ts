import { describe, expect, it } from 'vitest';
import { reasonProblems } from './reason.mjs';

const passage = { sentences: ['Maya stood at the front of the room.', 'Her hands shook as she held the paper.'] };
const reason = { clue: 'Her hands shook as she held the paper.', know: 'Shaking hands can mean a person is nervous.', so: 'So Maya felt nervous.' };
const item = (o: object) => ({ id: 'n5-i180', skill: 'N5', inference: 2, ...o });

describe('reasoning cards in the content bank (LTF-02)', () => {
  it('needs a card on every new N5 and P2 inference-2 item, but not on older, express or easier items', () => {
    expect(reasonProblems(item({}), passage)).toEqual(['needs a reason card (clue, know, so)']);
    expect(reasonProblems(item({ reason }), passage)).toEqual([]);
    expect(reasonProblems(item({ id: 'n5-i12' }), passage)).toEqual([]); // written before the cards
    expect(reasonProblems(item({ inference: 1 }), passage)).toEqual([]);
    expect(reasonProblems(item({ id: 'p2-i90', skill: 'P2', tier: 'express' }), passage)).toEqual([]);
    expect(reasonProblems(item({ id: 'n3-i500', skill: 'N3' }), passage)).toEqual([]);
  });

  it('takes the clue word for word from the passage, and keeps each box to 12 words', () => {
    expect(reasonProblems(item({ reason: { ...reason, clue: 'Her hands were shaking.' } }), passage)).toEqual(['reason clue must be a sentence from the passage']);
    expect(reasonProblems(item({ reason: { ...reason, know: 'When a person has to speak in front of a whole class their hands may shake.' } }), passage))
      .toEqual(['reason know has more than 12 words']);
  });
});
