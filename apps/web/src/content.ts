// The reviewed content bank, bundled at build time. Nothing a child reads comes from anywhere else.
import type { Item, Passage, SkillBank, SkillId, Strand } from '@wayfinder/schema';
import { buildPool } from '@wayfinder/engine';
import meta from '../../../content/skills.json';
import placementData from '../../../content/placement.json';
import todayData from '../../../content/today.json';

const banks = Object.values(import.meta.glob<SkillBank>('../../../content/bank/*.json', { eager: true, import: 'default' }));
export const pool = buildPool(banks);
export const bankCount = banks.length;

export interface SkillMeta { name: string; ican: string; praise: string[]; talk: string; offline: string; realworld: string }
export const SKILL = meta.skills as Record<SkillId, SkillMeta>;
export const STRAND = meta.strands as Record<Strand, { region: string; short: string; intro: string; icon: string }>;

export const placement = placementData as {
  words: { word: string; options: string[]; answer: number }[];
  reading: { passage: Passage; items: Item[] };
  listening: { passage: Passage; items: Item[] };
};
for (const part of [placement.reading, placement.listening]) pool.passages.set(part.passage.id, part.passage);

export interface Lesson { id: string; name: string; emoji: string; what: string[]; ask: string[] }
export const today = todayData as {
  lessons: Lesson[]; weekend: Lesson[]; defaultTimetable: string[]; who: string[];
  feelings: { word: string; emoji: string }[]; why: string[]; hard: string[];
};

export const TOPICS: { id: SkillBank['passages'][number]['topics'][number]; label: string; emoji: string }[] = [
  { id: 'space', label: 'Space', emoji: '🚀' },
  { id: 'animals', label: 'Animals', emoji: '🐾' },
  { id: 'transport', label: 'Trains and transport', emoji: '🚆' },
  { id: 'weather', label: 'Weather', emoji: '⛈️' },
  { id: 'maps', label: 'Maps and places', emoji: '🗺️' },
  { id: 'mining', label: 'Mining and building', emoji: '⛏️' },
  { id: 'games', label: 'Games and tech', emoji: '🎮' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'food', label: 'Food and cooking', emoji: '🍳' },
  { id: 'dinosaurs', label: 'Dinosaurs', emoji: '🦕' },
  { id: 'robots', label: 'Robots and machines', emoji: '🤖' },
  { id: 'ocean', label: 'Ocean', emoji: '🌊' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'nature', label: 'Nature', emoji: '🌲' },
];

/** Praise that names the skill (R9). Uses the item's cue word where the template asks for it. */
export function praiseFor(item: Item, n: number) {
  const list = SKILL[item.skill]?.praise ?? ['You did it.'];
  return list[n % list.length].replace('{focus}', item.focus ?? 'the word');
}

/** Plain text of a passage for read-aloud. */
export function passageText(p: Passage): string[] {
  const v = p.visual;
  const out = [...p.sentences];
  if (!v) return out;
  if (v.type === 'signs') out.push(...v.signs.map((s) => `The sign says: ${s.text}.`));
  else if (v.type === 'table') {
    if (v.title) out.push(v.title + '.');
    out.push(...v.rows.map((r) => r.map((c, i) => `${v.columns[i] ?? ''} ${c}`).join(', ') + '.'));
    if (v.note) out.push(v.note);
  } else if (v.type === 'label' || v.type === 'form') {
    out.push(v.title + '.', ...v.rows.map((r) => `${r.k}: ${'v' in r && r.v ? r.v : 'blank'}.`));
    if (v.type === 'label' && v.warning) out.push(v.warning);
  } else if (v.type === 'message') {
    out.push(`A message from ${v.from}.`, ...(v.subject ? [v.subject + '.'] : []), ...v.rows);
  } else if (v.type === 'prompt') out.push(v.title + '.', ...v.rows, `The buttons say: ${v.buttons.join(', ')}.`);
  else {
    if ('title' in v && v.title) out.push(v.title + '.');
    out.push(...v.rows);
  }
  return out;
}
