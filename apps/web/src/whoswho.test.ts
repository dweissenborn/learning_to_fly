import { describe, expect, it } from 'vitest';
import { whosWhoOn, withNames } from './whoswho';

const base = { setting: 'auto' as const, skill: 'N4', mode: 'auto' as const, level: 3, hint: 0, n4Mastered: false };

describe('when the who\'s who dots show (LTF-03)', () => {
  it('shows them in N4 guided practice, and never in N4 practice of his own or the Peak check', () => {
    expect(whosWhoOn(base)).toBe(true);
    expect(whosWhoOn({ ...base, mode: 'request' })).toBe(false); // N4 your turn
    expect(whosWhoOn({ ...base, mode: 'none' })).toBe(false); // the Peak check and scouting
  });

  it('outside N4, only in level 1 and 2 texts', () => {
    expect(whosWhoOn({ ...base, skill: 'N1', mode: 'request', level: 2 })).toBe(true);
    expect(whosWhoOn({ ...base, skill: 'N1', mode: 'request', level: 3 })).toBe(false);
  });

  it('after N4 is mastered, or when set to "on Help only", only once he asks for help; and never when off', () => {
    expect(whosWhoOn({ ...base, n4Mastered: true })).toBe(false);
    expect(whosWhoOn({ ...base, n4Mastered: true, hint: 1 })).toBe(true);
    expect(whosWhoOn({ ...base, setting: 'help' })).toBe(false);
    expect(whosWhoOn({ ...base, setting: 'help', hint: 1 })).toBe(true);
    expect(whosWhoOn({ ...base, setting: 'off', hint: 3 })).toBe(false);
  });
});

describe('names instead of he and she, at level 1 (LTF-03)', () => {
  const r = (w: string, to: string, n = 1) => ({ s: 0, w, n, to });
  it('puts the name or thing in place of each pronoun it knows, with a capital at the start', () => {
    expect(withNames('She put it on the floor, and it rolled to Sam.', 0, [r('She', 'Priya'), r('it', 'the rover'), r('it', 'the rover', 2)]))
      .toBe('Priya put the rover on the floor, and the rover rolled to Sam.');
    expect(withNames('It rolled away.', 0, [r('It', 'the rover')])).toBe('The rover rolled away.');
    expect(withNames('They ran home.', 0, [r('They', 'Sam and Leo')])).toBe('Sam and Leo ran home.');
  });

  it('tells a possessive "her" from "her" as an object', () => {
    expect(withNames('Maya packed her bag.', 0, [r('her', 'Maya')])).toBe("Maya packed Maya's bag.");
    expect(withNames('Ana gave her the ball.', 0, [r('her', 'Maya')])).toBe('Ana gave Maya the ball.');
    expect(withNames('Ben waved to her.', 0, [r('her', 'Maya')])).toBe('Ben waved to Maya.');
    expect(withNames('Sam took his map, and their dog came too.', 0, [r('his', 'Sam'), r('their', 'Sam and Leo')]))
      .toBe("Sam took Sam's map, and Sam and Leo's dog came too.");
  });

  it('leaves alone pronouns it does not know, other sentences, and "himself"', () => {
    expect(withNames('He smiled.', 0, [])).toBe('He smiled.');
    expect(withNames('He smiled.', 1, [r('He', 'Leo')])).toBe('He smiled.');
    expect(withNames('Leo hurt himself.', 0, [r('himself', 'Leo')])).toBe('Leo hurt himself.');
    // What a character says stays word for word: questions quote it.
    expect(withNames('Leo said, "It was a piece of cake!" and he smiled.', 0, [r('It', 'the test'), r('he', 'Leo')]))
      .toBe('Leo said, "It was a piece of cake!" and Leo smiled.');
  });
});
