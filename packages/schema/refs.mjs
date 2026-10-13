// LTF-03: who's who. A passage can say who or what each pronoun refers to, so tapping "she" shows "she = Priya".
// Checked by validate.mjs: each reference points at a pronoun that is there and names someone or something in the passage.

const words = (s) => s.toLowerCase().split(/[^a-z'-]+/).filter(Boolean);

/** Whether the words of `phrase` appear in a row in `text` (both as word lists). */
const inRow = (text, phrase) => text.some((_, i) => phrase.every((w, k) => text[i + k] === w || text[i + k] === `${w}'s`));

/** Problems with a passage's pronoun references. */
export function refProblems(p) {
  const out = [];
  const all = words(p.sentences.join(' '));
  for (const r of p.refs ?? []) {
    const s = p.sentences[r.s];
    if (s === undefined) { out.push(`ref: sentence ${r.s} is out of range`); continue; }
    const count = words(s).filter((w) => w === r.w.toLowerCase()).length;
    if (!count) out.push(`ref: no "${r.w}" in sentence ${r.s}`);
    else if ((r.n ?? 1) > count) out.push(`ref: sentence ${r.s} has only ${count} "${r.w}"`);
    const name = words(r.to);
    if (['the', 'a', 'an'].includes(name[0])) name.shift();
    if (!name.length || !inRow(all, name)) out.push(`ref: "${r.to}" is not in the passage`);
  }
  return out;
}
