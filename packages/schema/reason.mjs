// LTF-02: the reasoning card (Clue, What I know, So) on feelings questions. Checked by validate.mjs.

/** N5 and P2 items numbered from here on are written with a card. Older items are ones he may have seen, so they keep none. */
export const REASON_FROM = { N5: 174, P2: 87 };
const MAX_WORDS = 12;

/** Problems with an item's reasoning card, given its passage. */
export function reasonProblems(it, passage) {
  const out = [];
  const from = REASON_FROM[it.skill];
  const n = Number(it.id.split('-i')[1]);
  if (from !== undefined && n >= from && it.inference === 2 && it.tier !== 'express' && !it.gatecheck && !it.reason) out.push('needs a reason card (clue, know, so)');
  if (it.reason) {
    if (!passage.sentences.includes(it.reason.clue)) out.push('reason clue must be a sentence from the passage');
    for (const k of ['clue', 'know', 'so']) if (it.reason[k].split(/\s+/).filter(Boolean).length > MAX_WORDS) out.push(`reason ${k} has more than ${MAX_WORDS} words`);
  }
  return out;
}
