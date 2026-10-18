// LTF-51: a picture he asks for, drawn by Claude as SVG. The checks around the drawing, with the drawing faked.
import { describe, expect, it } from 'vitest';
import { cleanSvg, DAILY, picture } from '../src/picture.js';
import { createLearner } from '../src/store.js';
import { memoryRepo } from '../src/memory.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g"><stop offset="0" stop-color="#fc0"/></linearGradient></defs><circle cx="200" cy="150" r="80" fill="url(#g)"/><use href="#g"/></svg>';
const drawn = (text) => async () => ({ text });

async function family() {
  const repo = memoryRepo();
  await createLearner(repo, { id: 'kid-1', name: 'Ace' });
  return repo;
}

describe('picture rewards (LTF-51)', () => {
  it('draws what he asked for, in 100 letters or fewer, for a learner in the family copy', async () => {
    const repo = await family();
    let asked = '';
    const out = await picture(repo, { learner: 'kid-1', ask: '  a  dragon   reading a book ', day: '2026-10-17' }, async (ask) => { asked = ask; return { text: `Here it is:\n${SVG}` }; });
    expect(asked).toBe('a dragon reading a book');
    expect(out).toEqual({ svg: SVG });
    await expect(picture(repo, { learner: 'kid-1', ask: '   ', day: '2026-10-17' }, drawn(SVG))).rejects.toMatchObject({ status: 400 });
    await expect(picture(repo, { learner: 'kid-1', ask: 'x'.repeat(101), day: '2026-10-17' }, drawn(SVG))).rejects.toMatchObject({ status: 400 });
    await expect(picture(repo, { learner: 'nobody', ask: 'a cat', day: '2026-10-17' }, drawn(SVG))).rejects.toMatchObject({ status: 404 });
  });
  it(`draws at most ${DAILY} a day for each learner, and a drawing that fails does not count`, async () => {
    const repo = await family();
    const ask = (day) => picture(repo, { learner: 'kid-1', ask: 'a cat', day }, drawn(SVG));
    await expect(picture(repo, { learner: 'kid-1', ask: 'a cat', day: '2026-10-17' }, async () => { throw new Error('network'); })).rejects.toMatchObject({ status: 502 });
    for (let k = 0; k < DAILY; k++) await expect(ask('2026-10-17')).resolves.toEqual({ svg: SVG });
    await expect(ask('2026-10-17')).rejects.toMatchObject({ status: 429 });
    await expect(ask('2026-10-18')).resolves.toEqual({ svg: SVG }); // a new day
  });
  it('a request Claude declines, or a reply with no picture, comes back as "try another idea"', async () => {
    const repo = await family();
    expect(await picture(repo, { learner: 'kid-1', ask: 'something scary', day: '2026-10-17' }, async () => ({ refused: true }))).toEqual({ refused: true });
    expect(await picture(repo, { learner: 'kid-1', ask: 'a cat', day: '2026-10-17' }, drawn('I cannot draw that.'))).toEqual({ refused: true });
  });
  it('never passes on a picture that could run code or load something from outside', () => {
    expect(cleanSvg(SVG)).toBe(SVG);
    for (const bad of [
      '<svg><script>alert(1)</script></svg>',
      '<svg><circle onclick="alert(1)" r="5"/></svg>',
      '<svg><a href="https://example.com"><circle r="5"/></a></svg>',
      '<svg><a xlink:href="javascript:alert(1)"><circle r="5"/></a></svg>',
      '<svg><image href="data:image/png;base64,AAAA"/></svg>',
      '<svg><foreignObject><div>hi</div></foreignObject></svg>',
      '<svg><style>@import url(https://example.com/x.css);</style></svg>',
      '<svg><rect fill="url(https://example.com/p.svg#x)"/></svg>',
      `<svg>${'<circle r="1"/>'.repeat(5000)}</svg>`, // too big to be a simple picture
      'no picture here',
    ]) expect(cleanSvg(bad), bad.slice(0, 60)).toBeNull();
  });
});
