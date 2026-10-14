// LTF-41: math on the core session loop. A check-in (the scouting framing: no timer, no score, two misses in a row end
// it kindly and it picks up next time), then lessons on the next skill: a re-check if a skill stalled, a warm-up review,
// a worked example, a few together, then his turn. A miss opens the named next step for one more try; a second miss
// shows the answer (LTF-38). Sessions finish like reading's: the journey moves and he adds to his island.
import { useMemo, useRef, useState } from 'react';
import { ALL_SKILLS, mulberry32, pointsFor, type Progress } from '@wayfinder/engine';
import type { AnswerEvent, LogEvent } from '@wayfinder/schema';
import { Btn, Finish, finishedCount, Guide, log, sfx, SpeakBtn, stopSpeaking, type Settings } from '@wayfinder/web/host';
import { judge, makeProblem, type Entry, type MathProblem } from '../engine/math';
import { checkinNext, deriveMath } from '../engine/mathPath';
import type { MathSettings } from '../settings';
import { FractionBar, Keypad, MATH_HINT, MATH_NAME } from './MathView';

type Phase = 'placement' | 'recheck' | 'warmup' | 'together' | 'yourturn';
const TOGETHER = 3, YOURTURN = 5;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const f = ([n, d]: [number, number]) => (d === 1 ? `${n}` : `${n}/${d}`);

/** A worked example, step by step, in the words a teacher would say. Dividing follows keep, change, flip. */
export function workedSteps(p: MathProblem): string[] {
  const [a, b] = [p.a, p.b];
  switch (p.op) {
    case 'shade': return [`Count all the equal parts: ${a[1]}. That is the bottom number.`, `Count the shaded parts: ${a[0]}. That is the top number.`, `So ${a[0]}/${a[1]} of the bar is shaded.`];
    case 'fact': return [`${a[0]} × ${b[0]} means ${a[0]} groups of ${b[0]}.`, `Count by ${b[0]}s, or find it on the multiplication chart.`, `${a[0]} × ${b[0]} = ${a[0] * b[0]}.`];
    case 'quot': return [`${a[0]} ÷ ${b[0]} asks: how many groups of ${b[0]} make ${a[0]}?`, `${b[0]} × ${a[0] / b[0]} = ${a[0]}.`, `So ${a[0]} ÷ ${b[0]} = ${a[0] / b[0]}.`];
    case 'gcf': { const g = gcd(a[0], b[0]); return [`A common factor divides both ${a[0]} and ${b[0]}.`, `Try the biggest first: ${g} goes into ${a[0]} (${a[0] / g} times) and into ${b[0]} (${b[0] / g} times).`, `No bigger number divides both, so the greatest common factor is ${g}.`]; }
    case 'divrem': { const q = Math.floor(a[0] / b[0]), r = a[0] % b[0]; return [`How many ${b[0]}s fit in ${a[0]}? ${b[0]} × ${q} = ${b[0] * q}, and one more would be too many.`, `What is left over? ${a[0]} − ${b[0] * q} = ${r}.`, `So ${a[0]} ÷ ${b[0]} = ${q} r ${r}.`]; }
    case 'equiv': { const k = b[0] / a[1]; return [`The bottom ${a[1]} became ${b[0]}: it was multiplied by ${k}.`, `Multiply the top by ${k} too: ${a[0]} × ${k} = ${a[0] * k}.`, `So ${f(a)} = ${a[0] * k}/${b[0]}.`]; }
    case 'simplify': { const g = gcd(a[0], a[1]); return [`Find the biggest number that divides ${a[0]} and ${a[1]}: ${g}.`, `${a[0]} ÷ ${g} = ${a[0] / g}, and ${a[1]} ÷ ${g} = ${a[1] / g}.`, `So ${f(a)} = ${a[0] / g}/${a[1] / g}.`]; }
    case 'tomixed': { const w = Math.floor(a[0] / a[1]), r = a[0] % a[1]; return [`How many ${a[1]}s fit in ${a[0]}? ${w}. That is the whole number.`, `Left over: ${a[0]} − ${w * a[1]} = ${r}. That is the top.`, `The bottom stays ${a[1]}: ${w} ${r}/${a[1]}.`]; }
    case 'toimproper': { const w = Math.floor(a[0] / a[1]), r = a[0] % a[1]; return [`Multiply the whole number by the bottom: ${w} × ${a[1]} = ${w * a[1]}.`, `Add the top: ${w * a[1]} + ${r} = ${a[0]}.`, `Keep the bottom: ${a[0]}/${a[1]}.`]; }
    case 'mul': return [`Multiply the tops: ${a[0]} × ${b[0]} = ${a[0] * b[0]}.`, `Multiply the bottoms: ${a[1]} × ${b[1]} = ${a[1] * b[1]}.`, `So ${f(a)} × ${f(b)} = ${a[0] * b[0]}/${a[1] * b[1]}. Simplify it if you can.`];
    case 'div': return [`Keep the first fraction: ${f(a)}.`, `Change ÷ to ×.`, `Flip the second fraction: ${f(b)} becomes ${b[1]}/${b[0]}.`,
      `Multiply: ${a[0]} × ${b[1]} = ${a[0] * b[1]}, and ${a[1]} × ${b[0]} = ${a[1] * b[0]}.`, `So ${f(a)} ÷ ${f(b)} = ${a[0] * b[1]}/${a[1] * b[0]}. Simplify it if you can.`];
  }
}

/** Every math screen has the same top bar, so the page lays out as reading's does. */
const Top = ({ label }: { label?: string }) => <header className="topbar strand-math"><h1 style={{ margin: 0, fontSize: '1.4rem' }}>🧮 Math</h1><span className="spacer" />{label && <span className="muted">{label}</span>}</header>;

/** One problem on the keypad. A miss opens the named next step for one more try; a second miss shows the answer. */
function MathItem({ p, phase, guide, onDone }: { p: MathProblem; phase: Phase; guide: Settings['guide']; onDone: (r: { correct: boolean; shown: boolean; tries: number; ms: number }) => void }) {
  const [v, setV] = useState<Entry>({});
  const [tries, setTries] = useState(0);
  const [state, setState] = useState<null | 'right' | 'helped' | 'shown' | 'answered' | 'clue' | 'fill'>(null);
  const [error, setError] = useState<string>();
  const start = useRef(Date.now());
  const quiet = phase === 'placement' || phase === 'recheck'; // a check: no right or wrong shown, no second try
  const done = state === 'right' || state === 'helped' || state === 'shown' || state === 'answered';
  const check = () => {
    if (done) return;
    const r = judge(p, v);
    if (r.incomplete) { setState('fill'); return; }
    const t = tries + 1;
    setTries(t);
    if (quiet) { setState('answered'); setError(r.right ? 'right' : 'miss'); return; }
    if (r.right) { if (t === 1) { setState('right'); sfx.good(); } else setState('helped'); return; }
    if (t === 1) { setState('clue'); setError(r.error ? MATH_HINT[r.error] : 'Not this time. Check each step again.'); return; }
    setV(p.answer!); setState('shown');
  };
  const next = () => onDone({ correct: tries === 1 && (quiet ? error === 'right' : state === 'right'), shown: state === 'shown', tries: Math.max(1, tries), ms: Date.now() - start.current });
  return <div className="stack math-item">
    <div className="row"><p className="math-prompt" style={{ flex: 1 }}>{p.prompt}</p><SpeakBtn lines={[p.prompt.replace('÷', 'divided by').replace('×', 'times')]} k={'m-' + p.prompt} label="" className="small iconbtn" /></div>
    {p.bar && <FractionBar {...p.bar} />}
    <Keypad key={p.prompt + (state === 'shown' ? '-shown' : '')} shape={p.shape} wholeOptional={p.form !== 'mixed'} value={v} onChange={(x) => { if (!done) { setV(x); if (state === 'fill') setState(null); } }} onCheck={check} />
    <div aria-live="polite" className="stack">
      {state === 'fill' && <div className="feedback neutral appear"><Guide id={guide} size={44} /><span>Fill in every box first.</span></div>}
      {state === 'clue' && <div className="feedback hint appear"><Guide id={guide} mood="think" size={44} /><span>{error} Try once more.</span></div>}
      {state === 'right' && <div className="feedback good appear"><Guide id={guide} mood="happy" size={44} /><span><b>Right.</b></span></div>}
      {state === 'helped' && <div className="feedback neutral appear"><Guide id={guide} size={44} /><span>You found it with the clue.</span></div>}
      {state === 'shown' && <div className="feedback neutral appear"><Guide id={guide} mood="think" size={44} /><span>Here is the answer. <b>Now you have seen how.</b></span></div>}
      {state === 'answered' && <div className="feedback neutral appear"><Guide id={guide} size={44} /><span>Got it. On to the next one.</span></div>}
    </div>
    {done && <Btn className="primary big appear" autoFocus onPress={next}>Next <span aria-hidden>→</span></Btn>}
  </div>;
}

const placementAnswers = (events: readonly LogEvent[]) => events.filter((e): e is AnswerEvent => e.type === 'answer' && e.phase === 'placement' && e.skill.startsWith('math:'));

/** The math check-in: two problems a skill, moving up while he is right and down after a miss. */
function Checkin({ settings, events, math, onExit, onBreak }: { settings: Settings; events: LogEvent[]; math: MathSettings; onExit: () => void; onBreak: () => void }) {
  const sid = useMemo(() => 'math-checkin-' + crypto.randomUUID(), []);
  const rng = useMemo(() => mulberry32(Date.now() % 2147483647), []);
  const before = useMemo(() => placementAnswers(events), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mine, setMine] = useState<AnswerEvent[]>([]);
  const [started, setStarted] = useState(false);
  const [misses, setMisses] = useState(0);
  const all = [...before, ...mine];
  const skill = checkinNext(all, { known: math.known });
  const onSkill = mine.filter((a) => a.skill === skill).length;
  const p = useMemo(() => (skill ? makeProblem(skill, rng) : null), [skill, mine.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopped = misses >= 2;
  if (!started) return <><Top /><main><div className="stack card center" style={{ maxWidth: 640, margin: '0 auto' }}>
    <Guide id={settings.guide} mood="happy" size={96} />
    <h1 style={{ margin: 0 }}>Math scouting trip</h1>
    <p style={{ margin: 0 }}>A few problems to find where your math path starts. No timer and no score. It is fine not to know some: that tells us where to begin.</p>
    <Btn className="primary big" autoFocus onPress={() => setStarted(true)}>Let's go</Btn>
  </div></main></>;
  if (stopped || !skill || !p) return <><Top /><main><div className="stack card center" style={{ maxWidth: 640, margin: '0 auto' }}>
    <Guide id={settings.guide} mood="happy" size={96} />
    <h1 style={{ margin: 0 }}>{stopped ? 'Good place to stop' : 'Your math path is ready'}</h1>
    <p style={{ margin: 0 }}>{stopped ? 'Your scouting is saved. We will pick up from here next time.' : 'Next time you choose Math, you start on the first step that is right for you.'}</p>
    <Btn className="primary big" autoFocus onPress={onExit}>Back to my island</Btn>
  </div></main></>;
  return <>
    <Top label="Scouting trip" />
    <main className="stack" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <div className="row"><span className="chip">{MATH_NAME[skill]}</span><span className="muted">Scouting · problem {onSkill + 1} of 2</span></div>
      <MathItem key={`${skill}-${mine.length}`} p={p} phase="placement" guide={settings.guide} onDone={(r) => {
        const a = { type: 'answer', session: sid, item: `gen-${sid}-${mine.length}`, skill, phase: 'placement', correct: r.correct, hint: 0, tries: r.tries, ms: r.ms, format: 'keypad', module: 'math' } as const;
        void log(a);
        setMine((m) => [...m, { ...a, id: `local-${m.length}`, ts: Date.now() } as AnswerEvent]);
        setMisses((x) => (r.correct ? 0 : x + 1));
      }} />
    </main>
    <footer className="bottombar"><Btn className="quiet" onPress={() => { stopSpeaking(); onBreak(); }}><span className="ico" aria-hidden>⏸️</span><span className="lbl">I need a break</span></Btn><span className="spacer" /></footer>
  </>;
}

type Step = { p: MathProblem; phase: Phase } | { watch: MathProblem };

export function MathSession({ settings, events, progress, math, onExit, onBreak }: { settings: Settings; events: LogEvent[]; progress: Progress; math: MathSettings; onExit: () => void; onBreak: (why: 'break') => void }) {
  const state = useMemo(() => deriveMath(events, { opened: math.opened, known: math.known }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const sid = useMemo(() => 'math-' + crypto.randomUUID(), []);
  const rng = useMemo(() => mulberry32(Date.now() % 2147483647), []);
  const before = useMemo(() => ({ mastered: new Set(ALL_SKILLS.filter((s) => progress.skills[s].everMastered)), opened: progress.gateOpened, finished: finishedCount(progress) }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo<Step[]>(() => {
    if (!state.checkin.done) return [];
    const out: Step[] = [];
    for (const s of state.recheck) out.push({ p: makeProblem(s, rng), phase: 'recheck' }, { p: makeProblem(s, rng), phase: 'recheck' });
    for (const s of state.review.slice(0, 2)) out.push({ p: makeProblem(s, rng), phase: 'warmup' });
    if (state.focus) {
      out.push({ watch: makeProblem(state.focus, rng) });
      for (let k = 0; k < TOGETHER; k++) out.push({ p: makeProblem(state.focus, rng), phase: 'together' });
      for (let k = 0; k < YOURTURN; k++) out.push({ p: makeProblem(state.focus, rng), phase: 'yourturn' });
    }
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0);
  const started = useRef(false);
  if (!state.checkin.done) return <Checkin settings={settings} events={events} math={math} onExit={onExit} onBreak={() => onBreak('break')} />;
  if (!plan.length) return <><Top /><main><div className="stack card center" style={{ maxWidth: 640, margin: '0 auto' }}>
    <h1 style={{ margin: 0 }}>Every math step is done for now</h1><p style={{ margin: 0 }}>Reviews come back when they are due.</p>
    <Btn className="primary big" autoFocus onPress={onExit}>Back to my island</Btn></div></main></>;
  if (idx >= plan.length) return <Finish sid={sid} plan={null} done={[]} settings={settings} events={events} progress={progress} before={before} onExit={onExit} module="math"
    talk="Ask: which problem was the trickiest today? How did you work it out?" />;
  const step = plan[idx];
  const begin = () => { if (!started.current) { started.current = true; void log({ type: 'session', session: sid, action: 'start', skill: state.focus ?? state.review[0], module: 'math' }); } };
  const label = 'watch' in step ? 'Watch' : step.phase === 'recheck' ? 'A quick check' : step.phase === 'warmup' ? 'Warm up' : step.phase === 'together' ? 'Together' : 'Your turn';
  const skill = 'watch' in step ? step.watch.skill : step.p.skill;
  return <>
    <Top label={`${label} · ${idx + 1} of ${plan.length}`} />
    <main className="stack" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <div className="row"><span className="chip">{MATH_NAME[skill]}</span></div>
      {'watch' in step ? <section className="card stack" aria-label="Watch a worked example">
        <p className="math-prompt">{step.watch.prompt}</p>
        {step.watch.bar && <FractionBar {...step.watch.bar} />}
        <ol className="math-steps">{workedSteps(step.watch).map((s) => <li key={s}>{s}</li>)}</ol>
        <div className="row"><SpeakBtn lines={workedSteps(step.watch)} k={'w-' + step.watch.prompt} /><span className="spacer" /><Btn className="primary big" autoFocus onPress={() => { begin(); setIdx(idx + 1); }}>Got it <span aria-hidden>→</span></Btn></div>
      </section>
        : <MathItem key={idx} p={step.p} phase={step.phase} guide={settings.guide} onDone={(r) => {
          begin();
          void log({ type: 'answer', session: sid, item: `gen-${sid}-${idx}`, skill: step.p.skill, phase: step.phase, correct: r.correct, hint: r.tries > 1 ? 1 : 0, tries: r.tries, ms: r.ms, format: 'keypad', module: 'math',
            ...(r.shown ? { shown: true } : {}), points: pointsFor({ correct: r.correct, shown: r.shown }) });
          setIdx(idx + 1);
        }} />}
    </main>
    <footer className="bottombar"><Btn className="quiet" onPress={() => { stopSpeaking(); if (started.current) void log({ type: 'session', session: sid, action: 'stop', reason: 'break', module: 'math' }); onBreak('break'); }}>
      <span className="ico" aria-hidden>⏸️</span><span className="lbl">I need a break</span></Btn><span className="spacer" /></footer>
  </>;
}

