// LTF-40: typed math answers, judged by exact arithmetic, and fresh plain problems for each skill. Code decides
// correctness, never a model. Equivalent forms count unless a problem asks for one form, and the usual wrong answers are
// recognised by name so the feedback can say what happened. Dividing fractions follows keep, change, flip.

/** A fraction as [numerator, denominator]; whole numbers are [n, 1]. */
export type Frac = [number, number];
export type MathOp = 'shade' | 'fact' | 'quot' | 'gcf' | 'divrem' | 'equiv' | 'simplify' | 'tomixed' | 'toimproper' | 'mul' | 'div';
/** What the keypad sends: strings as typed, any box may be empty. */
export interface Entry { whole?: string; num?: string; den?: string; rem?: string }
export interface MathProblem {
  skill: string;
  op: MathOp;
  a: Frac;
  /** The second number: a factor, a divisor, or for `equiv` the denominator to reach. */
  b: Frac;
  form: 'any' | 'simplest' | 'mixed' | 'improper';
  /** The answer's shape on the keypad, so the box is never blank. */
  shape: 'whole' | 'fraction' | 'mixed' | 'remainder';
  prompt: string;
  /** The right answer as the keypad would enter it. */
  answer?: Entry;
  /** A picture to read the problem from: a bar cut into equal parts, some shaded (FR1). */
  bar?: { parts: number; shaded: number };
}
export type MathError = 'not-simplest' | 'not-mixed' | 'not-improper' | 'added-whole' | 'no-flip' | 'flipped-first' | 'added-across'
  | 'cross-multiplied' | 'added-not-multiplied' | 'remainder-too-big' | 'neighbour-fact' | 'not-greatest'
  // LTF-43: named too, so every kind of problem has wrong choices built from real mistakes
  | 'counted-unshaded' | 'part-over-part' | 'upside-down' | 'no-remainder' | 'divided-one' | 'common-multiple' | 'kept-top' | 'multiplied-top-only' | 'flipped-both';
export interface Judged { right: boolean; error?: MathError; incomplete?: boolean }

/** The skills with typed problems. FR1 reads a fraction off a bar picture; placing one on a 0 to 1 line comes later. */
export const MATH_SKILLS = ['math:MF1', 'math:MF2', 'math:DV1', 'math:FR1', 'math:FR2', 'math:FR3', 'math:FR4', 'math:FR5', 'math:FR6'] as const;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const reduce = ([n, d]: Frac): Frac => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
const same = (x: Frac, y: Frac) => x[0] * y[1] === y[0] * x[1];
const times = (x: Frac, y: Frac): Frac => [x[0] * y[0], x[1] * y[1]];
const flip = ([n, d]: Frac): Frac => [d, n];
const int = (s?: string) => (s !== undefined && /^\d+$/.test(s.trim()) ? Number(s.trim()) : undefined);
export const fracText = ([n, d]: Frac) => (d === 1 ? `${n}` : `${n}/${d}`);
const mixedText = ([n, d]: Frac) => (n >= d && n % d ? `${Math.floor(n / d)} ${n % d}/${d}` : fracText([n, d]));

/** The right value of a problem (for `divrem`, the quotient; its remainder is checked on its own). */
function target(p: MathProblem): Frac {
  const [a, b] = [p.a, p.b];
  switch (p.op) {
    case 'fact': return [a[0] * b[0], 1];
    case 'quot': return [a[0] / b[0], 1];
    case 'gcf': return [gcd(a[0], b[0]), 1];
    case 'divrem': return [Math.floor(a[0] / b[0]), 1];
    case 'mul': return times(a, b);
    case 'div': return times(a, flip(b));
    default: return a; // equiv, simplify, tomixed, toimproper keep the value
  }
}

/** The usual wrong answers for a problem, by name: the value each one gives. */
function slips(p: MathProblem): [MathError, Frac][] {
  const [a, b] = [p.a, p.b];
  switch (p.op) {
    case 'fact': return [[`neighbour-fact`, [a[0] * (b[0] - 1), 1]], ['neighbour-fact', [a[0] * (b[0] + 1), 1]], ['neighbour-fact', [(a[0] - 1) * b[0], 1]], ['neighbour-fact', [(a[0] + 1) * b[0], 1]]];
    case 'quot': return [['neighbour-fact', [a[0] / b[0] - 1, 1]], ['neighbour-fact', [a[0] / b[0] + 1, 1]]];
    case 'gcf': { const g = gcd(a[0], b[0]); const lower: [MathError, Frac][] = []; for (let k = 1; k < g; k++) if (g % k === 0) lower.push(['not-greatest', [k, 1]]); return [...lower, ['common-multiple', [(a[0] * b[0]) / g, 1]]]; }
    case 'shade': return [['counted-unshaded', [a[1] - a[0], a[1]]], ['part-over-part', [a[0], a[1] - a[0]]], ['upside-down', [a[1], a[0]]]];
    case 'simplify': { const g = gcd(a[0], a[1]); return [['divided-one', [a[0] / g, a[1]]], ['divided-one', [a[0], a[1] / g]]]; }
    case 'toimproper': { const w = Math.floor(a[0] / a[1]); return [['added-whole', [w + (a[0] % a[1]), a[1]]]]; }
    case 'mul': return [['added-across', [a[0] + b[0], a[1] + b[1]]], ['cross-multiplied', [a[0] * b[1], a[1] * b[0]]], ['multiplied-top-only', [a[0] * b[0], a[1]]]];
    case 'div': return [['no-flip', times(a, b)], ['flipped-first', times(flip(a), b)], ['flipped-both', times(flip(a), flip(b))]];
    case 'equiv': return [['added-not-multiplied', [a[0] + (b[0] - a[1]), b[0]]], ['kept-top', [a[0], b[0]]]];
    default: return [];
  }
}

/** Judges what was typed. An unfinished answer (or a zero denominator) is neither right nor wrong. */
export function judge(p: MathProblem, e: Entry): Judged {
  const w = int(e.whole), n = int(e.num), d = int(e.den), r = int(e.rem);
  if (p.op === 'divrem') {
    if (w === undefined || r === undefined) return { right: false, incomplete: true };
    if (w * p.b[0] + r !== p.a[0]) return r === 0 && w === Math.floor(p.a[0] / p.b[0]) ? { right: false, error: 'no-remainder' } : { right: false };
    return r < p.b[0] ? { right: true } : { right: false, error: 'remainder-too-big' };
  }
  const hasFrac = n !== undefined || d !== undefined;
  if ((hasFrac && (n === undefined || d === undefined || d === 0)) || (!hasFrac && w === undefined)) return { right: false, incomplete: true };
  const v: Frac = hasFrac ? [(w ?? 0) * d! + n!, d!] : [w!, 1];
  if (same(v, target(p))) {
    if (p.op === 'equiv' && d !== p.b[0]) return { right: false };
    if (p.form === 'simplest' && hasFrac && gcd(n!, d!) > 1) return { right: false, error: 'not-simplest' };
    if (p.form === 'mixed' && v[0] >= v[1] && (w === undefined || w === 0)) return { right: false, error: 'not-mixed' };
    if (p.form === 'improper' && w !== undefined && w !== 0) return { right: false, error: 'not-improper' };
    return { right: true };
  }
  const slip = slips(p).find(([, x]) => x[1] !== 0 && same(v, x));
  return slip ? { right: false, error: slip[0] } : { right: false };
}

// ---------------------------------------------------------------- fresh plain problems
const pick = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
function proper(rng: () => number, maxDen = 9): Frac {
  for (;;) { const d = pick(rng, 2, maxDen), n = pick(rng, 1, d - 1); if (gcd(n, d) === 1) return [n, d]; }
}
const asEntry = (f: Frac, mixed = false): Entry => {
  const [n, d] = reduce(f);
  if (d === 1) return { whole: `${n}` };
  return mixed && n > d ? { whole: `${Math.floor(n / d)}`, num: `${n % d}`, den: `${d}` } : { num: `${n}`, den: `${d}` };
};

/** A fresh plain problem for a skill, with new numbers each time, so an answer cannot be remembered. */
export function makeProblem(skill: string, rng: () => number): MathProblem {
  const base = { skill, form: 'any' as const, b: [1, 1] as Frac };
  switch (skill) {
    case 'math:MF1': {
      const x = pick(rng, 2, 10), y = pick(rng, 2, 10);
      return rng() < 0.5 ? { ...base, op: 'fact', a: [x, 1], b: [y, 1], shape: 'whole', prompt: `${x} × ${y} =`, answer: { whole: `${x * y}` } }
        : { ...base, op: 'quot', a: [x * y, 1], b: [x, 1], shape: 'whole', prompt: `${x * y} ÷ ${x} =`, answer: { whole: `${y}` } };
    }
    case 'math:MF2': {
      for (;;) {
        const g = pick(rng, 2, 9), m = pick(rng, 2, 9), k = pick(rng, 2, 9);
        if (m !== k && gcd(m, k) === 1) return { ...base, op: 'gcf', a: [g * m, 1], b: [g * k, 1], shape: 'whole', prompt: `The greatest common factor of ${g * m} and ${g * k} is`, answer: { whole: `${g}` } };
      }
    }
    case 'math:DV1': {
      const dv = pick(rng, 3, 9), q = pick(rng, 3, 12), r = pick(rng, 1, dv - 1);
      return { ...base, op: 'divrem', a: [q * dv + r, 1], b: [dv, 1], shape: 'remainder', prompt: `${q * dv + r} ÷ ${dv} =`, answer: { whole: `${q}`, rem: `${r}` } };
    }
    case 'math:FR1': {
      const parts = pick(rng, 2, 10), shaded = pick(rng, 1, parts - 1);
      return { ...base, op: 'shade', a: [shaded, parts], shape: 'fraction', prompt: 'What fraction of the bar is shaded?', bar: { parts, shaded }, answer: { num: `${shaded}`, den: `${parts}` } };
    }
    case 'math:FR2': {
      const f = proper(rng), k = pick(rng, 2, 5);
      return { ...base, op: 'equiv', a: f, b: [f[1] * k, 1], shape: 'fraction', prompt: `${fracText(f)} = ?/${f[1] * k}`, answer: { num: `${f[0] * k}`, den: `${f[1] * k}` } };
    }
    case 'math:FR3': {
      const f = proper(rng), k = pick(rng, 2, 6), big: Frac = [f[0] * k, f[1] * k];
      return { ...base, op: 'simplify', a: big, form: 'simplest', shape: 'fraction', prompt: `Simplify ${fracText(big)}`, answer: asEntry(f) };
    }
    case 'math:FR4': {
      const w = pick(rng, 1, 4), f = proper(rng), v: Frac = [w * f[1] + f[0], f[1]];
      return rng() < 0.5 ? { ...base, op: 'tomixed', a: v, form: 'mixed', shape: 'mixed', prompt: `Write ${fracText(v)} as a mixed number`, answer: { whole: `${w}`, num: `${f[0]}`, den: `${f[1]}` } }
        : { ...base, op: 'toimproper', a: v, form: 'improper', shape: 'fraction', prompt: `Write ${mixedText(v)} as an improper fraction`, answer: { num: `${v[0]}`, den: `${v[1]}` } };
    }
    case 'math:FR5': {
      const x = proper(rng), y = proper(rng);
      return { ...base, op: 'mul', a: x, b: y, shape: 'fraction', prompt: `${fracText(x)} × ${fracText(y)} =`, answer: asEntry(times(x, y)) };
    }
    case 'math:FR6': {
      const x = proper(rng), y = proper(rng);
      return { ...base, op: 'div', a: x, b: y, shape: 'mixed', prompt: `${fracText(x)} ÷ ${fracText(y)} =`, answer: asEntry(times(x, flip(y)), true) };
    }
    default: throw new Error(`no plain problems for ${skill}`);
  }
}

// ---------------------------------------------------------------- the help ladder's choices (LTF-43)
export interface Choice { entry: Entry; text: string; right: boolean; error?: MathError }
/** How an answer reads on a choice button. */
export const entryText = (e: Entry) => (e.rem !== undefined ? `${e.whole} r ${e.rem}` : `${e.whole && e.num ? `${e.whole} ` : e.whole ?? ''}${e.num ? `${e.num}/${e.den}` : ''}`);
const raw = ([n, d]: Frac): Entry => (d === 1 ? { whole: `${n}` } : { num: `${n}`, den: `${d}` });
function shuffle<T>(xs: T[], rng: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Three choices: the answer and two wrong ones, built from the usual mistakes where there are any (each then gets its
 * own next step), otherwise from a nearby number. The right one moves around. */
export function choicesFor(p: MathProblem, rng: () => number): Choice[] {
  const t = target(p), mixed = p.shape === 'mixed';
  const named: Entry[] = [];
  if (p.op === 'simplify') named.push(raw(p.a)); // equal, but not in simplest form
  if (p.op === 'tomixed') named.push(raw(p.a)); // equal, but not a mixed number
  if (p.op === 'divrem') named.push({ whole: `${t[0] - 1}`, rem: `${p.a[0] - (t[0] - 1) * p.b[0]}` }, { whole: `${t[0]}`, rem: '0' });
  for (const [, v] of slips(p)) if (v[0] > 0 && v[1] > 0) named.push(raw(v), asEntry(v, mixed));
  const near = p.op === 'divrem' ? [{ whole: `${t[0] + 1}`, rem: `${p.a[0] % p.b[0]}` }] : [1, -1, 2].flatMap((d) => (t[0] + d > 0 ? [asEntry([t[0] + d, t[1]], mixed)] : []));
  const out: Choice[] = [{ entry: p.answer!, text: entryText(p.answer!), right: true }];
  for (const e of [...shuffle(named, rng), ...near]) {
    if (out.length === 3) break;
    const text = entryText(e), j = judge(p, e);
    if (j.right || j.incomplete || out.some((c) => c.text === text)) continue;
    out.push({ entry: e, text, right: false, error: j.error });
  }
  return shuffle(out, rng);
}

/** LTF-43: faster than this, a first answer is a guess: time to read the problem, plus time to tap the answer in. */
export function mathMinMs(p: MathProblem, choices: boolean): number {
  const read = Math.max(1500, p.prompt.split(/\s+/).filter(Boolean).length * 100);
  const keys = Object.values(p.answer ?? {}).join('').length;
  return read + (choices ? 0 : keys * 300);
}
