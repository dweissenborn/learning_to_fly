// LTF-41: the math skills' path. A dependency graph, gates that show as "coming up", a check-in that places him (passing
// a skill places what it rests on too), mastery as in reading, a placed skill confirmed by its first review, and a
// re-check of what a skill depends on when it stalls. Pure functions over the event log, like the rest of the engine.
import type { AnswerEvent, LogEvent } from '@wayfinder/schema';
import { dayKey, RULES } from '@wayfinder/engine';

export const MATH_GRAPH: Record<string, readonly string[]> = {
  'math:MF1': [], 'math:MF2': ['math:MF1'], 'math:DV1': ['math:MF1'], 'math:FR1': [],
  'math:FR2': ['math:FR1', 'math:MF1'], 'math:FR3': ['math:FR2', 'math:MF2'], 'math:FR4': ['math:FR1', 'math:DV1'],
  'math:FR5': ['math:FR2', 'math:MF1'], 'math:FR6': ['math:FR3', 'math:FR4', 'math:FR5'],
};
/** The skills in teaching order. */
export const MATH_ORDER = Object.keys(MATH_GRAPH);
/** The check-in starts one step below the target topics, and moves up or branches down from there. */
const CHECKIN_START = 'math:FR2';
const STALL = 0.6;

export interface MathSkill {
  skill: string;
  open: boolean;
  /** Passed the check-in (or rests under a skill that did), and not taken back by a missed first review. */
  placed: boolean;
  mastered: boolean;
  /** A re-check found a gap here: it is the focus until one good session restores it. */
  relearn: boolean;
  /** LTF-43: he answers from three choices: a new skill starts this way, until a session with choices reaches 80%. */
  choices: boolean;
  sessions: { session: string; day: string; ts: number; correct: number; total: number }[];
  lastAt?: number;
}
export interface MathState {
  skills: Record<string, MathSkill>;
  checkin: { done: boolean; next?: string };
  /** The skill to practise next. */
  focus?: string;
  /** Skills to check again because one resting on them stalled. */
  recheck: string[];
  /** Placed or mastered skills due for a review in the warm-up. */
  review: string[];
}

const isMath = (e: LogEvent): e is AnswerEvent => e.type === 'answer' && typeof e.skill === 'string' && e.skill.startsWith('math:');

/** Each probed skill's result, decided by its first two answers: both right passes, any miss is a miss. */
function results(answers: readonly AnswerEvent[]) {
  const seen = new Map<string, boolean[]>(), out = new Map<string, 'pass' | 'miss'>(), order: string[] = [];
  for (const a of answers) {
    if (out.has(a.skill)) continue;
    const r = [...(seen.get(a.skill) ?? []), a.correct];
    seen.set(a.skill, r);
    if (!a.correct || r.length >= 2) { out.set(a.skill, a.correct ? 'pass' : 'miss'); order.push(a.skill); }
  }
  return { out, order };
}
const closure = (skills: Iterable<string>) => {
  const all = new Set<string>();
  const add = (s: string) => { if (all.has(s)) return; all.add(s); MATH_GRAPH[s]?.forEach(add); };
  for (const s of skills) add(s);
  return all;
};

/** The next skill the check-in should probe, or undefined when it is done. */
export function checkinNext(placementAnswers: readonly AnswerEvent[], o: { known?: readonly string[] }): string | undefined {
  const { out, order } = results(placementAnswers);
  if (o.known?.length) return MATH_ORDER.find((s) => o.known!.includes(s) && !out.has(s));
  if (!order.length) return CHECKIN_START;
  const placed = closure([...out].filter(([, r]) => r === 'pass').map(([s]) => s));
  const open = (s: string) => !placed.has(s) && !out.has(s);
  // Branch down from the most recent miss first, then move up wherever what a skill rests on is placed.
  for (const miss of [...order].reverse().filter((s) => out.get(s) === 'miss')) {
    const d = MATH_ORDER.find((s) => MATH_GRAPH[miss].includes(s) && open(s));
    if (d) return d;
  }
  return MATH_ORDER.find((s) => open(s) && MATH_GRAPH[s].every((d) => placed.has(d)));
}

export function deriveMath(events: readonly LogEvent[], o: { opened?: readonly string[]; known?: readonly string[]; now?: number }): MathState {
  const answers = events.filter(isMath).filter((a) => !a.rapid); // LTF-43: a guess faster than reading counts for nothing
  const checkinAnswers = answers.filter((a) => a.phase === 'placement');
  const { out } = results(checkinAnswers);
  const checkinPlaced = closure([...out].filter(([, r]) => r === 'pass').map(([s]) => s));
  const placedAt = checkinAnswers.reduce((t, a) => Math.max(t, a.ts), 0);

  const skills: Record<string, MathSkill> = {};
  for (const s of MATH_ORDER) {
    const mine = answers.filter((a) => a.skill === s);
    // His own turns, by session: typed answers toward mastery, and answers with choices toward the ramp (LTF-43). Only a
    // first try with no help is right; a helped answer is not independent.
    const tally = (list: AnswerEvent[]) => {
      const turns = new Map<string, MathSkill['sessions'][number]>();
      for (const a of list) {
        const t = turns.get(a.session) ?? { session: a.session, day: dayKey(a.ts), ts: a.ts, correct: 0, total: 0 };
        t.total += 1; if (a.correct && !a.hint) t.correct += 1; t.ts = Math.max(t.ts, a.ts);
        turns.set(a.session, t);
      }
      return [...turns.values()].sort((x, y) => x.ts - y.ts);
    };
    const own = mine.filter((a) => a.phase === 'yourturn');
    const sessions = tally(own.filter((a) => a.format !== 'choices'));
    const lastChoices = tally(own.filter((a) => a.format === 'choices')).at(-1);
    const choices = !sessions.length && !(lastChoices && lastChoices.total >= RULES.minPerSession && lastChoices.correct / lastChoices.total >= RULES.mastery);
    // Mastery as in reading: two qualifying sessions on different days at 80% or better together.
    const q = sessions.filter((x) => x.total >= RULES.minPerSession);
    const mastered = q.some((x, i) => { const y = [...q.slice(0, i)].reverse().find((z) => z.day !== x.day); return !!y && (x.correct + y.correct) / (x.total + y.total) >= RULES.mastery; });
    // Placed is provisional: its first review after the check-in confirms it, or takes it back.
    const firstReview = mine.find((a) => a.phase === 'warmup' && a.ts > placedAt);
    const placed = checkinPlaced.has(s) && (!firstReview || firstReview.correct);
    skills[s] = { skill: s, open: false, placed, mastered, relearn: false, choices, sessions, lastAt: mine.at(-1)?.ts };
  }
  const known = (s: string) => skills[s].placed || skills[s].mastered;
  for (const s of MATH_ORDER) skills[s].open = !!o.opened?.includes(s) || MATH_GRAPH[s].every(known);

  // A stalled skill (its last two sessions under 60%) sends a re-check to what it rests on; a miss there is relearned.
  const recheck: string[] = [];
  for (const s of MATH_ORDER) {
    const k = skills[s], last = k.sessions.slice(-2);
    if (!k.open || k.mastered || last.length < 2 || !last.every((x) => x.correct / x.total < STALL)) continue;
    const since = last[1].ts;
    const { out: checked } = results(answers.filter((a) => a.phase === 'recheck' && a.ts > since && MATH_GRAPH[s].includes(a.skill)));
    for (const d of MATH_GRAPH[s]) {
      if (!known(d)) continue;
      const r = checked.get(d);
      if (r === undefined && !recheck.includes(d)) recheck.push(d);
      if (r === 'miss') {
        const missAt = answers.filter((a) => a.phase === 'recheck' && a.skill === d && a.ts > since).at(-1)!.ts;
        const restored = skills[d].sessions.some((x) => x.ts > missAt && x.total >= RULES.relearnMin && x.correct / x.total >= RULES.mastery);
        if (!restored) skills[d].relearn = true;
      }
    }
  }

  const now = o.now ?? Date.now();
  const review = MATH_ORDER.filter((s) => {
    const k = skills[s];
    if (!(k.placed || k.mastered) || k.lastAt === undefined) return false;
    const reviews = new Set(answers.filter((a) => a.skill === s && a.phase === 'warmup').map((a) => dayKey(a.ts))).size;
    return now - k.lastAt >= RULES.reviewGapsDays[Math.min(reviews, RULES.reviewGapsDays.length - 1)] * 86_400_000;
  });
  const next = checkinNext(checkinAnswers, o);
  const focus = MATH_ORDER.find((s) => skills[s].relearn) ?? MATH_ORDER.find((s) => skills[s].open && !skills[s].mastered && !skills[s].placed);
  return { skills, checkin: { done: next === undefined, next }, focus, recheck, review };
}
