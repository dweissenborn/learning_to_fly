// "Tell about today", day topic: which question comes next, and the sentences and grown-up prompts built from
// his tiles. Plain functions so they can be tested without a browser.
import type { Lesson } from './content';

export interface Part {
  lesson: Pick<Lesson, 'id' | 'name' | 'emoji' | 'what' | 'ask'>;
  who?: string;
  what?: string;
  /** "What happened after that?" after what he did (from stage 2; LTF-05). */
  afterDone?: string;
  feeling?: string;
  why?: string;
  hard?: string;
  /** "What happened after that?" after something hard (LTF-05). */
  afterHard?: string;
}
export type QKey = 'who' | 'what' | 'afterDone' | 'feeling' | 'why' | 'hard' | 'afterHard';
export const ORDER: QKey[] = ['who', 'what', 'afterDone', 'feeling', 'why', 'hard', 'afterHard'];

const realHard = (h?: string) => !!h && h !== 'nothing was hard';

/** Whether a question is asked about this part. Consequences mostly come only when asked, so "after" follows anything hard. */
export function askable(key: QKey, p: Part, o: { stage: number; why: boolean }) {
  if (key === 'afterDone') return o.stage >= 2 && !!p.what;
  if (key === 'why') return o.why || o.stage >= 2;
  if (key === 'afterHard') return realHard(p.hard);
  return true;
}

/** The next question for this part after `from` (an ORDER key), or null when the part is done. */
export function nextKey(p: Part, from: QKey | null, o: { stage: number; why: boolean }): QKey | null {
  for (let i = from ? ORDER.indexOf(from) + 1 : 0; i < ORDER.length; i++) if (askable(ORDER[i], p, o)) return ORDER[i];
  return null;
}

export function buildDaySentences(parts: Part[], o: { order: string[]; weekend: boolean; main?: string }): string[] {
  const out: string[] = [];
  const ordered = o.order.length === parts.length ? o.order.map((id) => parts.find((p) => p.lesson.id === id)!) : parts;
  if (o.order.length === parts.length && parts.length > 1) {
    const words = ['First', 'Then', 'Next', 'After that', 'Then'];
    ordered.forEach((p, i) => out.push(`${i === ordered.length - 1 ? 'Last' : words[i]}, I had ${p.lesson.name}.`));
  }
  for (const p of ordered) {
    if (p.what) out.push(o.weekend ? `Today, I ${p.what}.` : `In ${p.lesson.name}, I ${p.what}.`);
    if (p.afterDone) out.push(`After that, ${p.afterDone}.`);
    if (p.who) out.push(p.who === 'by myself' ? 'I worked by myself.' : `I was with ${p.who}.`);
    if (p.feeling) out.push(`I felt ${p.feeling}${p.why ? ` because ${p.why}` : ''}.`);
    if (realHard(p.hard)) {
      out.push(`Something hard: ${p.hard}.`);
      if (p.afterHard) out.push(`After that, ${p.afterHard}.`);
    }
  }
  if (o.main) out.push(`The main thing about today was ${o.main}.`);
  return out;
}

/** LTF-07: the sentence starter in front of his own words, from stage 3. */
export function starter(key: QKey, p: Part, o: { weekend: boolean }): string {
  return {
    who: 'I was with', what: o.weekend ? 'Today, I' : `In ${p.lesson.name}, I`, afterDone: 'After that,', feeling: 'I felt',
    why: `I felt ${p.feeling ?? 'that way'} because`, hard: 'Something hard:', afterHard: 'After that,',
  }[key];
}
/** His own words as an answer. "No" or "nothing" to the hard question means nothing was hard. */
export function ownAnswer(key: QKey, text: string): string {
  const t = text.trim().replace(/[.!]+$/, '');
  return key === 'hard' && /^(no|nope|nothing|none|not really)\b/i.test(t) ? 'nothing was hard' : t;
}

/** The questions he skipped, read from his final answers, so changing an answer later is not counted twice. */
export function skippedKeys(parts: Part[], o: { stage: number; why: boolean }): QKey[] {
  return parts.flatMap((p) => ORDER.filter((k) => askable(k, p, o) && !p[k]));
}

export interface Panel { label: 'Before' | 'What happened' | 'After' | 'How I felt'; text?: string; keys: QKey[] }
/** LTF-06: one part of his day as four panels. A panel with nothing in it was skipped. `keys` are the questions it re-asks. */
export function buildStrip(p: Part, o: { weekend: boolean }): Panel[] {
  const join = (xs: (string | false | undefined)[]) => xs.filter(Boolean).join(' ') || undefined;
  const with_ = p.who === 'by myself' ? 'I worked by myself' : `I was with ${p.who}`;
  return [
    { label: 'Before', keys: ['who'], text: p.who ? (o.weekend ? `${with_}.` : `In ${p.lesson.name}, ${with_}.`) : undefined },
    { label: 'What happened', keys: ['what', 'hard'], text: join([p.what && (o.weekend ? `Today, I ${p.what}.` : `I ${p.what}.`), realHard(p.hard) && `Something hard: ${p.hard}.`]) },
    { label: 'After', keys: ['afterDone', 'afterHard'], text: join([p.what && p.afterDone && `After that, ${p.afterDone}.`, realHard(p.hard) && p.afterHard && `After that, ${p.afterHard}.`]) },
    { label: 'How I felt', keys: ['feeling', 'why'], text: p.feeling ? `I felt ${p.feeling}${p.why ? ` because ${p.why}` : ''}.` : undefined },
  ];
}

/** Specific questions for the grown-up, using his own answers. */
export function buildAsks(parts: Part[]): string[] {
  const a: string[] = [];
  for (const p of parts) {
    a.push(...p.lesson.ask.slice(0, 2));
    if (p.feeling) a.push(`You said you felt ${p.feeling}. What made you feel ${p.feeling}?`);
    if (realHard(p.hard)) a.push(p.afterHard ? `You said: ${p.hard}. After that, ${p.afterHard}. How did that go?` : `You said: ${p.hard}. What happened then, and what did you do?`);
    if (p.afterDone && p.what) a.push(`You said that after you ${p.what}, ${p.afterDone}. What was that like?`);
  }
  return [...new Set(a)].slice(0, 4);
}
