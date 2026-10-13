// Fresh content: how many questions and texts he has not met yet, and how often answers are repeats.
// A right answer to a question he has seen before may be memory, not comprehension, so this is reported
// per skill, and new features measure themselves on first-time answers only (see isRepeat).
import type { SkillId } from '@wayfinder/schema';
import { ALL_SKILLS, levelFor, type Pool, type Progress } from './index';

const DAY = 86_400_000;
/** Fewer unseen questions than this, at his level or the next one up, counts as running low (about two sessions' worth). */
export const FRESH_LOW = 10;

export interface FreshRow {
  skill: SkillId;
  /** His current text level in this skill. */
  level: number;
  /** Questions he can be given now (at his level or easier), and how many of those he has never answered. */
  total: number;
  unseen: number;
  /** Texts behind those questions, and how many he has not read any question on yet. */
  texts: number;
  unseenTexts: number;
  answersWeek: number;
  repeatsWeek: number;
  answersAll: number;
  repeatsAll: number;
  /** repeating: nothing new at his level now. low: fewer than FRESH_LOW new at his level or the next. */
  status: 'plenty' | 'low' | 'repeating';
}

export function freshness(p: Progress, pool: Pool, o: { now: number; hidden?: ReadonlySet<string>; allowThemes?: boolean }): FreshRow[] {
  return ALL_SKILLS.map((skill) => {
    const st = p.skills[skill];
    const level = levelFor(st, pool);
    const model = pool.models.get(skill)?.item;
    const all = pool.bySkill.get(skill) ?? [];
    // The same questions item choice can serve: no worked example, no inference check, nothing hidden, themes only if allowed.
    const servable = all.filter((i) => i.id !== model && !i.gatecheck && !o.hidden?.has(i.id) && (o.allowThemes || !pool.passages.get(i.passage)?.themes?.length));
    const now = servable.filter((i) => i.level <= level);
    const soon = servable.filter((i) => i.level <= Math.min(5, level + 1) && !p.seen.has(i.id)).length;
    const met = new Set(all.filter((i) => p.seen.has(i.id)).map((i) => i.passage));
    const texts = [...new Set(now.map((i) => i.passage))];
    const unseen = now.filter((i) => !p.seen.has(i.id)).length;
    const week = st.answers.filter((a) => o.now - a.ts < 7 * DAY);
    return {
      skill, level, total: now.length, unseen, texts: texts.length, unseenTexts: texts.filter((t) => !met.has(t)).length,
      answersWeek: week.length, repeatsWeek: week.filter((a) => p.repeats.has(a.id)).length,
      answersAll: st.answers.length, repeatsAll: st.answers.filter((a) => p.repeats.has(a.id)).length,
      status: unseen === 0 ? 'repeating' : soon < FRESH_LOW ? 'low' : 'plenty',
    };
  });
}
