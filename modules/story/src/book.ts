// LTF-65: the chapter book is data (book.json), so the reading-level check (../check.py) reads the same words he does.
import type { LogEvent } from '@wayfinder/schema';
import raw from './book.json';

export type Picks = Record<string, string | undefined>;
/** A line of text: plain, or one version for each value of a pick he made (`by` names the pick). */
export type Text = string | ({ by: string } & Record<string, string>);
/** What is true in a page's picture. Every page shows the same hilltop, so the picture always matches the words. */
export interface SceneSpec {
  sky: 'day' | 'dusk' | 'night';
  fog?: boolean; cloud?: boolean; moon?: boolean; meteors?: boolean;
  /** The dome's roof is shut; the path lights are off; the cups on the mast are spinning. */
  shut?: boolean; dark?: boolean; spin?: boolean;
  koala?: 'walk' | 'mast' | 'pole'; shadow?: boolean; sleepy?: boolean;
  /** Things that follow a pick he made: the tool on the fence post, the band on the mast, what he does on Star Night. */
  tool?: boolean; band?: boolean; stall?: boolean;
  rig?: boolean; pole?: boolean; torch?: boolean; crowd?: boolean;
  inset?: 'saturn' | 'strong' | 'calm' | 'log' | 'print' | 'catch' | 'cups';
}
export interface Question { prompt?: Text; options: Text[]; answer: number; /** [page, line] that holds the answer */ evidence?: [number, number]; explain: Text }
export interface Choice { after: number; key: string; obstacle?: string; notice?: string; cope?: string; ask: string; options: { value: string; label: string; reply: string }[] }
export interface Chapter { title: string; pages: { scene: SceneSpec; text: Text[] }[]; choice?: Choice; detail: Question; main: Question; clue: Text; recap: Text; talk: string }
export interface Book { title: string; level: number; blurb: string; picks: Record<string, string[]>; chapters: Chapter[] }
/** The story's own memory (kv `settings:story`): the next chapter to read and the choices he has made. */
export interface StoryState { enabled?: boolean; chapter?: number; picks?: Picks }

export const BOOK = raw as unknown as Book;
export const MAIN_PROMPT = 'What was this chapter mostly about?';
export const KINDS = [['detail', 'story:key-detail', 'A key detail'], ['main', 'story:main-idea', 'The main idea']] as const;
export const itemId = (chapter: number, kind: 'detail' | 'main') => `story-c${chapter + 1}-${kind}`;

/** The pick he made, or the first option while he has not chosen yet (the grown-ups' preview reads the book that way). */
export const pickOf = (picks: Picks, key: string) => picks[key] ?? BOOK.picks[key][0];
/** A line as he reads it: his version of it, with his guide's name and the name he gave the koala. */
export const say = (t: Text, picks: Picks, guide: string) =>
  (typeof t === 'string' ? t : t[pickOf(picks, t.by)]).replaceAll('{guide}', guide).replaceAll('{koala}', pickOf(picks, 'koala'));

/** Line numbers grouped into paragraphs: a new one where speech starts or stops, and where a new speaker is named. */
export function paragraphs(lines: readonly string[]): number[][] {
  const speech = (s: string) => s.startsWith('"'), named = (s: string) => /[,?!.]" \w/.test(s);
  const out: number[][] = [];
  lines.forEach((s, i) => { if (!i || speech(s) !== speech(lines[i - 1]) || (speech(s) && named(s))) out.push([]); out.at(-1)!.push(i); });
  return out;
}

/** How his latest answer to each question went, by item id: right first time, found with the clue, shown, or a guess faster than reading (set aside). */
export function outcomes(events: readonly LogEvent[]) {
  const out = new Map<string, 'right' | 'clue' | 'shown' | 'guess'>();
  for (const e of events) if (e.type === 'answer' && e.module === 'story') out.set(e.item, e.rapid ? 'guess' : e.correct ? 'right' : e.shown ? 'shown' : 'clue');
  return out;
}
