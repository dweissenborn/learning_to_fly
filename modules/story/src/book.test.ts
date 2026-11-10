// The book is data, so its shape is checked here: every line has a version for every pick, every answer and evidence
// index points at something real, and no placeholder is left in what he reads.
import { describe, expect, it } from 'vitest';
import { BOOK, outcomes, paragraphs, placeOf, say, stepsOf, type Picks, type Text } from './book';

/** Every combination of picks he could make. */
const worlds = Object.entries(BOOK.picks).reduce<Picks[]>((all, [k, vs]) => all.flatMap((w) => vs.map((v) => ({ ...w, [k]: v }))), [{}]);
const texts = (c: (typeof BOOK.chapters)[number]): Text[] => [...c.pages.flatMap((p) => p.text), c.clue, c.recap,
  ...[c.detail, c.main].flatMap((q) => [...(q.prompt ? [q.prompt] : []), ...q.options, q.explain])];

describe('the book', () => {
  it('has a line for every pick, with no placeholder left over', () => {
    for (const c of BOOK.chapters) for (const t of texts(c)) {
      if (typeof t !== 'string') expect(Object.keys(t).sort(), `${c.title}: ${JSON.stringify(t)}`).toEqual(['by', ...BOOK.picks[t.by]].sort());
      for (const w of worlds) expect(say(t, w, 'Rook')).not.toMatch(/[{}]|undefined/);
    }
  });
  it('asks questions whose answer and evidence exist', () => {
    for (const c of BOOK.chapters) {
      for (const q of [c.detail, c.main]) { expect(q.options.length).toBe(3); expect(q.options[q.answer]).toBeDefined(); }
      const [page, line] = c.detail.evidence!;
      expect(c.pages[page].text[line], c.title).toBeDefined();
      expect(c.main.evidence).toBeUndefined(); // the main idea is the whole chapter, not one line
    }
  });
  it('offers choices the book knows, after a real page', () => {
    for (const c of BOOK.chapters) if (c.choice) {
      expect(c.choice.options.map((o) => o.value)).toEqual(BOOK.picks[c.choice.key]);
      expect(c.pages[c.choice.after]).toBeDefined();
    }
    expect(BOOK.chapters.filter((c) => c.choice).map((c) => c.choice!.key).sort()).toEqual(Object.keys(BOOK.picks).sort());
  });
  it('never uses a pick before he has made it', () => {
    const seen = new Set<string>();
    BOOK.chapters.forEach((c) => {
      c.pages.forEach((p, i) => {
        for (const t of p.text) {
          if (typeof t !== 'string') expect(seen, `${c.title} page ${i + 1} uses ${t.by}`).toContain(t.by);
          if (JSON.stringify(t).includes('{koala}')) expect(seen, `${c.title} page ${i + 1} names the koala`).toContain('koala');
        }
        for (const [k, flag] of [['tool', p.scene.tool], ['band', p.scene.band], ['night', p.scene.stall]] as const) if (flag) expect(seen, `${c.title} page ${i + 1} draws ${k}`).toContain(k);
        if (c.choice?.after === i) seen.add(c.choice.key);
      });
    });
  });
  it('keeps what was built: once the band or his pole is in a picture, it is in every later one', () => {
    const scenes = BOOK.chapters.flatMap((c) => c.pages.map((p) => p.scene));
    for (const k of ['band', 'pole'] as const) expect(scenes.slice(scenes.findIndex((s) => s[k])).every((s) => s[k]), k).toBe(true);
    for (const s of scenes) if (s.koala === 'pole') expect(s.pole).toBe(true); // nothing to sit on otherwise
  });
});

it('paragraphs: a new one where speech starts or stops, and where a new speaker is named', () => {
  expect(paragraphs(['The hill is quiet.', 'You wait.', '"Look," says Tilly.', '"It moved."', '"Where?" asks Dr. Vega.', 'Nobody answers.']))
    .toEqual([[0, 1], [2, 3], [4], [5]]);
});

it('placeOf: his saved place counts only in the chapter he is on, and only where the book still has it', () => {
  const at = (place: unknown) => placeOf({ chapter: 2, place } as never, 2);
  expect(stepsOf(BOOK.chapters[2])).toEqual([0, 'choice', 1, 2]); // chapter 3: the choice comes after its first page
  expect(at({ chapter: 2, stage: 'read', step: 2 })).toEqual({ chapter: 2, stage: 'read', step: 2 });
  expect(at({ chapter: 2, stage: 'read', step: 99 })?.step).toBe(3); // a page the book no longer has: its last page
  expect(at({ chapter: 2, stage: 'main', step: 5, guessed: true })).toEqual({ chapter: 2, stage: 'main', step: 0, guessed: true });
  // Nothing saved, a place in another chapter, and a stage nobody can carry on from.
  expect([null, undefined, { chapter: 1, stage: 'read', step: 0 }, { chapter: 2, stage: 'finish', step: 0 }].map(at)).toEqual([undefined, undefined, undefined, undefined]);
});

it('outcomes: his latest answer to each question', () => {
  const a = (item: string, correct: boolean, shown?: boolean, rapid?: boolean) => ({ type: 'answer', module: 'story', item, correct, shown, rapid }) as never;
  expect([...outcomes([a('x', false, true), a('y', false), a('x', true), a('z', true, false, true)])]).toEqual([['x', 'right'], ['y', 'clue'], ['z', 'guess']]); // a fast guess is never shown as right
});
