// LTF-51: a picture he asks for, as a reward he pays for with flight points. Claude draws it as SVG. This module holds
// the checks around the drawing, so tests can fake the drawing itself: what he typed, a daily cap per learner (it costs
// money), and a picture that can never run code or load anything from outside.
//
// Documents (partition key /learner):
//   { id: 'pictures:<day>', learner, kind: 'quota', count }   pictures drawn that day; the app's sync never sends it down
import { HttpError } from './store.js';

export const DAILY = 3;
const MAX_ASK = 100;
const MAX_SVG = 60_000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The first <svg>…</svg> in a reply, or null unless it is small and has no script, event handler, outside link or embed. */
export function cleanSvg(text) {
  const m = /<svg[\s\S]*<\/svg>/i.exec(text ?? '');
  if (!m || m[0].length > MAX_SVG) return null;
  const svg = m[0];
  // Links and url() may point only inside the picture (#id); the quote sits inside the look-ahead so it cannot be skipped.
  const unsafe = /<script|<foreignObject|<image|<iframe|<object|<embed|\son[a-z]+\s*=|javascript:|@import|(?:href|src)\s*=\s*(?!["']?#)|url\(\s*(?!["']?#)/i;
  return unsafe.test(svg) ? null : svg;
}

/**
 * Checks the request, counts it against today's pictures, and draws it. `draw(ask)` returns { text } or { refused: true }.
 * A drawing that fails gives the day's picture back; one Claude declines does not, so asking again and again is not free.
 */
export async function picture(repo, body, draw) {
  const learner = typeof body?.learner === 'string' && ID.test(body.learner) ? body.learner : null;
  if (!learner) throw new HttpError(400, 'bad learner');
  const ask = typeof body?.ask === 'string' ? body.ask.replace(/\s+/g, ' ').trim() : '';
  if (!ask || ask.length > MAX_ASK) throw new HttpError(400, `ask for a picture in ${MAX_ASK} letters or fewer`);
  if (!(await repo.get(learner, 'profile'))) throw new HttpError(404, 'no such learner');
  const day = typeof body?.day === 'string' && DAY.test(body.day) ? body.day : new Date().toISOString().slice(0, 10); // his own day, from his device
  const key = `pictures:${day}`;
  const used = (await repo.get(learner, key))?.count ?? 0;
  if (used >= DAILY) throw new HttpError(429, 'that is all the pictures for today');
  await repo.put(learner, [{ id: key, learner, kind: 'quota', count: used + 1 }]);
  let r;
  try { r = await draw(ask); } catch (e) {
    await repo.put(learner, [{ id: key, learner, kind: 'quota', count: used }]);
    throw e instanceof HttpError ? e : new HttpError(502, 'the drawing did not work');
  }
  const svg = r?.refused ? null : cleanSvg(r?.text);
  return svg ? { svg } : { refused: true };
}
