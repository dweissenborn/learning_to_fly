// One session: the same seven steps in the same order, stoppable at any point without penalty.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { Item, LogEvent, SkillId } from '@wayfinder/schema';
import { pointsFor, minReadMs, flightPeak, ALL_SKILLS, checkupDue, choices, flightPoints, gate, isInterest, levelFor, levelPeak, mulberry32, planCheckup, planGateCheck, planSession, RULES, strandOf, testFlight, type Choice, type Progress, type SessionPlan, type StepName, type WordCard as WordCardT } from '@wayfinder/engine';
import { addNote, log, saveSettings, type GuideId, type Settings } from './db';
import { pool, passageText, SKILL, STRAND } from './content';
import { ItemView, NextSlot, type HintMode, type Result } from './ItemView';
import { Guide, GUIDES, Island, islandOf, PiecePreview, PIECES, pieceById, freeTiles, type Placed } from './art';
import { Btn, Lanterns, MoreGuide, SpeakBtn } from './ui';
import { BeatCard, cap, finishedCount, journeyNow, KoalaCard, PostcardCard, reachedStops, islandView, questDone } from './journey';
import { sfx, speak, stopSpeaking } from './media';
import { useActivity } from './activity';
import { GearCelebration, KitMeter } from './gear';
import { SaveMenu } from './CloudScreens';

type Step = 'plan' | 'choose' | 'warmup' | 'watch' | 'together' | 'yourturn' | 'gatecheck' | 'checkup' | 'finish';
const STEP_META: Record<Step, { label: string; icon: string; say: string }> = {
  plan: { label: 'Plan', icon: '🗺️', say: 'See the plan.' },
  choose: { label: 'Choose', icon: '👆', say: 'Pick where to go today.' },
  warmup: { label: 'Warm up', icon: '☀️', say: 'A few quick questions about things you have done before.' },
  watch: { label: 'Watch', icon: '👀', say: 'Your guide shows how to do it.' },
  together: { label: 'Together', icon: '🤝', say: 'We do some together. Hints will help you.' },
  yourturn: { label: 'Your turn', icon: '⭐', say: 'You do some on your own. Ask for help if you want it.' },
  gatecheck: { label: 'Peak check', icon: '🔭', say: 'Five questions about new stories. No hints this time.' },
  checkup: { label: 'Check-up flight', icon: '🛫', say: 'Six new texts. No hints, and no right or wrong. It shows how your reading is growing.' },
  finish: { label: 'Finish', icon: '🏁', say: 'See what you did, and add something to your island.' },
};
const LESSON: Step[] = ['plan', 'choose', 'warmup', 'watch', 'together', 'yourturn', 'finish'];
const CHECK: Step[] = ['plan', 'choose', 'gatecheck', 'finish'];
const CHECKUP: Step[] = ['plan', 'choose', 'checkup', 'finish'];

export function placedFrom(events: LogEvent[]): Placed[] {
  return events.flatMap((e) => (e.type === 'world' ? [{ piece: e.piece, x: e.x, y: e.y, id: e.id, ts: e.ts, island: e.island ?? 'home' }] : []));
}

export function Session({ settings, events, progress, onExit, onBreak }: { settings: Settings; events: LogEvent[]; progress: Progress; onExit: () => void; onBreak: (why: 'break' | 'rapid') => void }) {
  const [step, setStep] = useState<Step>('plan');
  const [mode, setMode] = useState<'lesson' | 'check' | 'checkup'>('lesson');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [checkItems, setCheckItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [watchStep, setWatchStep] = useState(0);
  const [helpTick, setHelpTick] = useState(0);
  const [wordDone, setWordDone] = useState(false);
  const [done, setDone] = useState<{ item: Item; phase: Step; r: Result }[]>([]);
  const sid = useMemo(() => crypto.randomUUID(), []);
  const started = useRef(false);
  const before = useMemo(() => ({ mastered: new Set(ALL_SKILLS.filter((s) => progress.skills[s].everMastered)), opened: progress.gateOpened, finished: finishedCount(progress) }), []); // eslint-disable-line react-hooks/exhaustive-deps
  // LTF-56 trial: now and then a block of sessions runs with one support fewer. The plan says so first, and he can keep it.
  const test = useMemo(() => testFlight(before.finished, settings.legLength, settings), []); // eslint-disable-line react-hooks/exhaustive-deps
  const off = test && settings.testKept !== test.block ? test.support : null;
  const sup = { pictures: settings.pictures && off !== 'pictures', readAloud: settings.readAloud && off !== 'readAloud' };
  const g = gate(progress, settings.gate);
  // LTF-14: an optional check-up flight about every ten sessions, from the stop he is at, while its pool lasts.
  const jn = journeyNow(finishedCount(progress), settings);
  const stopId = jn.here?.id ?? 'home';
  // LTF-20: on the way to a themed island, sessions lean toward its interests (a lean, not a filter: one pick in five still ignores interests).
  const interests = [...new Set([...settings.interests, ...((jn.next?.topics ?? []) as typeof settings.interests)])];
  const options = useMemo(() => {
    const out = choices(progress, g, Date.now());
    const ready = planCheckup({ pool, seen: new Map(), interests: [], allowThemes: settings.hardThemes, hidden: new Set(settings.hidden), rng: () => 0.5 }, stopId).length === RULES.checkupTexts;
    return checkupDue(progress) && ready ? [...out, { kind: 'checkup' } as Choice] : out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const guide = settings.guide;
  const steps = mode === 'lesson' ? LESSON : mode === 'check' ? CHECK : CHECKUP;
  const points = flightPoints(events), peak = flightPeak(events);
  // LTF-38: fast wrong answers in a row, and when the session began (for ending on a success at a set time).
  const rapidRun = useRef(0);
  const begun = useRef(0);

  const lists: Partial<Record<Step, Item[]>> = plan ? { warmup: plan.warmup, together: plan.together, yourturn: [...plan.yourturn, ...plan.express] } : mode === 'checkup' ? { checkup: checkItems } : { gatecheck: checkItems };
  const current = lists[step]?.[idx];

  const choose = (c: Choice) => {
    const ctx = { pool, seen: progress.seen, interests, allowThemes: settings.hardThemes, hidden: new Set(settings.hidden), rng: mulberry32(Date.now() % 2147483647), tapped: tappedWords(events) };
    started.current = true;
    begun.current = Date.now();
    if (c.kind === 'checkup') {
      setCheckItems(planCheckup(ctx, stopId));
      setMode('checkup');
      log({ type: 'session', session: sid, action: 'start', checkup: true });
      go('checkup');
      return;
    }
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
    if (settings.rewardPace === 'step' && !['plan', 'choose', 'warmup'].includes(s)) sfx.lantern();
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const nextPhase = (s: Step) => go(({ warmup: 'watch', watch: 'together', together: 'yourturn', yourturn: 'finish', gatecheck: 'finish', checkup: 'finish' } as Record<string, Step>)[s] ?? 'finish');

  // A new skill's first guided item shows its clue at once; after that, the usual wait (LTF-01).
  const clueAtOnce = step === 'together' && idx === 0 && !!plan?.newSkill && settings.clueFirst;
  const onDone = (item: Item, r: Result) => {
    const phase = step as 'warmup' | 'together' | 'yourturn' | 'gatecheck' | 'checkup';
    // LTF-38: a first tap faster than the question could be read is a guess: it is set aside and earns nothing.
    const rapid = settings.guessCheck !== false && item.tier !== 'express' && r.firstMs < minReadMs(item);
    // LTF-49: after "I'm not sure" a grown-up helps, so the answer counts as helped, like the clue.
    const asked = askedOn.current.has(item.id);
    if (asked) r = { ...r, correct: false };
    log({
      type: 'answer', session: sid, item: item.id, skill: item.skill, phase, correct: r.correct, hint: r.hint, tries: r.tries, ms: r.ms, format: item.format, ...(asked ? { asked: true } : {}),
      transfer: !!item.transfer, interest: isInterest(pool, item, settings.interests), readAloud: sup.readAloud, pictures: sup.pictures, level: item.level, ...(phase === 'together' ? { delay: clueAtOnce ? 0 : settings.hintDelay } : {}), ...(r.rubric !== undefined ? { rubric: r.rubric } : {}),
      ...(item.reason && r.hint >= 2 ? { card: true } : {}),
      ...(r.shown ? { shown: true } : {}), ...(rapid ? { rapid: true } : {}), points: pointsFor({ correct: r.correct, shown: r.shown, rapid }),
    });
    if (r.note) addNote({ kind: 'answer', personal: !!item.personal, item: item.id, title: item.prompt, text: r.note });
    setDone((d) => [...d, { item, phase, r }]);
    if (settings.rewardPace === 'item') sfx.lantern();
    // LTF-38: two fast wrong answers in a row end the session kindly. Never a "slow down".
    rapidRun.current = rapid && !r.firstRight ? rapidRun.current + 1 : 0;
    if (rapidRun.current >= 2) return takeBreak('rapid');
    // LTF-38: a grown-up can end sessions on a success after a set time, before guessing tends to start.
    if (mode === 'lesson' && settings.endAt && r.firstRight && Date.now() - begun.current >= settings.endAt * 60_000) return go('finish');
    if (idx + 1 < (lists[step]?.length ?? 0)) { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else nextPhase(step);
  };

  // LTF-38: "I need a break" is honoured at once, every time, and he goes to the lounge. Everything is saved.
  const takeBreak = (why: 'break' | 'rapid') => {
    stopSpeaking();
    if (started.current && step !== 'finish') log({ type: 'session', session: sid, action: 'stop', reason: why });
    onBreak(why);
  };

  const idle = useActivity(sid, step as StepName, current?.id, started.current);
  // LTF-49: "I'm not sure": the guide tells him to ask a grown-up (a name a grown-up can set), and the grown-ups see where.
  const helper = settings.helper?.trim() || 'a grown-up';
  const askedOn = useRef(new Set<string>());
  const [asking, setAsking] = useState<string | null>(null);
  const notSure = () => {
    if (!current) return;
    askedOn.current.add(current.id);
    setAsking(current.id);
    void log({ type: 'activity', session: sid, kind: 'unsure', item: current.id, step: step as StepName });
    if (sup.readAloud) speak([`That's OK. Ask ${helper} to help you with this one.`], 'unsure');
  };

  // Read-to-me reads whatever is on screen.
  const readLines = current ? [...passageText(pool.passages.get(current.passage)!), current.prompt]
    : step === 'watch' && plan?.model ? [plan.model.steps[watchStep].say] : [STEP_META[step].say];
  const helpOn = !!current && (step === 'warmup' || step === 'together' || step === 'yourturn');
  const hintMode: HintMode = step === 'together' ? 'auto' : step === 'gatecheck' || step === 'checkup' ? 'none' : 'request';
  const phaseItems = lists[step]?.length ?? 0;

  return <>
    <header className="topbar">
      <Guide id={guide} size={56} mood={step === 'finish' ? 'happy' : 'idle'} />
      <nav aria-label="Today's plan">
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
      <KitMeter points={points} peak={peak} />
      <SaveMenu />
    </header>

    <main id="main">
      {idle && (current || step === 'watch') && <div className="guide-row nudge appear toast" role="status">
        <Guide id={guide} mood="think" size={48} />
        <div className="bubble">{step === 'watch'
          ? <>Already know this one? Tap <b>Got it, skip</b>.</>
          : <>Still with me? I can read it to you, or give you a hint. Not sure? Ask {helper} for help.
            <span className="row" style={{ marginTop: '0.4rem' }}>
              <Btn className="small" onPress={() => speak(readLines, 'nudge')}><span aria-hidden>🔊</span> Read it to me</Btn>
              {helpOn && <Btn className="small" onPress={() => setHelpTick((t) => t + 1)}><span aria-hidden>💡</span> A hint</Btn>}
            </span></>}
        </div>
      </div>}
      {current && asking === current.id && <div className="guide-row nudge appear toast" role="status">
        <Guide id={guide} mood="happy" size={48} />
        <div className="bubble">That's OK. Ask {helper} to help you with this one.
          <span className="row" style={{ marginTop: '0.4rem' }}><Btn className="small" autoFocus onPress={() => setAsking(null)}>OK</Btn></span>
        </div>
      </div>}
      {step === 'plan' && <PlanStep guide={guide} steps={steps} off={off} onKeep={() => void saveSettings({ testKept: test!.block })} onGo={() => go('choose')} />}
      {step === 'choose' && <ChooseStep options={options} onChoose={choose} guide={guide} />}
      {step === 'watch' && plan?.model && <div className="stack">
        <div className="guide-row"><Guide id={guide} mood={plan.model.steps[watchStep].reveal ? 'happy' : 'think'} size={72} />
          <div className="bubble appear" key={watchStep} aria-live="polite">
            <div className="muted" style={{ fontSize: '0.85rem' }}>{GUIDES[guide].name} shows how · {SKILL[plan.skill].name} · {watchStep + 1} of {plan.model.steps.length}</div>
            {plan.model.steps[watchStep].say}
          </div>
        </div>
        <ItemView item={plan.model.item} mode="demo" guide={guide} pictures={sup.pictures} demo={{ show: plan.model.steps[watchStep].show, reveal: plan.model.steps.slice(0, watchStep + 1).some((s) => s.reveal),
          fill: plan.model.steps.slice(0, watchStep + 1).flatMap((s) => (s.fill ? [s.fill] : [])) }} />
        <NextSlot>
          {/* He does not need a thing shown twice: one press skips the rest of the demo. */}
          <Btn className="quiet" onPress={() => { void log({ type: 'activity', session: sid, kind: 'skip-demo', step: 'watch' }); nextPhase('watch'); }}>Got it, skip</Btn>
          {watchStep > 0 && <Btn className="quiet" onPress={() => setWatchStep(watchStep - 1)}>← Back</Btn>}
          {watchStep + 1 < plan.model.steps.length
            ? <Btn className="primary big" autoFocus onPress={() => { setWatchStep(watchStep + 1); if (sup.readAloud) speak([plan.model!.steps[watchStep + 1].say], 'watch'); }}>Next →</Btn>
            : <Btn className="primary big" autoFocus onPress={() => nextPhase('watch')}>Now we do it together →</Btn>}
        </NextSlot>
      </div>}
      {step === 'warmup' && idx === 0 && plan?.word && !wordDone && <WordCard sid={sid} card={plan.word} guide={guide} onDone={() => setWordDone(true)} />}
      {current && !(step === 'warmup' && idx === 0 && plan?.word && !wordDone) && <div className="stack">
        {idx === 0 && plan && (step === 'together' || step === 'yourturn') && (plan.skipWatch || plan.skipTogether) && (step === 'yourturn' || !plan.skipTogether) &&
          <div className="feedback good appear"><Guide id={guide} mood="happy" size={44} /><span>{
            plan.skipTogether ? 'You already know how to do this, so we skip ahead. More of your own instead.' : 'You already know how to do this, so we skip the example today.'
          }</span></div>}
        <div className="row muted" style={{ fontWeight: 700 }}>
          <span className={`chip strand-${strandOf(current.skill)}`} style={{ background: 'var(--s-soft)', color: 'var(--s-deep)' }}>{STRAND[strandOf(current.skill)].icon} {SKILL[current.skill].name}</span>
          <span>{STEP_META[step].label} · {idx + 1} of {phaseItems}</span>
          {(step === 'gatecheck' || step === 'checkup') && <span>· no hints this time</span>}
        </div>
        <ItemView key={current.id} item={current} mode={hintMode} guide={guide} hintDelay={settings.hintDelay} clueAtOnce={clueAtOnce} pictures={sup.pictures} helpTick={helpTick}
          whosWho={{ setting: settings.whosWho ?? 'auto', n4Mastered: progress.skills.N4.everMastered, names: !!settings.namesLevel1 }}
          autoRead={sup.readAloud} praiseIndex={done.length} onDone={(r) => onDone(current, r)} />
      </div>}
      {step === 'finish' && <Finish sid={sid} plan={plan} done={done} settings={settings} events={events} progress={progress} before={before} onExit={onExit} />}
    </main>

    {step !== 'finish' && <footer className="bottombar no-print">
      <Btn className="quiet" onPress={() => takeBreak('break')}><span className="ico" aria-hidden>⏸️</span><span className="lbl">I need a break</span></Btn>
      <SpeakBtn lines={readLines} k="bar" />
      <Btn isDisabled={!helpOn} onPress={() => setHelpTick((t) => t + 1)}><span className="ico" aria-hidden>💡</span><span className="lbl">Help</span></Btn>
      <Btn isDisabled={!helpOn} onPress={notSure}><span className="ico" aria-hidden>🙋</span><span className="lbl">I'm not sure</span></Btn>
      <span className="spacer" />
      <span id="bar-next" className="row" style={{ gap: '0.6rem' }} />
    </footer>}

    <GearCelebration peak={peak} guide={guide} seen={settings.kitSeen ?? 0} />

  </>;
}

function PlanStep({ guide, steps, off, onKeep, onGo }: { guide: Settings['guide']; steps: Step[]; off: 'pictures' | 'readAloud' | null; onKeep: () => void; onGo: () => void }) {
  const say = `Here is today's plan. There are ${steps.length} steps. It takes about ten minutes. You can stop at any time.`;
  const test = off === 'pictures' ? 'Test flight: no pictures with the answers for a few flights. Points stay the same.'
    : off === 'readAloud' ? "Test flight: I won't read aloud by myself for a few flights. Tap 🔊 to hear any part. Points stay the same." : '';
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} size={72} /><div className="bubble">{say} <SpeakBtn lines={[say, ...(test ? [test] : []), ...steps.map((s) => `${STEP_META[s].label}. ${STEP_META[s].say}`)]} k="plan" label="" className="small iconbtn" /></div></div>
    {test && <div className="card row test-flight" role="note"><span aria-hidden>🧪</span><span>{test}</span>
      <Btn className="quiet small" onPress={onKeep}>{off === 'pictures' ? 'Keep my pictures' : 'Keep reading aloud'}</Btn></div>}
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
      {options.map((c) => c.kind === 'checkup'
        ? <Button key="checkup" className="ccard" onPress={() => onChoose(c)}>
          <span className="cico" aria-hidden>🛫</span><span className="cname">Check-up flight</span>
          <span>Six new texts about where you are on your journey. No hints, and no right or wrong. You can do it now or another day.</span>
        </Button>
        : c.kind === 'gatecheck'
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
export function Finish({ sid, plan, done, settings, events, progress, before, onExit, module, talk: talkFor }: {
  sid: string; plan: SessionPlan | null; done: { item: Item; phase: Step; r: Result }[]; settings: Settings; events: LogEvent[]; progress: Progress;
  before: { mastered: Set<SkillId>; opened: boolean; finished: number }; onExit: () => void;
  /** LTF-41: another module's session (math) finishes here too, with its own note for the grown-up. */
  module?: string; talk?: string;
}) {
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    log({ type: 'session', session: sid, action: 'finish', ...(module ? { module } : {}) });
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
  // An arrival on the way to Australia, or (LTF-30) at a stop of the keeper arc.
  const arrivedStop = now.stop > prev.stop ? now.here : now.arc && now.arc.stop > (prev.arc?.stop ?? 0) ? now.arc.here
    : now.trip && now.trip.stop > (prev.trip?.stop ?? 0) ? now.trip.here : null; // LTF-30, LTF-27
  useEffect(() => { if (now.arc && !prev.arc) void log({ type: 'activity', session: sid, kind: 'arc' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // LTF-36: what he builds today goes on the island he is on now (the new one, if he just arrived).
  const isle = islandOf(now.here.id);
  const lit = litFrom(progress);
  const onIsle = placed.filter((p) => p.island === isle);
  // LTF-46: what this session did on the island's quest, and then what building did. Only on the island he was already on.
  const builtNow = new Set(onIsle.map((p) => p.piece));
  const [builtBefore] = useState(builtNow);
  const before0 = islandView(isle, prev, settings, lit, builtBefore);
  const afterSession = islandView(isle, now, settings, lit, builtBefore);
  const view = islandView(isle, now, settings, lit, builtNow);
  const stayed = islandOf(prev.here.id) === isle;
  const stepsDone = (a: typeof view, b: typeof view) => (stayed ? a.def.steps.filter((_, i) => a.state.done[i] && !b.state.done[i]) : []);
  const opensNow = stepsDone(afterSession, before0), builtDone = stepsDone(view, afterSession);
  const partly = stayed ? view.def.steps.filter((s, i) => !afterSession.state.done[i] && afterSession.state.count[i] > before0.state.count[i] && s.then) : [];
  const keepsake = view.def.keepsake && stayed && !questDone(before0.state) ? view.def.keepsake : undefined;
  const stepLine = (s: (typeof opensNow)[number]) => <div key={s.text} className="ican-new appear">🗝️ {s.text} {s.place ? `${s.place.name} is open on ${view.def.name} now.` : 'Done.'}</div>;
  const koalaMet = prev.arrived && now.koala ? now.koala : null;
  const offers = useMemo(() => {
    const rng = mulberry32([...sid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7));
    const owned = new Set(onIsle.map((p) => p.piece));
    const reached = new Set([...reachedStops(now.stop, settings, now.arc?.stop), ...(now.trip?.places ?? [])]);
    const avail = PIECES.filter((p) => (p.region !== 'philosophical' || peaksOpen) && (!p.stop || reached.has(p.stop)));
    const out: string[] = arrivedStop?.souvenir ? [arrivedStop.souvenir] : [];
    const add = (list: typeof PIECES) => {
      const c = list.filter((p) => !out.includes(p.id)).map((p) => ({ p, k: (owned.has(p.id) ? 1 : 0) + rng() * 0.9 })).sort((a, b) => a.k - b.k)[0];
      if (c) out.push(c.p.id);
    };
    const build = view.def.steps.find((s, i) => s.build && !view.state.done[i])?.build; // LTF-46: a quest step to build
    if (build && avail.some((p) => p.id === build) && !out.includes(build)) out.push(build);
    else add(avail.filter((p) => view.def.pieces.includes(p.id))); // LTF-36: something that belongs on this island
    add(avail.filter((p) => p.region === (plan?.strand ?? 'philosophical')));
    add(avail.filter((p) => p.topic && settings.interests.includes(p.topic as never)));
    while (out.length < 3) add(avail);
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const newly = ALL_SKILLS.filter((s) => progress.skills[s].everMastered && !before.mastered.has(s));
  const levelNow = plan ? levelFor(progress.skills[plan.skill], pool) : 0;
  // A miss steps him down a level, so climbing back to one he had reached is not a new unlock.
  const peakBefore = plan ? levelPeak({ ...progress.skills[plan.skill], answers: progress.skills[plan.skill].answers.filter((x) => x.session !== sid) }, pool) : 0;
  const opened = (progress.gateOpened || checkPassed) && !before.opened;
  const own = done.filter((d) => d.phase === 'yourturn' || d.phase === 'gatecheck' || d.phase === 'checkup');
  const warm = [...new Set(done.filter((d) => d.phase === 'warmup').map((d) => SKILL[d.item.skill].name))];
  const lines = [
    warm.length ? `You warmed up with ${warm.join(' and ')}.` : '',
    plan?.model ? `You watched ${GUIDES[settings.guide].name} show ${SKILL[plan.skill].name.toLowerCase()}.` : '',
    done.some((d) => d.phase === 'together') ? `You did ${done.filter((d) => d.phase === 'together').length} together with ${GUIDES[settings.guide].name}.` : '',
    own.length ? `You did ${own.length} on your own.` : '',
    plan && own.length ? SKILL[plan.skill].praise[0].replace('{focus}', 'the word') : '',
  ].filter(Boolean);

  const place = (x: number, y: number) => {
    log({ type: 'world', piece: piece!, x, y, ...(isle === 'home' ? {} : { island: isle }) });
    sfx.place();
    setFresh('pending');
    setStage('done');
  };
  const autoPlace = () => {
    const p = pieceById.get(piece!)!;
    const want = p.beach ? 'beach' : p.region === 'functional' ? 'town' : p.region === 'narrative' ? 'forest' : 'peaks';
    const free = freeTiles(onIsle, peaksOpen, p.beach, view.def, view.state);
    const best = free.filter((t) => t.region === want).sort((a, b) => Math.abs(a.r - 5) + Math.abs(a.c - 5) - (Math.abs(b.r - 5) + Math.abs(b.c - 5)))[0] ?? free[0];
    if (best) place(best.c, best.r);
    else setStage('done');
  };
  const lastWorld = [...events].reverse().find((e) => e.type === 'world');
  useEffect(() => { if (fresh === 'pending' && lastWorld) setFresh(lastWorld.id); }, [fresh, lastWorld]);
  const talk = talkFor ?? (plan ? SKILL[plan.skill].talk : 'Ask: which of today\'s stories was the most interesting? Why?');

  if (stage === 'place') return <div className="stack">
    <div className="guide-row"><Guide id={settings.guide} size={64} /><div className="bubble">Tap a dotted spot to put your {pieceById.get(piece!)?.name.toLowerCase()} there. Or I can choose a spot.</div></div>
    <Island placed={onIsle} lit={lit} here={{}} peaksOpen={peaksOpen} placing={{ piece: piece!, onPlace: place }} stage={now.stop} island={view.def} state={view.state} />
    <div className="row"><Btn onPress={() => setStage('pick')}>← Pick a different one</Btn><span className="spacer" /><Btn className="primary big" onPress={autoPlace}>Choose a spot for me</Btn></div>
  </div>;

  if (stage === 'done') return <div className="stack">
    <div className="center stack card">
      <div className="done-badge" aria-hidden>🏁</div>
      <h1>All done for today.</h1>
      {piece && <p>Your {pieceById.get(piece)?.name.toLowerCase()} is on {isle === 'home' ? 'the island' : view.def.name} now.</p>}
    </div>
    {builtDone.map(stepLine)}
    {keepsake && builtDone.length > 0 && questDone(view.state) && <div className="ican-new appear">{keepsake.icon} You finished the {view.def.name} quest. {cap(keepsake.name)} goes on your shelf on Home Island.</div>}
    <Island placed={placedFrom(events).filter((p) => p.island === isle)} lit={lit} here={{}} peaksOpen={peaksOpen} fresh={fresh} stage={now.stop} island={view.def} state={view.state} />
    <BeatCard now={now} settings={settings} />
    <div className="card talk">
      <h3>For your grown-up</h3>
      <p style={{ margin: 0 }}>{talk}</p>
      {now.beat?.talk && <p style={{ margin: '0.5rem 0 0' }}>{now.beat.talk}</p>}
      {plan && strandOf(plan.skill) === 'narrative' && <p style={{ margin: '0.5rem 0 0' }}>
        <a className="btn small" href="/story-map.html" target="_blank" rel="noopener">🗺️ Print a paper story map</a> Some children do better on paper, so this stays an option.</p>}
      <MoreGuide open={settings.moreGuide !== false} />
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
    {plan && levelNow > plan.level && levelNow > peakBefore && <div className="ican-new appear">⬆️ Harder texts unlocked: level {levelNow} in {SKILL[plan.skill].name}.{levelNow >= 4 ? ' These are longer texts. You earned them.' : ''}</div>}
    {opened && <div className="ican-new appear strand-philosophical" style={{ background: 'var(--phi-soft)', color: 'var(--phi-deep)' }}>🏮 Lantern Peaks are open. A new part of your island is waiting.</div>}
    {opensNow.map(stepLine)}
    {partly.map((s) => <div key={s.text} className="ican-new appear">🗝️ {s.then}</div>)}
    {keepsake && questDone(afterSession.state) && <div className="ican-new appear">{keepsake.icon} You finished the {view.def.name} quest. {cap(keepsake.name)} goes on your shelf on Home Island.</div>}
    {arrivedStop && <PostcardCard stop={arrivedStop} arrived />}
    {koalaMet && <KoalaCard koala={koalaMet} />}
    <h2>Pick one new thing for your island</h2>
    <div className="pieces">
      {offers.map((id) => <Button key={id} className={`piece ${piece === id ? 'on' : ''}`} onPress={() => { setPiece(id); setStage(freeTiles(onIsle, peaksOpen, pieceById.get(id)?.beach, view.def, view.state).length ? 'place' : 'done'); }}>
        <PiecePreview id={id} />{pieceById.get(id)?.name}
      </Button>)}
    </div>
    <p className="muted">{isle === 'home' ? 'Your island' : view.def.name} has {onIsle.length} {onIsle.length === 1 ? 'thing' : 'things'} on it.</p>
  </div>;
}

/** LTF-04: words he tapped for their meaning, most tapped first. */
export function tappedWords(events: readonly LogEvent[]) {
  const n = new Map<string, number>();
  for (const e of events) if (e.type === 'activity' && e.kind === 'word-help' && e.word) n.set(e.word.toLowerCase(), (n.get(e.word.toLowerCase()) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

/** LTF-04: a word for today, before the warm-up questions. A wrong pick only fades; nothing is scored. */
function WordCard({ sid, card, guide, onDone }: { sid: string; card: WordCardT; guide: GuideId; onDone: () => void }) {
  const [tried, setTried] = useState<number[]>([]);
  const [right, setRight] = useState(false);
  const pick = (k: number) => {
    if (right || tried.includes(k)) return;
    if (k === card.answer) {
      setRight(true);
      void log({ type: 'activity', session: sid, kind: 'word-check', word: card.word, correct: tried.length === 0 });
    } else setTried((t) => [...t, k]);
  };
  const parts = card.sentence.split(new RegExp(`(\\b${card.word}\\b)`, 'i'));
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} size={56} /><div className="bubble appear">A word for today: <b>{card.word}</b>. What does it mean here?
      <SpeakBtn lines={[`A word for today: ${card.word}.`, card.sentence, ...card.options]} k="word-card" label="" className="small iconbtn" /></div></div>
    <div className="card"><p className="prose" style={{ margin: 0, fontSize: '1.2rem' }}>{parts.map((t, i) => (i % 2 ? <b key={i} className="gloss on">{t}</b> : t))}</p></div>
    <div className="answers" role="group" aria-label="Meanings">{card.options.map((o, k) =>
      <Button key={k} className={`opt ${tried.includes(k) ? 'tried' : ''} ${right && k === card.answer ? 'right' : ''}`} onPress={() => pick(k)}>{o}</Button>)}</div>
    {right && <div className="feedback good appear"><Guide id={guide} mood="happy" size={44} /><span><span aria-hidden>{card.pic}</span> <b>{card.word}</b> means {card.options[card.answer]}.</span></div>}
    {tried.length > 0 && !right && <div className="feedback hint appear"><Guide id={guide} mood="think" size={44} /><span>Read the sentence again. What would make sense there?</span></div>}
    {right && <NextSlot><Btn className="primary big appear" autoFocus onPress={onDone}>Next <span aria-hidden>→</span></Btn></NextSlot>}
  </div>;
}

export function litFrom(p: Progress) {
  const f = (prefix: string) => [1, 2, 3, 4, 5, 6].map((n) => p.skills[`${prefix}${n}` as SkillId].everMastered);
  return { functional: f('F'), narrative: f('N'), philosophical: f('P') };
}
