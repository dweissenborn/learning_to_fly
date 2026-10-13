// The lesson engine: deterministic rules over the append-only event log.
// No I/O, no model. Every number a child or adult sees is derived here from events.
import type { AnswerEvent, Item, LogEvent, Model, Passage, SkillBank, SkillId, Strand, Topic } from '@wayfinder/schema';

/** Thresholds from the design plan. Proposals to confirm with a reading specialist. */
export const RULES = {
  mastery: 0.8, // your-turn accuracy across two sessions on different days
  minPerSession: 2, // your-turn answers a session needs to count toward mastery
  relearnMin: 3, // after a failed review, one session with this many answers at `mastery` restores the skill
  reviewGapsDays: [3, 7, 21],
  gateInference: 0.8,
  gateCheckItems: 5,
  philosophicalOneIn: 4, // at most one session in four
  neutralTopicShare: 0.2, // share of picks that ignore interests, so the interest effect can be measured (R8)
  maxLevel: 5, // levels 4 and 5 are harder texts, reached only by climbing the staircase
  levelUpStreak: 2, // first-try answers in a row at his level that move him up a level
  levelDownMisses: 2, // misses in a row at his level that move him down a level
  fastTrackMin: 4, // fast track: this many your-turn answers in one session, all right first time,
  fastTrackLevel: 3, // including a new-format item and one at this level or harder
} as const;

const DAY = 86_400_000;
export const STRANDS: Strand[] = ['functional', 'narrative', 'philosophical'];
const LETTER = { functional: 'F', narrative: 'N', philosophical: 'P' } as const;
export const skillsOf = (strand: Strand) => [1, 2, 3, 4, 5, 6].map((n) => `${LETTER[strand]}${n}` as SkillId);
export const ALL_SKILLS: SkillId[] = STRANDS.flatMap(skillsOf);
export const strandOf = (s: SkillId): Strand => (s[0] === 'F' ? 'functional' : s[0] === 'N' ? 'narrative' : 'philosophical');
export const stepOf = (s: SkillId) => Number(s[1]);
/** Narrative 1-5 and functional 1-3: the skills the philosophical gate rests on. */
export const GATE_SKILLS: SkillId[] = ['N1', 'N2', 'N3', 'N4', 'N5', 'F1', 'F2', 'F3'];
export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// ---------------------------------------------------------------- progress

export type Status = 'new' | 'learning' | 'mastered';
export interface Tally { session: string; day: string; ts: number; correct: number; total: number; transferCorrect: boolean; topLevel: number }
export interface SkillState {
  skill: SkillId;
  status: Status;
  /** Ever mastered. The child's view uses this, so it never shows a loss. */
  everMastered: boolean;
  /** Mastered by placement and not yet confirmed by a passed review. */
  placed: boolean;
  /** Answered this skill's scouting question right: he has already shown he can do it. */
  scouted: boolean;
  masteredAt?: number;
  /** Reviews passed since the last (re)mastery. 3 means the 21-day review passed. */
  reviewStage: number;
  nextReview?: number;
  /** Failed a review and is back in practice. */
  relearning: boolean;
  tallies: Tally[];
  /** Every non-placement answer, oldest first. */
  answers: AnswerEvent[];
}
export interface SessionRecord { id: string; strand?: Strand; skill?: string; start: number; end?: number; finished: boolean; gatecheck: boolean }
export interface Progress {
  skills: Record<SkillId, SkillState>;
  inferencePassed: boolean;
  /** All four gate conditions held at some point. Never taken away. */
  gateOpened: boolean;
  sessions: SessionRecord[];
  /** Item id to the last time it was answered. */
  seen: Map<string, number>;
  /** Answer ids where he had already answered that same question before (any phase), read from the shared log in time order. */
  repeats: Set<string>;
}

/** Whether this answer was to a question he had answered before. Features measured on fresh content count only first-time answers. */
export const isRepeat = (p: Progress, a: { id: string }) => p.repeats.has(a.id);

const fresh = (skill: SkillId): SkillState => ({
  skill, status: 'new', everMastered: false, placed: false, scouted: false, reviewStage: 0, relearning: false, tallies: [], answers: [],
});

function master(s: SkillState, ts: number, placed = false) {
  Object.assign(s, { status: 'mastered', everMastered: true, placed, masteredAt: ts, reviewStage: 0, nextReview: ts + RULES.reviewGapsDays[0] * DAY, relearning: false });
}

/**
 * Two sessions on different days, 80% or better together, including a correct transfer item.
 * Fast track (on by default, for a learner who locks a skill in once he sees how): one session with
 * every your-turn answer right first time, including a new-format item and a level 3+ item.
 * Reviews at 3, 7 and 21 days still check that it lasts.
 */
function meetsMastery(s: SkillState, fastTrack: boolean): boolean {
  const last = s.tallies.at(-1);
  if (!last) return false;
  if (s.relearning) return last.total >= RULES.relearnMin && last.correct / last.total >= RULES.mastery;
  if (fastTrack && last.total >= RULES.fastTrackMin && last.correct === last.total && last.transferCorrect && last.topLevel >= RULES.fastTrackLevel) return true;
  const prev = s.tallies.findLast((t) => t.day !== last.day);
  if (!prev || last.total < RULES.minPerSession || prev.total < RULES.minPerSession) return false;
  const acc = (last.correct + prev.correct) / (last.total + prev.total);
  return acc >= RULES.mastery && (last.transferCorrect || prev.transferCorrect);
}

export function derive(events: readonly LogEvent[], opts: { fastTrack?: boolean } = {}): Progress {
  const fastTrack = opts.fastTrack ?? true;
  const skills = Object.fromEntries(ALL_SKILLS.map((s) => [s, fresh(s)])) as Record<SkillId, SkillState>;
  const p: Progress = { skills, inferencePassed: false, gateOpened: false, sessions: [], seen: new Map(), repeats: new Set() };
  type Open = { rec: SessionRecord; due: Set<SkillId>; review: Map<SkillId, { c: number; n: number }>; practised: Set<SkillId>; gate: { c: number; n: number } };
  let open: Open | null = null;

  const close = (ts: number) => {
    if (!open) return;
    for (const [id, r] of open.review) {
      const s = skills[id];
      if (r.c / r.n >= RULES.mastery) {
        s.reviewStage += 1;
        s.placed = false;
        s.nextReview = ts + RULES.reviewGapsDays[Math.min(s.reviewStage, 2)] * DAY;
      } else Object.assign(s, { status: 'learning', relearning: true, reviewStage: 0, nextReview: undefined });
    }
    for (const id of open.practised) if (skills[id].status !== 'mastered' && meetsMastery(skills[id], fastTrack)) master(skills[id], ts);
    if (open.gate.n >= RULES.gateCheckItems && open.gate.c / open.gate.n >= RULES.gateInference) p.inferencePassed = true;
    const g = gate(p);
    if (Object.values(g.conditions).every(Boolean)) p.gateOpened = true;
    open = null;
  };

  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    if (e.type === 'placement') {
      for (const strand of ['functional', 'narrative'] as const)
        for (const id of skillsOf(strand)) if (stepOf(id) < e[strand] && skills[id].status !== 'mastered') master(skills[id], e.ts, true);
    } else if (e.type === 'session') {
      if (e.action === 'start') {
        close(e.ts);
        const rec: SessionRecord = { id: e.session, strand: e.strand, skill: e.skill, start: e.ts, finished: false, gatecheck: !!e.gatecheck };
        p.sessions.push(rec);
        const due = new Set(ALL_SKILLS.filter((id) => skills[id].status === 'mastered' && (skills[id].nextReview ?? Infinity) <= e.ts));
        open = { rec, due, review: new Map(), practised: new Set(), gate: { c: 0, n: 0 } };
      } else if (open?.rec.id === e.session) {
        open.rec.end = e.ts;
        open.rec.finished = e.action === 'finish';
        close(e.ts);
      }
    } else if (e.type === 'answer') {
      if (p.seen.has(e.item)) p.repeats.add(e.id);
      p.seen.set(e.item, e.ts); // placement items count as seen, so they are not served again straight away
      const s = skills[e.skill as SkillId];
      if (s && e.phase === 'placement' && e.correct) s.scouted = true;
      if (!s || e.phase === 'placement') continue;
      s.answers.push(e);
      if (s.status === 'new') s.status = 'learning';
      if (open?.rec.id !== e.session) continue;
      if (e.phase === 'yourturn' && e.rubric === undefined) {
        let t = s.tallies.find((x) => x.session === e.session);
        if (!t) s.tallies.push((t = { session: e.session, day: dayKey(e.ts), ts: e.ts, correct: 0, total: 0, transferCorrect: false, topLevel: 0 }));
        t.total += 1;
        if (e.correct) t.correct += 1;
        if (e.correct && e.transfer) t.transferCorrect = true;
        if (e.correct && e.level) t.topLevel = Math.max(t.topLevel, e.level);
        open.practised.add(s.skill);
      } else if (e.phase === 'warmup' && open.due.has(s.skill)) {
        const r = open.review.get(s.skill) ?? { c: 0, n: 0 };
        open.review.set(s.skill, { c: r.c + (e.correct ? 1 : 0), n: r.n + 1 });
      } else if (e.phase === 'gatecheck') {
        open.gate.n += 1;
        if (e.correct) open.gate.c += 1;
      }
    }
  }
  close(events.length ? Math.max(...events.map((e) => e.ts)) : 0);
  return p;
}

// ---------------------------------------------------------------- the gate

export type GateOverride = 'auto' | 'open' | 'hold';
export interface GateState {
  conditions: { narrative: boolean; functional: boolean; lasted: boolean; inference: boolean };
  opened: boolean;
  /** An earlier skill slipped; the strand rests until it recovers. */
  resting: boolean;
  available: boolean;
  /** Conditions 1 to 3 hold, so the inference check can be offered. */
  checkReady: boolean;
}

export function gate(p: Progress, override: GateOverride = 'auto'): GateState {
  const mastered = (ids: SkillId[]) => ids.every((id) => p.skills[id].status === 'mastered');
  const conditions = {
    narrative: mastered(['N1', 'N2', 'N3', 'N4', 'N5']),
    functional: mastered(['F1', 'F2', 'F3']),
    lasted: GATE_SKILLS.every((id) => p.skills[id].status === 'mastered' && p.skills[id].reviewStage >= 3),
    inference: p.inferencePassed,
  };
  const resting = GATE_SKILLS.some((id) => p.skills[id].relearning);
  return {
    conditions,
    opened: p.gateOpened,
    resting,
    available: override === 'open' || (override === 'auto' && p.gateOpened && !resting),
    checkReady: !p.gateOpened && conditions.narrative && conditions.functional && conditions.lasted && !conditions.inference,
  };
}

// ---------------------------------------------------------------- choosing what to do

/** The lowest step not yet mastered; when all are mastered, the one whose review is nearest. */
export function focusSkill(p: Progress, strand: Strand): SkillId {
  const ids = skillsOf(strand);
  return ids.find((id) => p.skills[id].status !== 'mastered') ?? [...ids].sort((a, b) => (p.skills[a].nextReview ?? 0) - (p.skills[b].nextReview ?? 0))[0];
}

export type Choice = { kind: 'strand'; strand: Strand; skill: SkillId } | { kind: 'gatecheck' };

/** The two or three cards on the Choose step. */
export function choices(p: Progress, g: GateState, now: number): Choice[] {
  const out: Choice[] = (['functional', 'narrative'] as const).map((strand) => ({ kind: 'strand', strand, skill: focusSkill(p, strand) }));
  const recent = p.sessions.filter((s) => s.finished && !s.gatecheck).slice(-(RULES.philosophicalOneIn - 1));
  if (g.available && !recent.some((s) => s.strand === 'philosophical')) out.push({ kind: 'strand', strand: 'philosophical', skill: focusSkill(p, 'philosophical') });
  else if (g.checkReady && !p.sessions.some((s) => s.gatecheck && dayKey(s.start) === dayKey(now))) out.push({ kind: 'gatecheck' });
  return out;
}

// ---------------------------------------------------------------- the content pool and item choice

export interface Pool {
  items: Map<string, Item>;
  passages: Map<string, Passage>;
  bySkill: Map<SkillId, Item[]>;
  models: Map<SkillId, Model>;
}
export function buildPool(banks: readonly SkillBank[]): Pool {
  const pool: Pool = { items: new Map(), passages: new Map(), bySkill: new Map(), models: new Map() };
  for (const b of banks) {
    b.passages.forEach((x) => pool.passages.set(x.id, x));
    b.items.forEach((x) => pool.items.set(x.id, x));
    pool.bySkill.set(b.skill, (pool.bySkill.get(b.skill) ?? []).concat(b.items));
    pool.models.set(b.skill, b.model);
  }
  return pool;
}

export interface PickContext {
  pool: Pool;
  seen: Map<string, number>;
  interests: readonly Topic[];
  /** Loss, illness, suffering and fear stay hidden until an adult turns them on. */
  allowThemes: boolean;
  hidden?: ReadonlySet<string>;
  rng: () => number;
}
export interface PickOptions {
  exclude?: ReadonlySet<string>;
  maxLevel?: number;
  /** His level on this skill: nothing harder is served, and items at this level come first. */
  level?: number;
  transfer?: boolean;
  tier?: 'understand' | 'express';
  gatecheck?: boolean;
}

/**
 * The text level he is ready for on a skill. Two first-try answers in a row at his level move him up;
 * two misses in a row move him down. Levels 4 and 5 are reached only this way, so harder texts are
 * gated on his own performance.
 */
export function levelFor(s: SkillState, pool: Pool): number {
  let level = 1, streak = 0, misses = 0;
  for (const a of s.answers) {
    if (a.rubric !== undefined) continue;
    const lv = a.level ?? pool.items.get(a.item)?.level ?? 1;
    if (lv < level) continue; // easier items do not move him
    if (a.correct) {
      misses = 0;
      if (++streak >= RULES.levelUpStreak) { level = Math.min(RULES.maxLevel, level + 1); streak = 0; }
    } else {
      streak = 0;
      if (++misses >= RULES.levelDownMisses) { level = Math.max(1, level - 1); misses = 0; }
    }
  }
  return level;
}

export const isInterest = (pool: Pool, item: Item, interests: readonly Topic[]) =>
  !!pool.passages.get(item.passage)?.topics.some((t) => interests.includes(t));

/**
 * Unseen items first, then the least recently seen. Among unseen items: interest topics first
 * (except on a deliberate neutral pick), then the lowest level. Items on a passage already
 * picked come next, so one text carries several questions.
 */
export function pickItems(ctx: PickContext, skill: SkillId, count: number, o: PickOptions = {}): Item[] {
  const { pool, seen, interests, allowThemes, hidden, rng } = ctx;
  const modelItem = pool.models.get(skill)?.item;
  const cands = (pool.bySkill.get(skill) ?? []).filter((i) =>
    i.id !== modelItem && !!i.gatecheck === !!o.gatecheck && !o.exclude?.has(i.id) && !hidden?.has(i.id) &&
    (allowThemes || !pool.passages.get(i.passage)?.themes?.length) &&
    (!o.tier || (i.tier ?? 'understand') === o.tier) && (!o.maxLevel || i.level <= o.maxLevel) && (!o.level || i.level <= o.level));
  const neutral = rng() < RULES.neutralTopicShare;
  const key = new Map(cands.map((i) => [i.id, rng()]));
  const rank = (i: Item) => [
    seen.has(i.id) ? 1 : 0,
    seen.get(i.id) ?? 0,
    neutral ? 0 : isInterest(pool, i, interests) ? 0 : 1,
    o.level ? o.level - i.level : i.level, // with a level: his level first, then just below; without: easiest first
    key.get(i.id)!,
  ];
  const cmp = (a: Item, b: Item) => {
    const ra = rank(a), rb = rank(b);
    for (let k = 0; k < ra.length; k++) if (ra[k] !== rb[k]) return ra[k] - rb[k];
    return 0;
  };
  const rest = cands.sort(cmp);
  const out: Item[] = [];
  while (out.length < count && rest.length) {
    const sameText = rest.findIndex((i) => !seen.has(i.id) && out.some((x) => x.passage === i.passage) && Math.abs(i.level - out[0].level) <= 1);
    out.push(rest.splice(sameText >= 0 ? sameText : 0, 1)[0]);
  }
  if (o.transfer && out.length && !out.some((i) => i.transfer)) {
    const t = rest.find((i) => i.transfer);
    if (t) out[out.length - 1] = t;
  }
  return out;
}

export interface SessionPlan {
  strand: Strand;
  skill: SkillId;
  /** His level on the focus skill when the session was planned. */
  level: number;
  /** He has already solved this kind of item on his own, so the worked example is skipped. */
  skipWatch: boolean;
  /** He has shown he works this skill independently, so guided practice is skipped for more of his own. */
  skipTogether: boolean;
  /** He has never practised this skill: its first guided item shows the clue at once (LTF-01). */
  newSkill: boolean;
  /** Skills whose review happens in this warm-up. */
  review: SkillId[];
  warmup: Item[];
  model?: { item: Item; steps: Model['steps'] };
  together: Item[];
  yourturn: Item[];
  /** Philosophical only: one expressing-tier item, tracked as growth and never blocking. */
  express: Item[];
}

export function planSession(p: Progress, ctx: PickContext, strand: Strand, now: number, yourTurnCount = 4): SessionPlan {
  const skill = focusSkill(p, strand);
  const used = new Set<string>();
  const take = (items: Item[]) => (items.forEach((i) => used.add(i.id)), items);
  const s = p.skills;

  const due = ALL_SKILLS.filter((id) => s[id].status === 'mastered' && (s[id].nextReview ?? Infinity) <= now)
    .sort((a, b) => s[a].nextReview! - s[b].nextReview!).slice(0, 3);
  const warmup: Item[] = [];
  for (const id of due) warmup.push(...take(pickItems(ctx, id, due.length === 1 ? 2 : 1, { exclude: used, tier: 'understand', level: levelFor(s[id], ctx.pool) })));
  const review = due.filter((id) => warmup.some((i) => i.skill === id));
  const earlier = ALL_SKILLS.filter((id) => id !== skill && !due.includes(id) && (s[id].everMastered || s[id].answers.length > 0))
    .sort((a, b) => (s[a].answers.at(-1)?.ts ?? 0) - (s[b].answers.at(-1)?.ts ?? 0));
  for (const id of earlier) {
    if (warmup.length >= 2) break;
    warmup.push(...take(pickItems(ctx, id, 1, { exclude: used, maxLevel: 2, tier: 'understand' })));
  }
  if (warmup.length < 2) warmup.push(...take(pickItems(ctx, skill, 2 - warmup.length, { exclude: used, maxLevel: 1, tier: 'understand' })));

  // Once he has solved this kind of item on his own, in scouting or in practice, he does not need it shown again.
  const level = levelFor(s[skill], ctx.pool);
  const st = s[skill];
  const skipWatch = st.scouted || st.answers.some((a) => a.correct);
  const last = st.tallies.at(-1);
  const skipTogether = (!!last && last.total >= RULES.minPerSession && last.correct / last.total >= RULES.mastery) ||
    (st.answers.length >= 3 && st.answers.slice(-3).every((a) => a.correct));
  const m = ctx.pool.models.get(skill);
  const modelItem = m && ctx.pool.items.get(m.item);
  const together = skipTogether ? [] : take(pickItems(ctx, skill, warmup.length >= 3 ? 2 : 3, { exclude: used, tier: 'understand', level }));
  const yourturn = take(pickItems(ctx, skill, yourTurnCount + (skipTogether ? 2 : 0), { exclude: used, tier: 'understand', transfer: true, level }));
  const express = strand === 'philosophical' ? take(pickItems(ctx, skill, 1, { exclude: used, tier: 'express' })) : [];
  return {
    strand, skill, level, skipWatch, skipTogether, newSkill: st.answers.length === 0, review, warmup,
    model: !skipWatch && modelItem && m ? { item: modelItem, steps: m.steps } : undefined,
    together, yourturn, express,
  };
}

/** Five unseen inference items about passages the learner has not practised on (gate condition 4). */
export function planGateCheck(ctx: PickContext): Item[] {
  const lists = (['N3', 'N5', 'N6'] as SkillId[]).map((id) => pickItems(ctx, id, RULES.gateCheckItems, { gatecheck: true }));
  const out: Item[] = [];
  for (let k = 0; out.length < RULES.gateCheckItems && lists.some((l) => l.length > k); k++)
    for (const l of lists) if (l[k] && out.length < RULES.gateCheckItems) out.push(l[k]);
  return out;
}

// ---------------------------------------------------------------- placement

/** One placement item per step, in step order. */
export const placementItems = (pool: Pool, strand: 'functional' | 'narrative') =>
  skillsOf(strand).map((id) => pool.bySkill.get(id)?.find((i) => i.placement)).filter((i): i is Item => !!i);

/** The starting step is the first step missed. Steps below it start as mastered and enter review. */
export function placementStart(results: readonly { skill: SkillId; correct: boolean }[]): number {
  const miss = results.filter((r) => !r.correct).map((r) => stepOf(r.skill));
  return miss.length ? Math.min(...miss) : 6;
}

/** Read-aloud when listening beats reading by a clear margin or word reading is shaky (R1). */
export const placementSupports = (r: { word: number; reading: number; listening: number }) => ({
  readAloud: r.listening - r.reading >= 0.3 || r.word < 0.75,
  pictures: r.word < 0.75,
});

// ---------------------------------------------------------------- reports for the adult

export type ReportStatus = 'not started' | 'learning' | 'mastered' | 'review due';
export function statusOf(s: SkillState, now: number): ReportStatus {
  if (s.status === 'mastered') return (s.nextReview ?? Infinity) <= now ? 'review due' : 'mastered';
  return s.answers.length ? 'learning' : 'not started';
}

/** Average hint level over the last ten answers outside your-turn. */
export function hintNeed(s: SkillState): number | undefined {
  const a = s.answers.filter((x) => x.phase !== 'yourturn').slice(-10);
  return a.length ? a.reduce((n, x) => n + x.hint, 0) / a.length : undefined;
}

/** Your-turn accuracy per session, for the trend line. */
export const trend = (s: SkillState) => s.tallies.map((t) => ({ ts: t.ts, acc: t.correct / t.total, n: t.total }));

/** Item tags the learner misses most, from the last 30 answers on the skill. */
export function errorPatterns(s: SkillState, pool: Pool) {
  const counts = new Map<string, { missed: number; total: number }>();
  for (const a of s.answers.slice(-30)) for (const tag of pool.items.get(a.item)?.tags ?? []) {
    const c = counts.get(tag) ?? { missed: 0, total: 0 };
    c.total += 1;
    if (!a.correct) c.missed += 1;
    counts.set(tag, c);
  }
  return [...counts].map(([tag, c]) => ({ tag, ...c })).filter((c) => c.missed >= 2 && c.missed / c.total >= 0.5).sort((a, b) => b.missed - a.missed);
}

/** Your-turn accuracy on interest topics against other topics (R8: test the effect, do not assume it). */
export function interestEffect(p: Progress) {
  const r = { interest: { correct: 0, total: 0 }, other: { correct: 0, total: 0 } };
  for (const s of Object.values(p.skills)) for (const a of s.answers) if (a.phase === 'yourturn' && a.rubric === undefined) {
    const b = a.interest ? r.interest : r.other;
    b.total += 1;
    if (a.correct) b.correct += 1;
  }
  return r;
}

// ---------------------------------------------------------------- the journey (Learning to Fly)

/**
 * Which story beat shows after each finished session of a leg. Beats are: 0 the start of the
 * leg, 1 progress, 2 an obstacle, 3 the obstacle overcome, 4 almost there. A short leg still
 * shows the obstacle and how it was overcome; a long leg repeats the calm beats.
 */
export const BEATS_FOR_LEG: Record<number, number[]> = { 3: [0, 2, 3], 5: [0, 1, 2, 3, 4], 7: [0, 1, 1, 2, 3, 4, 4] };

/** Where the learner was when the pace last changed, so a new pace never moves him back. */
export interface JourneyAnchor { at: number; stop: number; step: number; after: number }
export const JOURNEY_START: JourneyAnchor = { at: 0, stop: 0, step: 0, after: 0 };

/**
 * Where the learner is on the journey from Home Island to Australia. It moves with finished
 * sessions only, never with scores, and it never moves back (R9). With five sessions a leg and
 * six stops, Australia comes at session 25, the dose the research judged by (R7).
 */
export function journeyPosition(finished: number, stops: number, legLength: number, from: JourneyAnchor = JOURNEY_START) {
  const legs = stops - 1;
  const n = Math.max(0, finished - from.at);
  if (from.stop >= legs) return { stop: legs, step: 0, beat: -1, arrived: true, after: from.after + n };
  const eff = Math.min(from.step, legLength - 1) + n;
  const stop = Math.min(legs, from.stop + Math.floor(eff / legLength));
  if (stop === legs) return { stop, step: 0, beat: -1, arrived: true, after: eff - (legs - from.stop) * legLength };
  const step = eff - (stop - from.stop) * legLength;
  const table = BEATS_FOR_LEG[legLength] ?? BEATS_FOR_LEG[5];
  return { stop, step, beat: table[Math.min(step, table.length - 1)], arrived: false, after: 0 };
}

/** First-time accuracy on items with a given tag (warm-up and your-turn answers only), for the school's goals. */
export function tagAccuracy(p: Progress, pool: Pool, tag: string, o: { firstTimeOnly?: boolean } = {}) {
  const r = { correct: 0, total: 0 };
  for (const s of Object.values(p.skills)) for (const a of s.answers)
    if ((a.phase === 'yourturn' || a.phase === 'warmup') && a.rubric === undefined && pool.items.get(a.item)?.tags?.includes(tag) && !(o.firstTimeOnly && p.repeats.has(a.id))) {
      r.total += 1;
      if (a.correct) r.correct += 1;
    }
  return r;
}

/** Small seeded generator so item choice is reproducible in tests. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export * from './activity';
export * from './fresh';
