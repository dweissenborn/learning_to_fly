// One session: the same seven steps in the same order, stoppable at any point without penalty.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { Item, LogEvent, SkillId } from '@wayfinder/schema';
import { ALL_SKILLS, choices, flightPoints, gate, isInterest, levelFor, mulberry32, planGateCheck, planSession, strandOf, usualStop, type Choice, type Progress, type SessionPlan, type StepName } from '@wayfinder/engine';
import { addNote, log, type Settings } from './db';
import { pool, passageText, SKILL, STRAND } from './content';
import { ItemView, NextSlot, type HintMode, type Result } from './ItemView';
import { Guide, GUIDES, Island, PiecePreview, PIECES, pieceById, freeTiles, type Placed } from './art';
import { Btn, Lanterns, SpeakBtn } from './ui';
import { BeatCard, finishedCount, journeyNow, KoalaCard, PostcardCard, reachedStops } from './journey';
import { sfx, speak, stopSpeaking } from './media';
import { useActivity } from './activity';
import { GearCelebration, KitMeter } from './gear';

type Step = 'plan' | 'choose' | 'warmup' | 'watch' | 'together' | 'yourturn' | 'gatecheck' | 'finish';
const STEP_META: Record<Step, { label: string; icon: string; say: string }> = {
  plan: { label: 'Plan', icon: '🗺️', say: 'See the plan.' },
  choose: { label: 'Choose', icon: '👆', say: 'Pick where to go today.' },
  warmup: { label: 'Warm up', icon: '☀️', say: 'A few quick questions about things you have done before.' },
  watch: { label: 'Watch', icon: '👀', say: 'Your guide shows how to do it.' },
  together: { label: 'Together', icon: '🤝', say: 'We do some together. Hints will help you.' },
  yourturn: { label: 'Your turn', icon: '⭐', say: 'You do some on your own. Ask for help if you want it.' },
  gatecheck: { label: 'Peak check', icon: '🔭', say: 'Five questions about new stories. No hints this time.' },
  finish: { label: 'Finish', icon: '🏁', say: 'See what you did, and add something to your island.' },
};
const LESSON: Step[] = ['plan', 'choose', 'warmup', 'watch', 'together', 'yourturn', 'finish'];
const CHECK: Step[] = ['plan', 'choose', 'gatecheck', 'finish'];

export function placedFrom(events: LogEvent[]): Placed[] {
  return events.flatMap((e) => (e.type === 'world' ? [{ piece: e.piece, x: e.x, y: e.y, id: e.id, ts: e.ts }] : []));
}

export function Session({ settings, events, progress, onExit }: { settings: Settings; events: LogEvent[]; progress: Progress; onExit: () => void }) {
  const [step, setStep] = useState<Step>('plan');
  const [mode, setMode] = useState<'lesson' | 'check'>('lesson');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [checkItems, setCheckItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [watchStep, setWatchStep] = useState(0);
  const [helpTick, setHelpTick] = useState(0);
  const [done, setDone] = useState<{ item: Item; phase: Step; r: Result }[]>([]);
  const [askStop, setAskStop] = useState(false);
  const sid = useMemo(() => crypto.randomUUID(), []);
  const started = useRef(false);
  const before = useMemo(() => ({ mastered: new Set(ALL_SKILLS.filter((s) => progress.skills[s].everMastered)), opened: progress.gateOpened, finished: finishedCount(progress) }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const g = gate(progress, settings.gate);
  const options = useMemo(() => choices(progress, g, Date.now()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const guide = settings.guide;
  const steps = mode === 'lesson' ? LESSON : CHECK;
  const points = flightPoints(events);
  // Where his recent sessions usually end. Getting past it earns a bonus, said out loud.
  const stopAt = useMemo(() => usualStop(events), []); // eslint-disable-line react-hooks/exhaustive-deps
  const boosted = useRef(false);
  const [boostMsg, setBoostMsg] = useState('');

  const lists: Partial<Record<Step, Item[]>> = plan ? { warmup: plan.warmup, together: plan.together, yourturn: [...plan.yourturn, ...plan.express] } : { gatecheck: checkItems };
  const current = lists[step]?.[idx];

  const choose = (c: Choice) => {
    const ctx = { pool, seen: progress.seen, interests: settings.interests, allowThemes: settings.hardThemes, hidden: new Set(settings.hidden), rng: mulberry32(Date.now() % 2147483647) };
    started.current = true;
    if (c.kind === 'gatecheck') {
      setCheckItems(planGateCheck(ctx));
      setMode('check');
      log({ type: 'session', session: sid, action: 'start', strand: 'narrative', gatecheck: true });
      go('gatecheck');
      return;
    }
    const p = planSession(progress, ctx, c.strand, Date.now(), settings.yourTurn);
    setPlan(p);
    log({ type: 'session', session: sid, action: 'start', strand: c.strand, skill: p.skill });
    go(p.warmup.length ? 'warmup' : 'watch', p);
  };

  const go = (s: Step, p: SessionPlan | null = plan) => {
    stopSpeaking();
    setIdx(0);
    if (s === 'watch' && !p?.model) s = 'together';
    if (s === 'together' && !p?.together.length) s = 'yourturn';
    if (s === 'yourturn' && p && !p.yourturn.length && !p.express.length) s = 'finish';
    if (stopAt && !boosted.current && LESSON.indexOf(s) > LESSON.indexOf(stopAt) && started.current) {
      boosted.current = true;
      void log({ type: 'activity', session: sid, kind: 'boost', step: stopAt, points: 3 });
      sfx.boost();
      setBoostMsg(`You kept going past ${STEP_META[stopAt].label}. +3 flight points!`);
      setTimeout(() => setBoostMsg(''), 7000);
    }
    if (settings.rewardPace === 'step' && !['plan', 'choose', 'warmup'].includes(s)) sfx.lantern();
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const nextPhase = (s: Step) => go(({ warmup: 'watch', watch: 'together', together: 'yourturn', yourturn: 'finish', gatecheck: 'finish' } as Record<string, Step>)[s] ?? 'finish');

  const onDone = (item: Item, r: Result) => {
    const phase = step as 'warmup' | 'together' | 'yourturn' | 'gatecheck';
    log({
      type: 'answer', session: sid, item: item.id, skill: item.skill, phase, correct: r.correct, hint: r.hint, tries: r.tries, ms: r.ms, format: item.format,
      transfer: !!item.transfer, interest: isInterest(pool, item, settings.interests), readAloud: settings.readAloud, level: item.level, ...(r.rubric !== undefined ? { rubric: r.rubric } : {}),
    });
    if (r.note) addNote({ kind: 'answer', personal: !!item.personal, item: item.id, title: item.prompt, text: r.note });
    setDone((d) => [...d, { item, phase, r }]);
    if (settings.rewardPace === 'item') sfx.lantern();
    if (idx + 1 < (lists[step]?.length ?? 0)) { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else nextPhase(step);
  };

  const stop = () => {
    stopSpeaking();
    if (started.current && step !== 'finish') log({ type: 'session', session: sid, action: 'stop' });
    onExit();
  };

  const idle = useActivity(sid, step as StepName, current?.id, started.current);

  // Read-to-me reads whatever is on screen.
  const readLines = current ? [...passageText(pool.passages.get(current.passage)!), current.prompt]
    : step === 'watch' && plan?.model ? [plan.model.steps[watchStep].say] : [STEP_META[step].say];
  const helpOn = !!current && (step === 'warmup' || step === 'together' || step === 'yourturn');
  const hintMode: HintMode = step === 'together' ? 'auto' : step === 'gatecheck' ? 'none' : 'request';
  const phaseItems = lists[step]?.length ?? 0;

  return <>
    <header className="topbar">
      <Guide id={guide} size={56} mood={step === 'finish' ? 'happy' : 'idle'} />
      <nav aria-label="Today's plan" style={{ flex: 1, minWidth: 0 }}>
        <ol className="schedule">
          {steps.map((s, i) => {
            const at = steps.indexOf(step);
            const skipped = (s === 'watch' && plan?.skipWatch) || (s === 'together' && plan?.skipTogether);
            return <li key={s} className={`${i < at ? 'done' : i === at ? 'now' : ''} ${skipped ? 'skipped' : ''}`} aria-current={i === at ? 'step' : undefined}>
              <span className="dot" aria-hidden>{STEP_META[s].icon}</span>{STEP_META[s].label}
              <span className="sr-only">{skipped ? ', skipped: you know this' : i < at ? ', done' : i === at ? ', now' : ''}</span>
            </li>;
          })}
        </ol>
        {settings.rewardPace === 'item' && phaseItems > 0 && <Lanterns total={phaseItems} lit={idx} />}
        {settings.rewardPace === 'step' && <Lanterns total={steps.length - 2} lit={Math.max(0, steps.indexOf(step) - 2)} />}
      </nav>
      <KitMeter points={points} />
    </header>

    <main id="main">
      {boostMsg && <div className="feedback good appear boost" role="status"><span aria-hidden>🚀</span><span>{boostMsg}</span></div>}
      {idle && (current || step === 'watch') && <div className="guide-row nudge appear" role="status">
        <Guide id={guide} mood="think" size={48} />
        <div className="bubble">{step === 'watch'
          ? <>Already know this one? Tap <b>Got it, skip</b>.</>
          : <>Still with me? I can read it to you, or give you a hint.
            <span className="row" style={{ marginTop: '0.4rem' }}>
              <Btn className="small" onPress={() => speak(readLines, 'nudge')}><span aria-hidden>🔊</span> Read it to me</Btn>
              {helpOn && <Btn className="small" onPress={() => setHelpTick((t) => t + 1)}><span aria-hidden>💡</span> A hint</Btn>}
            </span></>}
        </div>
      </div>}
      {step === 'plan' && <PlanStep guide={guide} steps={steps} onGo={() => go('choose')} />}
      {step === 'choose' && <ChooseStep options={options} onChoose={choose} guide={guide} />}
      {step === 'watch' && plan?.model && <div className="stack">
        <div className="guide-row"><Guide id={guide} mood={plan.model.steps[watchStep].reveal ? 'happy' : 'think'} size={72} />
          <div className="bubble appear" key={watchStep} aria-live="polite">
            <div className="muted" style={{ fontSize: '0.85rem' }}>{GUIDES[guide].name} shows how · {SKILL[plan.skill].name} · {watchStep + 1} of {plan.model.steps.length}</div>
            {plan.model.steps[watchStep].say}
          </div>
        </div>
        <ItemView item={plan.model.item} mode="demo" guide={guide} pictures={settings.pictures} demo={{ show: plan.model.steps[watchStep].show, reveal: plan.model.steps.slice(0, watchStep + 1).some((s) => s.reveal) }} />
        <NextSlot>
          {/* He does not need a thing shown twice: one press skips the rest of the demo. */}
          <Btn className="quiet" onPress={() => { void log({ type: 'activity', session: sid, kind: 'skip-demo', step: 'watch' }); nextPhase('watch'); }}>Got it, skip</Btn>
          {watchStep > 0 && <Btn className="quiet" onPress={() => setWatchStep(watchStep - 1)}>← Back</Btn>}
          {watchStep + 1 < plan.model.steps.length
            ? <Btn className="primary big" autoFocus onPress={() => { setWatchStep(watchStep + 1); if (settings.readAloud) speak([plan.model!.steps[watchStep + 1].say], 'watch'); }}>Next →</Btn>
            : <Btn className="primary big" autoFocus onPress={() => nextPhase('watch')}>Now we do it together →</Btn>}
        </NextSlot>
      </div>}
      {current && <div className="stack">
        {idx === 0 && plan && (step === 'together' || step === 'yourturn') && (plan.skipWatch || plan.skipTogether) && (step === 'yourturn' || !plan.skipTogether) &&
          <div className="feedback good appear"><Guide id={guide} mood="happy" size={44} /><span>{
            plan.skipTogether ? 'You already know how to do this, so we skip ahead. More of your own instead.' : 'You already know how to do this, so we skip the example today.'
          }</span></div>}
        <div className="row muted" style={{ fontWeight: 700 }}>
          <span className={`chip strand-${strandOf(current.skill)}`} style={{ background: 'var(--s-soft)', color: 'var(--s-deep)' }}>{STRAND[strandOf(current.skill)].icon} {SKILL[current.skill].name}</span>
          <span>{STEP_META[step].label} · {idx + 1} of {phaseItems}</span>
          {step === 'gatecheck' && <span>· no hints this time</span>}
        </div>
        <ItemView key={current.id} item={current} mode={hintMode} guide={guide} hintDelay={settings.hintDelay} pictures={settings.pictures} helpTick={helpTick}
          autoRead={settings.readAloud} praiseIndex={done.length} onDone={(r) => onDone(current, r)} />
      </div>}
      {step === 'finish' && <Finish sid={sid} plan={plan} done={done} settings={settings} events={events} progress={progress} before={before} onExit={onExit} />}
    </main>

    {step !== 'finish' && <footer className="bottombar no-print">
      <Btn className="quiet" onPress={() => (started.current ? setAskStop(true) : stop())}><span className="ico" aria-hidden>⏸️</span><span className="lbl">Stop</span></Btn>
      <SpeakBtn lines={readLines} k="bar" />
      <Btn isDisabled={!helpOn} onPress={() => setHelpTick((t) => t + 1)}><span className="ico" aria-hidden>💡</span><span className="lbl">Help</span></Btn>
      <span className="spacer" />
      <span id="bar-next" className="row" style={{ gap: '0.6rem' }} />
    </footer>}

    <GearCelebration points={points} guide={guide} seen={settings.kitSeen ?? 0} />

    <ModalOverlay className="overlay" isOpen={askStop} onOpenChange={setAskStop} isDismissable>
      <Modal><Dialog className="dialog" style={{ maxWidth: 480 }}>
        <Heading slot="title">Stop for now?</Heading>
        <p>Everything you did is saved. You can come back any time.</p>
        <div className="row"><Btn className="primary" autoFocus onPress={() => setAskStop(false)}>Keep going</Btn><Btn onPress={stop}>Stop</Btn></div>
      </Dialog></Modal>
    </ModalOverlay>
  </>;
}

function PlanStep({ guide, steps, onGo }: { guide: Settings['guide']; steps: Step[]; onGo: () => void }) {
  const say = `Here is today's plan. There are ${steps.length} steps. It takes about ten minutes. You can stop at any time.`;
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} size={72} /><div className="bubble">{say} <SpeakBtn lines={[say, ...steps.map((s) => `${STEP_META[s].label}. ${STEP_META[s].say}`)]} k="plan" label="" className="small iconbtn" /></div></div>
    <ol className="card stack" style={{ listStyle: 'none', margin: 0 }}>
      {steps.map((s, i) => <li key={s} className="row" style={{ flexWrap: 'nowrap' }}>
        <span className="chip" style={{ minWidth: 34, justifyContent: 'center' }}>{i + 1}</span>
        <span style={{ fontSize: '1.5rem' }} aria-hidden>{STEP_META[s].icon}</span>
        <span><b>{STEP_META[s].label}.</b> {STEP_META[s].say}</span>
      </li>)}
    </ol>
    <Btn className="primary big" autoFocus onPress={onGo}>Let's go →</Btn>
  </div>;
}

function ChooseStep({ options, onChoose, guide }: { options: Choice[]; onChoose: (c: Choice) => void; guide: Settings['guide'] }) {
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} size={72} /><div className="bubble">Where do you want to go today?</div></div>
    <div className="choose">
      {options.map((c) => c.kind === 'gatecheck'
        ? <Button key="gate" className="ccard strand-philosophical" onPress={() => onChoose(c)}>
          <span className="cico" aria-hidden>🔭</span><span className="cname">Peak check</span>
          <span>Five questions about stories you have not read yet. No hints. If you get most of them, Lantern Peaks open.</span>
        </Button>
        : <Button key={c.strand} className={`ccard strand-${c.strand}`} onPress={() => onChoose(c)}>
          <span className="cico" aria-hidden>{STRAND[c.strand].icon}</span>
          <span className="cname">{STRAND[c.strand].region}</span>
          <span>{STRAND[c.strand].intro}</span>
          <span className="muted"><b>Next:</b> {SKILL[c.skill].name}</span>
        </Button>)}
    </div>
  </div>;
}

// ---------------------------------------------------------------- finish: name the skill, grow the world, hand over to the adult (R7, R9)
function Finish({ sid, plan, done, settings, events, progress, before, onExit }: {
  sid: string; plan: SessionPlan | null; done: { item: Item; phase: Step; r: Result }[]; settings: Settings; events: LogEvent[]; progress: Progress;
  before: { mastered: Set<SkillId>; opened: boolean; finished: number }; onExit: () => void;
}) {
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    log({ type: 'session', session: sid, action: 'finish' });
    sfx.finish();
  }, [sid]);
  const [stage, setStage] = useState<'pick' | 'place' | 'done'>('pick');
  const [piece, setPiece] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string>();
  const placed = placedFrom(events);
  // The log updates a moment after the last answer, so a passed peak check is also read from this session's own answers.
  const checkPassed = !plan && done.length >= 5 && done.filter((d) => d.r.correct).length / done.length >= 0.8;
  const peaksOpen = progress.gateOpened || settings.gate === 'open' || checkPassed;
  // The journey: this session counts as finished, so it may bring an arrival or a new koala.
  const prev = journeyNow(before.finished, settings);
  const now = journeyNow(before.finished + 1, settings);
  const arrivedStop = now.stop > prev.stop ? now.here : null;
  const koalaMet = prev.arrived && now.koala ? now.koala : null;
  const offers = useMemo(() => {
    const rng = mulberry32([...sid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7));
    const owned = new Set(placed.map((p) => p.piece));
    const reached = reachedStops(now.stop);
    const avail = PIECES.filter((p) => (p.region !== 'philosophical' || peaksOpen) && (!p.stop || reached.has(p.stop)));
    const out: string[] = arrivedStop?.souvenir ? [arrivedStop.souvenir] : [];
    const add = (list: typeof PIECES) => {
      const c = list.filter((p) => !out.includes(p.id)).map((p) => ({ p, k: (owned.has(p.id) ? 1 : 0) + rng() * 0.9 })).sort((a, b) => a.k - b.k)[0];
      if (c) out.push(c.p.id);
    };
    add(avail.filter((p) => p.region === (plan?.strand ?? 'philosophical')));
    add(avail.filter((p) => p.topic && settings.interests.includes(p.topic as never)));
    while (out.length < 3) add(avail);
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const newly = ALL_SKILLS.filter((s) => progress.skills[s].everMastered && !before.mastered.has(s));
  const levelNow = plan ? levelFor(progress.skills[plan.skill], pool) : 0;
  const opened = (progress.gateOpened || checkPassed) && !before.opened;
  const own = done.filter((d) => d.phase === 'yourturn' || d.phase === 'gatecheck');
  const warm = [...new Set(done.filter((d) => d.phase === 'warmup').map((d) => SKILL[d.item.skill].name))];
  const lines = [
    warm.length ? `You warmed up with ${warm.join(' and ')}.` : '',
    plan?.model ? `You watched ${GUIDES[settings.guide].name} show ${SKILL[plan.skill].name.toLowerCase()}.` : '',
    done.some((d) => d.phase === 'together') ? `You did ${done.filter((d) => d.phase === 'together').length} together with ${GUIDES[settings.guide].name}.` : '',
    own.length ? `You did ${own.length} on your own.` : '',
    plan && own.length ? SKILL[plan.skill].praise[0].replace('{focus}', 'the word') : '',
  ].filter(Boolean);

  const place = (x: number, y: number) => {
    log({ type: 'world', piece: piece!, x, y });
    sfx.place();
    setFresh('pending');
    setStage('done');
  };
  const autoPlace = () => {
    const p = pieceById.get(piece!)!;
    const want = p.beach ? 'beach' : p.region === 'functional' ? 'town' : p.region === 'narrative' ? 'forest' : 'peaks';
    const free = freeTiles(placed, peaksOpen, p.beach);
    const best = free.filter((t) => t.region === want).sort((a, b) => Math.abs(a.r - 5) + Math.abs(a.c - 5) - (Math.abs(b.r - 5) + Math.abs(b.c - 5)))[0] ?? free[0];
    if (best) place(best.c, best.r);
    else setStage('done');
  };
  const lastWorld = [...events].reverse().find((e) => e.type === 'world');
  useEffect(() => { if (fresh === 'pending' && lastWorld) setFresh(lastWorld.id); }, [fresh, lastWorld]);
  const talk = plan ? SKILL[plan.skill].talk : 'Ask: which of today\'s stories was the most interesting? Why?';

  if (stage === 'place') return <div className="stack">
    <div className="guide-row"><Guide id={settings.guide} size={64} /><div className="bubble">Tap a dotted spot to put your {pieceById.get(piece!)?.name.toLowerCase()} there. Or I can choose a spot.</div></div>
    <Island placed={placed} lit={litFrom(progress)} here={{}} peaksOpen={peaksOpen} placing={{ piece: piece!, onPlace: place }} stage={now.stop} />
    <div className="row"><Btn onPress={() => setStage('pick')}>← Pick a different one</Btn><span className="spacer" /><Btn className="primary big" onPress={autoPlace}>Choose a spot for me</Btn></div>
  </div>;

  if (stage === 'done') return <div className="stack">
    <div className="center stack card">
      <div className="done-badge" aria-hidden>🏁</div>
      <h1>All done for today.</h1>
      {piece && <p>Your {pieceById.get(piece)?.name.toLowerCase()} is on the island now.</p>}
    </div>
    <Island placed={placedFrom(events)} lit={litFrom(progress)} here={{}} peaksOpen={peaksOpen} fresh={fresh} stage={now.stop} />
    <BeatCard now={now} settings={settings} />
    <div className="card talk">
      <h3>For your grown-up</h3>
      <p style={{ margin: 0 }}>{talk}</p>
      {now.beat?.talk && <p style={{ margin: '0.5rem 0 0' }}>{now.beat.talk}</p>}
    </div>
    <Btn className="primary big" autoFocus onPress={onExit}>Back to my island</Btn>
  </div>;

  return <div className="stack">
    <div className="guide-row"><Guide id={settings.guide} mood="happy" size={80} />
      <div className="bubble appear">
        <b>Here is what you did today.</b>
        <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </div>
    {newly.map((s) => <div key={s} className="ican-new appear">⭐ New on your shelf: {SKILL[s].ican}</div>)}
    {plan && levelNow > plan.level && <div className="ican-new appear">⬆️ Harder texts unlocked: level {levelNow} in {SKILL[plan.skill].name}.{levelNow >= 4 ? ' These are longer texts. You earned them.' : ''}</div>}
    {opened && <div className="ican-new appear strand-philosophical" style={{ background: 'var(--phi-soft)', color: 'var(--phi-deep)' }}>🏮 Lantern Peaks are open. A new part of your island is waiting.</div>}
    {arrivedStop && <PostcardCard stop={arrivedStop} arrived />}
    {koalaMet && <KoalaCard koala={koalaMet} />}
    <h2>Pick one new thing for your island</h2>
    <div className="pieces">
      {offers.map((id) => <Button key={id} className={`piece ${piece === id ? 'on' : ''}`} onPress={() => { setPiece(id); setStage(freeTiles(placed, peaksOpen, pieceById.get(id)?.beach).length ? 'place' : 'done'); }}>
        <PiecePreview id={id} />{pieceById.get(id)?.name}
      </Button>)}
    </div>
    <p className="muted">Your island has {placed.length} {placed.length === 1 ? 'thing' : 'things'} on it.</p>
  </div>;
}

export function litFrom(p: Progress) {
  const f = (prefix: string) => [1, 2, 3, 4, 5, 6].map((n) => p.skills[`${prefix}${n}` as SkillId].everMastered);
  return { functional: f('F'), narrative: f('N'), philosophical: f('P') };
}
