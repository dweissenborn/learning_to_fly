// How sessions go, and the flight kit. Pure functions over the event log, like the rest of the engine.
import type { AnswerEvent, LogEvent, RecountEvent } from '@wayfinder/schema';

/** No touch or key for this long during a task counts as an idle spell. */
export const IDLE_MS = 45_000;

// ---------------------------------------------------------------- flight kit
/**
 * His guide gears up for the flight to Australia. Since LTF-38 points reward thinking rather than tapping through
 * (see pointsFor and docs/why-it-works.md): 4 right on the first tap, 2 with the clue, 1 off when the answer was shown,
 * none for a guess faster than reading, 3 for finishing a session. Gear follows his best total, so it is never lost.
 */
export interface GearPiece { id: string; name: string; emoji: string; at: number; worn: boolean }
export const GEAR: readonly GearPiece[] = [
  { id: 'cap', name: 'Flight cap', emoji: '🧢', at: 4, worn: true },
  { id: 'scarf', name: 'Red scarf', emoji: '🧣', at: 12, worn: true },
  { id: 'goggles', name: 'Goggles', emoji: '🥽', at: 25, worn: true },
  { id: 'compass', name: 'Compass', emoji: '🧭', at: 45, worn: false },
  { id: 'backpack', name: 'Backpack', emoji: '🎒', at: 70, worn: true },
  { id: 'map', name: 'Map', emoji: '🗺️', at: 100, worn: false },
  { id: 'jacket', name: 'Flight jacket', emoji: '🧥', at: 135, worn: true },
  { id: 'flashlight', name: 'Flashlight', emoji: '🔦', at: 175, worn: false },
  { id: 'headset', name: 'Radio headset', emoji: '🎧', at: 220, worn: true },
  { id: 'logbook', name: 'Pilot logbook', emoji: '📓', at: 270, worn: false },
  { id: 'wings', name: 'Pilot wings', emoji: '🎖️', at: 330, worn: true },
  { id: 'ready', name: 'Ready for take-off', emoji: '✈️', at: 400, worn: true },
];

/**
 * LTF-38: what an answer earns, saved on it when it is given. Right on the first tap: four. Right with the clue: two.
 * When the answer had to be shown: one comes off. A guess faster than the question could be read: none.
 */
export function pointsFor(a: { correct: boolean; shown?: boolean; rapid?: boolean }): number {
  if (a.rapid) return 0;
  if (a.correct) return 4;
  return a.shown ? -1 : 2;
}

function* pointSteps(events: readonly LogEvent[]) {
  for (const e of events) {
    if (e.type === 'answer') yield e.points ?? 2; // answers before LTF-38 earned two each
    else if (e.type === 'session' && e.action === 'finish') yield 3;
    else if (e.type === 'activity' && e.kind === 'boost') yield e.points ?? 0;
  }
}
export function flightPoints(events: readonly LogEvent[]): number {
  let pts = 0;
  for (const d of pointSteps(events)) pts += d;
  return pts;
}
/** The most points he has ever had. Gear follows it, so points that come off never take away a piece he earned. */
export function flightPeak(events: readonly LogEvent[]): number {
  let pts = 0, peak = 0;
  for (const d of pointSteps(events)) { pts += d; peak = Math.max(peak, pts); }
  return peak;
}

/**
 * LTF-38, for the grown-ups: answers set aside as guesses, sessions that stopped kindly because of them, breaks he asked
 * for, and the minute into a session when guessing usually begins (the median of each session's first set-aside answer).
 */
export function guessing(events: readonly LogEvent[]) {
  const start = new Map<string, number>(), first = new Map<string, number>();
  let setAside = 0, rapidStops = 0, breaks = 0;
  for (const e of events) {
    if (e.type === 'session' && e.action === 'start') start.set(e.session, e.ts);
    else if (e.type === 'session' && e.action === 'stop') { if (e.reason === 'rapid') rapidStops++; else if (e.reason === 'break') breaks++; }
    else if (e.type === 'answer' && e.rapid) {
      setAside++;
      const s = start.get(e.session);
      if (s !== undefined && !first.has(e.session)) first.set(e.session, (e.ts - s) / 60_000);
    }
  }
  const mins = [...first.values()].sort((a, b) => a - b);
  const mid = mins.length ? (mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2) : undefined;
  return { setAside, rapidStops, breaks, startMinute: mid === undefined ? undefined : Math.round(mid) };
}

export function gearState(points: number, peak = points) {
  const owned = GEAR.filter((g) => peak >= g.at);
  const next = GEAR.find((g) => peak < g.at);
  const from = owned.at(-1)?.at ?? 0;
  return { points, owned, next, toNext: next ? next.at - points : 0, frac: next ? Math.max(0, (points - from) / (next.at - from)) : 1 };
}

// ---------------------------------------------------------------- sessions, moment to moment
export type StepName = 'plan' | 'choose' | 'warmup' | 'watch' | 'together' | 'yourturn' | 'gatecheck' | 'checkup' | 'finish';
export interface SessionActivity {
  id: string;
  start: number;
  end: number;
  skill?: string;
  outcome: 'finished' | 'stopped' | 'left';
  /** The step he was on when the session ended (or the last one he reached). */
  lastStep?: StepName;
  steps: { step: StepName; ms: number }[];
  idle: number;
  idleMs: number;
  away: number;
  awayMs: number;
  answers: number;
  firstTry: number;
  skippedDemo: boolean;
}

const PHASE_STEP: Record<string, StepName> = { warmup: 'warmup', together: 'together', yourturn: 'yourturn', gatecheck: 'gatecheck', checkup: 'checkup' };

/** One summary per session, oldest first. Sessions from before activity logging infer their last step from answers. */
export function sessionActivity(events: readonly LogEvent[]): SessionActivity[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const out = new Map<string, SessionActivity & { marks: { step: StepName; ts: number }[]; warm: number }>();
  for (const e of sorted) {
    if (e.type === 'session' && e.action === 'start') {
      out.set(e.session, { id: e.session, start: e.ts, end: e.ts, skill: e.skill, outcome: 'left', steps: [], idle: 0, idleMs: 0, away: 0, awayMs: 0, answers: 0, firstTry: 0, skippedDemo: false, marks: [], warm: 0 });
      continue;
    }
    if (!('session' in e)) continue;
    const s = out.get(e.session);
    if (!s) continue;
    s.end = Math.max(s.end, e.ts);
    if (e.type === 'session') {
      s.outcome = e.action === 'finish' ? 'finished' : 'stopped';
      if (e.action === 'finish') s.lastStep = 'finish';
    } else if (e.type === 'answer') {
      s.answers += 1;
      if (e.correct && e.tries <= 1) s.firstTry += 1;
      if (!s.marks.length && PHASE_STEP[e.phase] && s.lastStep !== 'finish') { s.lastStep = PHASE_STEP[e.phase]; if (e.phase === 'warmup') s.warm += 1; }
    } else if (e.type === 'activity') {
      if (e.kind === 'step' && e.step) { s.marks.push({ step: e.step, ts: e.ts }); if (s.lastStep !== 'finish' || e.step === 'finish') s.lastStep = e.step; }
      else if (e.kind === 'idle') s.idle += 1;
      else if (e.kind === 'away') s.away += 1;
      else if (e.kind === 'back' && e.from === 'idle') s.idleMs += e.ms ?? 0;
      else if (e.kind === 'back' && e.from === 'away') s.awayMs += e.ms ?? 0;
      else if (e.kind === 'skip-demo') s.skippedDemo = true;
    }
  }
  return [...out.values()].map(({ marks, warm, ...s }) => ({
    ...s,
    // Before step logging: two warm-ups answered and nothing after means he had reached the demo.
    // ponytail: a plan with three due reviews would be misread; only sessions from before 2026-10-13 rely on this.
    lastStep: !marks.length && s.lastStep === 'warmup' && warm >= 2 && s.outcome !== 'finished' ? 'watch' : s.lastStep,
    steps: marks.map((m, i) => ({ step: m.step, ms: (marks[i + 1]?.ts ?? s.end) - m.ts })),
  }));
}

/**
 * The step where his recent sessions usually end, if there is a clear one:
 * at least 2 of his last 5 unfinished sessions ended there.
 */
export function usualStop(events: readonly LogEvent[]): StepName | undefined {
  const ended = sessionActivity(events).filter((s) => s.outcome !== 'finished' && s.lastStep && s.lastStep !== 'finish').slice(-5);
  const count = new Map<StepName, number>();
  for (const s of ended) count.set(s.lastStep!, (count.get(s.lastStep!) ?? 0) + 1);
  const [step, n] = [...count].sort((a, b) => b[1] - a[1])[0] ?? [];
  return n !== undefined && n >= 2 ? step : undefined;
}

// ---------------------------------------------------------------- hint wait (LTF-01)
/**
 * Guided-practice answers with the clue shown at once (a new skill's first item) against after the usual wait,
 * right first time, on questions he had not answered before. Answers from before the wait was recorded are left out.
 */
export function delayEffect(events: readonly LogEvent[], p: { repeats: ReadonlySet<string> }) {
  const r = { atOnce: { correct: 0, total: 0 }, afterWait: { correct: 0, total: 0 }, total: 0 };
  for (const e of events) {
    if (e.type !== 'answer' || e.phase !== 'together' || e.delay === undefined || p.repeats.has(e.id)) continue;
    const b = e.delay === 0 ? r.atOnce : r.afterWait;
    b.total += 1;
    if (e.correct && e.tries <= 1) b.correct += 1;
    r.total += 1;
  }
  return r;
}

// ---------------------------------------------------------------- how his telling is growing (LTF-08)
export interface RecountRow { ts: number; sentences: number; parts: number; typed: boolean; after: boolean; skipped: string[] }

/**
 * Recounts over time. Length always travels with the parts of the day he told, because a longer recount of the
 * same part is not the same growth as telling more of the day. Recounts saved before sentences were counted are left out.
 */
export function recountTrend(events: readonly LogEvent[]) {
  const recounts: RecountRow[] = events
    .filter((e): e is RecountEvent => e.type === 'recount' && typeof e.sentences === 'number')
    .sort((a, b) => a.ts - b.ts)
    .map((e) => ({ ts: e.ts, sentences: e.sentences!, parts: e.parts, typed: !!e.typed, after: !!e.after, skipped: e.skipped ?? [] }));
  const skips = new Map<string, number>();
  for (const r of recounts) for (const k of r.skipped) skips.set(k, (skips.get(k) ?? 0) + 1);
  const k = Math.min(5, Math.floor(recounts.length / 2));
  const mean = (rs: RecountRow[]) => (rs.length ? { n: rs.length, sentences: rs.reduce((t, r) => t + r.sentences, 0) / rs.length, parts: rs.reduce((t, r) => t + r.parts, 0) / rs.length } : null);
  return {
    recounts,
    skippedMost: [...skips].sort((a, b) => b[1] - a[1]),
    ownWords: { count: recounts.filter((r) => r.typed).length, of: recounts.length },
    after: { count: recounts.filter((r) => r.after).length, of: recounts.length },
    early: k ? mean(recounts.slice(0, k)) : null,
    recent: k ? mean(recounts.slice(-k)) : null,
  };
}

/**
 * LTF-15: right first time by question type, compared only within the same skill and level, on his own first-time
 * answers (warm-up and your turn). A skill and level answered in only one format has nothing to compare, so it is left out.
 */
export function formatEffect(p: { skills: Record<string, { answers: AnswerEvent[] }>; repeats: ReadonlySet<string> }) {
  const cells = new Map<string, Map<string, { correct: number; total: number }>>();
  for (const s of Object.values(p.skills)) for (const a of s.answers) {
    if ((a.phase !== 'yourturn' && a.phase !== 'warmup') || a.rubric !== undefined || a.level === undefined || p.repeats.has(a.id)) continue;
    const key = `${a.skill}|${a.level}`;
    if (!cells.has(key)) cells.set(key, new Map());
    const byFormat = cells.get(key)!;
    if (!byFormat.has(a.format)) byFormat.set(a.format, { correct: 0, total: 0 });
    const r = byFormat.get(a.format)!;
    r.total += 1;
    if (a.correct) r.correct += 1;
  }
  return [...cells].filter(([, f]) => f.size > 1).map(([k, f]) => ({
    skill: k.split('|')[0], level: Number(k.split('|')[1]),
    formats: [...f].sort(([x], [y]) => x.localeCompare(y)).map(([format, r]) => ({ format, ...r })),
  })).sort((x, y) => x.skill.localeCompare(y.skill) || x.level - y.level);
}

/**
 * LTF-02 as a single-case record: his N5 right-first-time on his own first-time answers (warm-up and your turn),
 * before and after he first saw a reasoning card. He sees one at the second hint of an item that has a card.
 */
export function reasonRecord(p: { skills: Record<string, { answers: AnswerEvent[] }>; repeats: ReadonlySet<string> }) {
  const since = Object.values(p.skills).flatMap((s) => s.answers).filter((a) => a.card).sort((a, b) => a.ts - b.ts)[0]?.ts;
  const r = { before: { correct: 0, total: 0 }, after: { correct: 0, total: 0 }, since };
  for (const a of p.skills.N5?.answers ?? []) {
    if ((a.phase !== 'yourturn' && a.phase !== 'warmup') || p.repeats.has(a.id)) continue;
    const side = since !== undefined && a.ts >= since ? r.after : r.before;
    side.total += 1;
    if (a.correct) side.correct += 1;
  }
  return r;
}

const DAY = 86_400_000;
/**
 * LTF-07: from stage 3 the tiles wait behind "Show me ideas", and each day recount records, per answered question, whether
 * he opened them. Today steps back a stage once he has had the button for two weeks and opened the ideas on every question
 * in at least three recounts over the last two weeks. It moves on again by itself once fewer than three recent recounts do.
 */
export function ideasUse(events: readonly LogEvent[], now = Date.now()) {
  const rs = events.filter((e): e is RecountEvent => e.type === 'recount' && !!e.ideas?.length).sort((a, b) => a.ts - b.ts);
  const week = rs.filter((r) => r.ts > now - 7 * DAY).flatMap((r) => r.ideas!);
  const recent = rs.filter((r) => r.ts > now - 14 * DAY);
  const stepBack = !!rs.length && rs[0].ts <= now - 14 * DAY && recent.length >= 3 && recent.every((r) => r.ideas!.every(Boolean));
  return { recounts: rs.length, week: { without: week.filter((x) => !x).length, of: week.length }, stepBack };
}

// ---------------------------------------------------------------- what the grown-ups can take from it
export interface Insight { tone: 'good' | 'watch' | 'act'; title: string; detail: string; tryThis?: string }

export const STEP_LABEL: Record<StepName, string> = {
  plan: 'the plan', choose: 'choosing where to go', warmup: 'the warm-up', watch: 'the demo (Watch)',
  together: 'guided practice (Together)', yourturn: 'his own practice (Your turn)', gatecheck: 'the Lantern Peaks check', checkup: 'a check-up flight', finish: 'the finish',
};
const TRY_AT: Partial<Record<StepName, string>> = {
  warmup: 'Warm-ups review skills he already has. If they feel like repeats, a short chat about what is coming next can help him push on.',
  watch: 'Demos now disappear for any skill he has shown he can do, and every demo has a "Got it, skip" button. Show him that button once.',
  together: 'Guided practice drops out once he works a skill on his own. Until then, sit with him for this part, or turn on read-aloud.',
  yourturn: 'Try fewer of his own questions per session (Settings, "Your-turn items per session"), so the finish comes sooner.',
  choose: 'If choosing is hard, choose together, or always start with the same strand.',
  plan: 'If the plan screen is too long, tell him the plan out loud and press "Let\'s go" together.',
};

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const partOfDay = (ts: number) => { const h = new Date(ts).getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; };

/** Plain-language patterns, strongest first. Each needs enough sessions to say anything; otherwise it stays quiet. */
export function insights(events: readonly LogEvent[], skillName: (id: string) => string = (id) => id): Insight[] {
  const all = sessionActivity(events);
  const recent = all.slice(-8);
  const out: Insight[] = [];
  if (all.length < 3) return [{ tone: 'good', title: 'Not enough sessions yet', detail: `Patterns show up after about three sessions. So far: ${all.length}.` }];

  // Where sessions end.
  const unfinished = recent.filter((s) => s.outcome !== 'finished' && s.lastStep && s.lastStep !== 'finish');
  const stop = usualStop(events);
  if (stop) {
    const n = unfinished.filter((s) => s.lastStep === stop).length;
    out.push({ tone: 'act', title: `Sessions often end at ${STEP_LABEL[stop]}`, detail: `${n} of his last ${recent.length} sessions ended there. When he gets past it, the app now gives him a bonus and says so.`, tryThis: TRY_AT[stop] });
  }
  const finished = recent.filter((s) => s.outcome === 'finished').length;
  const done = `${finished} of his last ${recent.length} sessions ${finished === 1 ? 'was' : 'were'} finished.`;
  if (finished / recent.length >= 0.75) out.push({ tone: 'good', title: 'He finishes most sessions', detail: done });
  else if (finished / recent.length <= 0.34) out.push({ tone: 'watch', title: 'Most sessions end early', detail: done, tryThis: 'Shorter sessions finish more often: try fewer of his own questions per session in Settings.' });

  // Where he pauses.
  const idleBy = new Map<StepName, number>();
  for (const e of events) if (e.type === 'activity' && e.kind === 'idle' && e.step && recent.some((s) => s.id === e.session)) idleBy.set(e.step, (idleBy.get(e.step) ?? 0) + 1);
  const [pauseStep, pauses] = [...idleBy].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (pauseStep && pauses >= 3) out.push({ tone: 'watch', title: `He often pauses during ${STEP_LABEL[pauseStep]}`, detail: `${pauses} pauses of 45 seconds or more in his recent sessions. The guide now offers to read aloud or give a hint when he pauses.`, tryThis: TRY_AT[pauseStep] });
  const away = recent.reduce((n, s) => n + s.away, 0);
  if (away >= 3) out.push({ tone: 'watch', title: 'He leaves the app during sessions', detail: `The app was put away ${away} times in his recent sessions.`, tryThis: 'Notifications or other apps may be pulling him away. A focus mode on the device can help.' });
  const skips = recent.filter((s) => s.skippedDemo).length;
  if (skips >= 2) out.push({ tone: 'good', title: 'He skips demos and goes straight to trying', detail: `He pressed "Got it, skip" in ${skips} sessions. That fits how he learns: show once, then let him do it.` });

  // Which sections take him longest, and which come easily.
  const answers = events.filter((e): e is AnswerEvent => e.type === 'answer' && e.phase !== 'placement' && e.ms > 0);
  const usual = median(answers.map((a) => a.ms));
  if (usual > 0) {
    const bySkill = new Map<string, AnswerEvent[]>();
    for (const a of answers) bySkill.set(a.skill, [...(bySkill.get(a.skill) ?? []), a]);
    for (const [skill, list] of bySkill) {
      if (list.length < 4) continue;
      const r = median(list.map((a) => a.ms)) / usual;
      const first = list.filter((a) => a.correct && a.tries <= 1).length / list.length;
      if (r >= 1.8) out.push({ tone: 'act', title: `${skillName(skill)} takes him longer`, detail: `His answers here take about ${r.toFixed(1)} times his usual time.`, tryThis: 'This section may need a boost: read-aloud, texts on his interests, or sitting with him for one session. Check which texts took longest in the Skills tab.' });
      else if (r <= 0.6 && first >= 0.9) out.push({ tone: 'good', title: `${skillName(skill)} comes easily`, detail: `He answers in about ${r.toFixed(1)} times his usual time and gets ${Math.round(first * 100)}% right first time.`, tryThis: 'Harder texts open by themselves after two right in a row, so this will stretch him soon.' });
    }
  }

  // When he does best.
  const parts = new Map<string, { n: number; done: number }>();
  for (const s of recent) { const p = parts.get(partOfDay(s.start)) ?? { n: 0, done: 0 }; p.n += 1; if (s.outcome === 'finished') p.done += 1; parts.set(partOfDay(s.start), p); }
  const ranked = [...parts].filter(([, p]) => p.n >= 2).sort((a, b) => b[1].done / b[1].n - a[1].done / a[1].n);
  if (ranked.length >= 2 && ranked[0][1].done / ranked[0][1].n - ranked.at(-1)![1].done / ranked.at(-1)![1].n >= 0.4)
    out.push({ tone: 'good', title: `He finishes more sessions in the ${ranked[0][0]}`, detail: `${ranked[0][1].done} of ${ranked[0][1].n} in the ${ranked[0][0]}, against ${ranked.at(-1)![1].done} of ${ranked.at(-1)![1].n} in the ${ranked.at(-1)![0]}.` });

  const order = { act: 0, watch: 1, good: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
