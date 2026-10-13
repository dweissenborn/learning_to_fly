// LTF-03: when the who's who dots show under pronouns, and names in place of pronouns at level 1.
import type { HintMode } from './ItemView';

export type WhosWho = 'auto' | 'help' | 'off';

/**
 * In N4 guided practice, and outside N4 only in level 1 and 2 texts. Never in N4 practice of his own (or its warm-up)
 * or the Peak check. Once N4 is mastered, or when set to "on Help only", only after he asks for help.
 */
export function whosWhoOn(o: { setting: WhosWho; skill: string; mode: HintMode; level: number; hint: number; n4Mastered: boolean }) {
  if (o.setting === 'off' || o.mode === 'none' || o.mode === 'demo') return false;
  if (o.skill === 'N4' ? o.mode !== 'auto' : o.level > 2) return false;
  return o.setting === 'help' || o.n4Mastered ? o.hint >= 1 : true;
}

interface Ref { s: number; w: string; n?: number; to: string }
const POSSESSIVE = new Set(['his', 'its', 'their', 'hers', 'theirs']);
const REFLEXIVE = new Set(['himself', 'herself', 'itself', 'themselves']);
// After an object "her" comes a word like these or punctuation; after a possessive "her" comes the thing she has.
const AFTER_OBJECT = new Set(['the', 'a', 'an', 'to', 'about', 'at', 'in', 'on', 'with', 'for', 'from', 'that', 'and', 'but', 'or', 'so', 'up', 'down',
  'out', 'back', 'again', 'off', 'over', 'too', 'because', 'when', 'if', 'how', 'what', 'where', 'why', 'some', 'one', 'into', 'as', 'by', 'very', 'all', 'this']);

/**
 * LTF-03: a sentence with names in place of the pronouns its refs know ("She put it down" becomes "Priya put the rover down").
 * Possessives take 's ("her bag" becomes "Maya's bag"); "himself" and its kind stay, and so does any pronoun without a ref.
 */
export function withNames(sentence: string, si: number, refs: readonly Ref[]): string {
  const mine = refs.filter((r) => r.s === si);
  if (!mine.length) return sentence;
  const parts = sentence.split(/([A-Za-z'-]+)/); // odd indexes are words
  const seen = new Map<string, number>();
  const firstWord = parts.findIndex((p, i) => i % 2 === 1 && p.length > 0);
  for (let i = 1; i < parts.length; i += 2) {
    const w = parts[i].toLowerCase();
    const n = (seen.get(w) ?? 0) + 1;
    seen.set(w, n);
    const ref = mine.find((r) => r.w.toLowerCase() === w && (r.n ?? 1) === n);
    // Never inside quoted speech: what a character says stays word for word, and questions quote it.
    const quotes = (parts.slice(0, i).join('').match(/["“”]/g) ?? []).length;
    if (!ref || REFLEXIVE.has(w) || quotes % 2 === 1) continue;
    const next = parts[i + 2]?.toLowerCase();
    const plainBetween = /^ +$/.test(parts[i + 1] ?? '');
    const possessive = POSSESSIVE.has(w) || (w === 'her' && plainBetween && !!next && !AFTER_OBJECT.has(next));
    let name = possessive ? `${ref.to}'s` : ref.to;
    if (i === firstWord || /^[A-Z]/.test(parts[i])) name = name[0].toUpperCase() + name.slice(1);
    parts[i] = name;
  }
  return parts.join('');
}
