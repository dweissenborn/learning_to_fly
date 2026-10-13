// LTF-04: word help. A passage at level 3 to 5 may gloss up to three of its words. Checked by validate.mjs;
// pipeline/check.py also checks that each meaning reads easier than its word.

const MAX_WORDS = 3;
const MAX_MEANING = 12;
const tokens = (s) => s.toLowerCase().split(/[^a-z'-]+/).filter(Boolean);

/** Problems with a passage's glossed words. */
export function glossProblems(p) {
  const words = p.words ?? [];
  if (!words.length) return [];
  const out = [];
  if (p.level < 3) out.push('word help is for level 3 to 5 texts');
  if (words.length > MAX_WORDS) out.push('at most three words a passage');
  const text = new Set(p.sentences.flatMap(tokens));
  const seen = new Set();
  for (const g of words) {
    const w = g.word.toLowerCase();
    if (seen.has(w)) out.push(`word "${g.word}" is glossed twice`);
    seen.add(w);
    if (!text.has(w)) out.push(`word "${g.word}" is not in the passage`);
    const stem = w.slice(0, Math.max(4, w.length - 3));
    if (g.means.toLowerCase().includes(stem)) out.push(`meaning of "${g.word}" uses the word itself`);
    if (g.means.split(/\s+/).filter(Boolean).length > MAX_MEANING) out.push(`meaning of "${g.word}" has more than ${MAX_MEANING} words`);
  }
  return out;
}
